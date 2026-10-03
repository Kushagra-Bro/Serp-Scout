import { Worker, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, businesses, services, keywords, workspaces, rankingObservations } from '../../db/index.js';
import { analyzeWebsite } from '@serp-scout/agents';
import { redisConnection, reportQueue } from '../queues.js';
import { refreshKeywordRankings } from '../../services/ranking.service.js';
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

  // 2. Refresh keyword rankings & record observations
  console.log(`[ResearchWorker] Refreshing keyword rankings for business ${business.name}...`);
  let observationsRecorded = 0;
  let quotaExhausted = false;
  try {
    const refreshResult = await refreshKeywordRankings({
      businessId,
      workspaceId,
      searchType: 'google',
    });
    observationsRecorded = refreshResult.refreshedCount;
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

export function startWebsiteAnalysisWorker() {
  const worker = new Worker<WebsiteAnalysisJobData>(
    'website-analysis',
    async (job: Job<WebsiteAnalysisJobData>) => {
      const { businessId } = job.data;
      console.log(`[Worker] Starting website analysis for businessId: ${businessId}`);

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

      console.log(`[Worker] Analysis complete for "${business.name}". Extracted ${analysis.detectedServices.length} services, ${analysis.candidateKeywords.length} keywords.`);

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

      return analysis;
    },
    {
      connection: redisConnection,
      concurrency: 3,
      lockDuration: 300000, // 5 minutes
      // Reduce passive Redis churn: Upstash meters every request, and BullMQ's
      // default 30s stalled-scan per worker is a dominant always-on cost.
      // 10 min is plenty for this app's cadence (the Postgres-based reconciler
      // converges even if a scan is missed).
      stalledInterval: 10 * 60 * 1000,
      maxStalledCount: 2,
      // When the queue is drained, block ~5 minutes before polling again instead
      // of BullMQ's default 5s — the blocking pop is 1 Redis request per poll,
      // and no standing repeatables exist anymore (see system-timers.ts).
      drainDelay: 5 * 60 * 1000,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[WebsiteAnalysisWorker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[WebsiteAnalysisWorker] Job ${job?.id} failed with error:`, err);
  });

  return worker;
}

export function startResearchWorker() {
  const worker = new Worker<ResearchRunJobData>(
    'research-run',
    async (job: Job<ResearchRunJobData>) => {
      return await executeResearchRun(job.data);
    },
    {
      connection: redisConnection,
      concurrency: 2,
      lockDuration: 300000, // 5 minutes to allow multiple SerpApi & LLM calls
      stalledInterval: 10 * 60 * 1000,
      maxStalledCount: 2,
      drainDelay: 5 * 60 * 1000,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[ResearchWorker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[ResearchWorker] Job ${job?.id} failed with error:`, err);
  });

  return worker;
}
