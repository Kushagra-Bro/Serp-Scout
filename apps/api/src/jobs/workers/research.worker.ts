import { Worker, Job } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { db, businesses, services, keywords, workspaces, rankingObservations } from '../../db/index.js';
import { analyzeWebsite } from '@serp-scout/agents';
import { redisConnection, reportQueue, researchQueue } from '../queues.js';
import { runRankSweep } from '../../services/ranking.service.js';
import { classifySearchError } from '../../lib/search-errors.js';

export interface WebsiteAnalysisJobData {
  businessId: string;
}

export interface ResearchRunJobData {
  businessId: string;
  workspaceId: string;
  triggerReport?: boolean;
}

/**
 * Executes a full recurring or on-demand research run:
 * refreshes keyword rankings, checks competitor signals, updates freshness, and queues report.
 */
export async function executeResearchRun(data: ResearchRunJobData) {
  const { businessId, workspaceId, triggerReport = true } = data;
  console.log(`[ResearchWorker] Starting automated research run for business ${businessId}...`);

  // 1. Fetch business
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) {
    throw new Error(`Business ${businessId} not found`);
  }

  // 2. Refresh keyword rankings & record observations. A full sweep walks every
  // monitored keyword (ten per pass) so the ranking table is complete rather
  // than only the first ten rows of it.
  console.log(`[ResearchWorker] Refreshing keyword rankings for business ${business.name}...`);
  let observationsRecorded = 0;
  let quotaExhausted = false;
  try {
    const sweep = await runRankSweep({
      businessId,
      workspaceId,
      searchType: 'google',
    });
    observationsRecorded = sweep.observationsRecorded;
    quotaExhausted = sweep.quotaExhausted;
    console.log(
      `[ResearchWorker] Rank sweep: ${sweep.keywordsChecked} keyword(s) checked in ${sweep.passes} pass(es), ` +
        `${sweep.observationsRecorded} observation(s) recorded, ${sweep.uncheckedRemaining} keyword(s) still unchecked, ` +
        `${sweep.failedCount} failure(s)${sweep.timedOut ? ', stopped on the time budget' : ''}.`
    );
    if (sweep.failedCount > 0) {
      console.warn(
        `[ResearchWorker] First sweep failure for "${business.name}": "${sweep.failures[0]?.phrase}" — ${sweep.failures[0]?.error}`
      );
    }
  } catch (err: any) {
    if (classifySearchError(err) !== 'other') {
      // Workspace meter or upstream provider is out of quota: don't retry here,
      // don't fabricate freshness, and don't build reports on stale data. The
      // monthly reset (or the cross-provider fallback now baked into
      // executeSearchRun) resolves this on a future cycle.
      quotaExhausted = true;
      console.warn(`[ResearchWorker] Skipped ranking refresh for "${business.name}": ${err.message}`);
    } else {
      console.warn('[ResearchWorker] Warning during ranking refresh:', err.message);
    }
  }

  // 3. Mark business as fresh — unless a search quota was exhausted. In that
  // case leave lastAnalyzedAt untouched (so the cadence clock keeps running)
  // and flag the data stale so the catch-up re-runs it after the reset.
  const now = new Date();
  if (quotaExhausted) {
    await db
      .update(businesses)
      .set({
        dataStale: true,
        updatedAt: now,
      })
      .where(eq(businesses.id, businessId));
  } else {
    await db
      .update(businesses)
      .set({
        lastAnalyzedAt: now,
        dataStale: false,
        updatedAt: now,
      })
      .where(eq(businesses.id, businessId));
  }

  // 4. Update workspace last scheduled run
  await db
    .update(workspaces)
    .set({
      lastScheduledRunAt: now,
      updatedAt: now,
    })
    .where(eq(workspaces.id, workspaceId));

  // 5. Trigger weekly report generation if requested (not on a quota-exhausted run)
  let reportJobId: string | null = null;
  if (triggerReport && !quotaExhausted) {
    console.log(`[ResearchWorker] Research run complete. Enqueueing weekly report generation...`);
    const reportJob = await reportQueue.add('generate-report', {
      businessId,
      workspaceId,
    });
    reportJobId = reportJob.id ? String(reportJob.id) : null;
  }

  return {
    businessId,
    observationsRecorded,
    freshAt: now.toISOString(),
    reportJobId,
  };
}

export interface RankSweepJobData {
  businessId: string;
  workspaceId: string;
}

/**
 * Lightweight background ranking sweep.
 *
 * Enqueued on business creation (right after keyword discovery) and by the
 * rank-freshness reconciler, so the Keywords page renders pre-computed positions
 * instead of waiting for someone to press "Refresh Rankings". Unlike a full
 * research run it never spends LLM calls on a report.
 */
export async function executeRankSweep(data: RankSweepJobData) {
  const { businessId, workspaceId } = data;

  const [business] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspaceId)))
    .limit(1);

  if (!business) {
    throw new Error(`Business ${businessId} not found in workspace ${workspaceId}`);
  }

  const sweep = await runRankSweep({ businessId, workspaceId, searchType: 'google' });

  console.log(
    `[RankSweep] "${business.name}": ${sweep.keywordsChecked} keyword(s) in ${sweep.passes} pass(es), ` +
      `${sweep.observationsRecorded} observation(s), ${sweep.uncheckedRemaining} unchecked, ` +
      `${sweep.failedCount} failure(s)${sweep.timedOut ? ', stopped on the time budget' : ''}.`
  );

  // Only claim freshness once every monitored keyword has a stored check.
  // Otherwise leave `lastAnalyzedAt` untouched so the reconcilers keep filling
  // the table in (the ranking table is what the user actually looks at).
  const coverageComplete = sweep.uncheckedRemaining === 0 && !sweep.quotaExhausted && !sweep.timedOut;

  if (coverageComplete) {
    await db
      .update(businesses)
      .set({ lastAnalyzedAt: new Date(), dataStale: false, updatedAt: new Date() })
      .where(eq(businesses.id, businessId));
  } else if (sweep.quotaExhausted) {
    await db
      .update(businesses)
      .set({ dataStale: true, updatedAt: new Date() })
      .where(eq(businesses.id, businessId));
  }

  return {
    businessId,
    passes: sweep.passes,
    keywordsChecked: sweep.keywordsChecked,
    observationsRecorded: sweep.observationsRecorded,
    uncheckedRemaining: sweep.uncheckedRemaining,
    failedCount: sweep.failedCount,
    failures: sweep.failures,
    quotaExhausted: sweep.quotaExhausted,
    timedOut: sweep.timedOut,
    coverageComplete,
  };
}

/**
 * Executes a full website analysis: extracts metadata, services, and candidate keywords.
 */
export async function executeWebsiteAnalysis(data: WebsiteAnalysisJobData) {
  const { businessId } = data;
  console.log(`[WebsiteAnalysis] Starting website analysis for businessId: ${businessId}`);

  // 1. Fetch business details
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) {
    throw new Error(`Business not found with ID ${businessId}`);
  }

  // 2. Run Website Analysis Agent
  const analysis = await analyzeWebsite(business.websiteUrl, {
    businessNameHint: business.name,
    industryHint: business.industry || undefined,
    cityHint: business.city || undefined,
  });

  console.log(`[WebsiteAnalysis] Analysis complete for "${business.name}". Extracted ${analysis.detectedServices.length} services, ${analysis.candidateKeywords.length} keywords.`);

  // 3. Update business record
  await db
    .update(businesses)
    .set({
      lastAnalyzedAt: new Date(),
      dataStale: false,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, businessId));

  // 4. Save newly discovered services
  if (analysis.detectedServices.length > 0) {
    const existingServices = await db
      .select()
      .from(services)
      .where(eq(services.businessId, businessId));

    const existingNames = new Set(existingServices.map((s) => s.name.toLowerCase()));
    const newServicesToInsert = analysis.detectedServices
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name, idx) => ({
        businessId,
        name,
        priority: existingServices.length + idx + 1,
      }));

    if (newServicesToInsert.length > 0) {
      await db.insert(services).values(newServicesToInsert);
    }
  }

  // 5. Seed candidate keywords discovered from website
  if (analysis.candidateKeywords.length > 0) {
    const existingKeywords = await db
      .select()
      .from(keywords)
      .where(eq(keywords.businessId, businessId));

    const existingPhrases = new Set(existingKeywords.map((k) => k.phrase.toLowerCase()));
    const newKeywordsToInsert = analysis.candidateKeywords
      .filter((phrase) => !existingPhrases.has(phrase.toLowerCase()))
      .map((phrase) => ({
        businessId,
        phrase,
        location: business.city || undefined,
        intent: 'commercial' as const,
        status: 'candidate' as const,
        opportunityScore: 70.0,
      }));

    if (newKeywordsToInsert.length > 0) {
      await db.insert(keywords).values(newKeywordsToInsert);
    }
  }

  // 6. Hand off to the ranking sweep so the positions behind those keywords are
  // computed in the background instead of on the user's next click.
  try {
    await researchQueue.add(
      'rank-sweep',
      { businessId, workspaceId: business.workspaceId },
      { deduplication: { id: `rank-sweep:${businessId}:${Math.floor(Date.now() / 600000)}` } }
    );
  } catch (err: any) {
    console.warn(`[WebsiteAnalysis] Could not queue rank sweep for ${businessId}: ${err?.message || err}`);
  }

  return analysis;
}

/**
 * Legacy starters maintained for backwards compatibility.
 * All workloads are now managed by startMainJobWorker() in main.worker.ts.
 */
export function startWebsiteAnalysisWorker() {
  return { close: async () => {} };
}

export function startResearchWorker() {
  return { close: async () => {} };
}
