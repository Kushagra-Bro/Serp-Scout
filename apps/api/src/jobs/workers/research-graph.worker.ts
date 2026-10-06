import { Worker, Job, UnrecoverableError } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import {
  db,
  businesses,
  services,
  competitors,
  keywords,
  contentGaps,
  reviewThemes,
  reports,
  recommendations,
  sourceEvidence,
} from '../../db/index.js';
import { runResearchGraph } from '@serp-scout/agents';
import {
  SerpApiResearchGateway,
  assertBusinessInWorkspace,
} from '../../services/research-gateway.service.js';
import { redisConnection, researchQueue } from '../queues.js';
import { env } from '../../config/env.js';
import { classifySearchError } from '../../lib/search-errors.js';

export interface ResearchGraphJobData {
  businessId: string;
  workspaceId: string;
  /** Persist a reports + recommendations row set. Defaults to true. */
  persistReport?: boolean;
}

/**
 * Runs the full LangGraph research pipeline and persists every artifact it
 * produces: competitors, keyword opportunities, content gaps, review themes,
 * and (optionally) a report with its prioritized recommendations.
 */
export async function executeResearchGraphRun(data: ResearchGraphJobData) {
  const { businessId, workspaceId, persistReport = true } = data;
  console.log(`[ResearchGraphWorker] Starting pipeline for business ${businessId}`);

  await assertBusinessInWorkspace(businessId, workspaceId);

  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!biz) {
    throw new Error(`Business ${businessId} not found`);
  }

  const bizServices = await db
    .select()
    .from(services)
    .where(eq(services.businessId, businessId));

  const gateway = new SerpApiResearchGateway(businessId, workspaceId, biz.city || undefined);

  // Fail fast rather than starting a pipeline that cannot pay for its searches.
  await gateway.assertQuotaAvailable();

  const state = await runResearchGraph({
    context: {
      businessId,
      businessName: biz.name,
      websiteUrl: biz.websiteUrl,
      industry: biz.industry || undefined,
      city: biz.city || undefined,
      country: biz.country || undefined,
      services: bizServices.map((s) => s.name),
    },
    search: gateway,
    apiKey: env.GROQ_API_KEY,
  });

  console.log(
    `[ResearchGraphWorker] Pipeline finished: ${state.competitorCandidates.length} competitors, ` +
      `${state.keywordCandidates.length} keywords, ${state.contentGaps.length} gaps, ` +
      `${state.recommendations.length} recommendations, ${state.errors.length} node error(s).`
  );

  // ── Persist competitors (upsert by business + domain) ──────────────────────
  let savedCompetitors = 0;
  const competitorIdByDomain = new Map<string, string>();

  const existingCompetitors = await db
    .select({ id: competitors.id, domain: competitors.domain })
    .from(competitors)
    .where(eq(competitors.businessId, businessId));

  for (const candidate of state.competitorCandidates) {
    if (candidate.competitorType === 'irrelevant' || candidate.competitorType === 'directory') {
      continue;
    }

    const metadata = {
      threatLevel: candidate.threatLevel,
      threatReason: candidate.threatReason,
      proximityLabel: candidate.proximityLabel,
      distanceMiles: candidate.distanceMiles,
      serpOverlapPercent: candidate.serpOverlapPercent,
      hasAds: candidate.hasAds,
      extractedProfile: candidate.extractedProfile,
      evidence: candidate.evidence,
    };

    const existing = existingCompetitors.find(
      (c) => c.domain.toLowerCase() === candidate.domain.toLowerCase()
    );

    if (existing) {
      await db
        .update(competitors)
        .set({
          name: candidate.name,
          websiteUrl: candidate.websiteUrl,
          mapsUrl: candidate.mapsUrl ?? null,
          category: candidate.category ?? null,
          competitorType: candidate.competitorType,
          confidenceScore: candidate.confidenceScore,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(competitors.id, existing.id));
      competitorIdByDomain.set(candidate.domain.toLowerCase(), existing.id);
    } else {
      const [inserted] = await db
        .insert(competitors)
        .values({
          businessId,
          name: candidate.name,
          domain: candidate.domain,
          websiteUrl: candidate.websiteUrl,
          mapsUrl: candidate.mapsUrl ?? null,
          category: candidate.category ?? null,
          competitorType: candidate.competitorType,
          confidenceScore: candidate.confidenceScore,
          // Left as 'candidate' so the owner can confirm or reject in the UI.
          status: 'candidate',
          metadata,
        })
        .returning();
      competitorIdByDomain.set(candidate.domain.toLowerCase(), inserted.id);
    }
    savedCompetitors++;
  }

  // ── Persist keyword opportunities (deduped by phrase) ──────────────────────
  const existingKeywords = await db
    .select({ phrase: keywords.phrase })
    .from(keywords)
    .where(eq(keywords.businessId, businessId));
  const knownPhrases = new Set(existingKeywords.map((k) => k.phrase.toLowerCase()));

  const newKeywords = state.keywordCandidates
    .filter((k) => !knownPhrases.has(k.phrase.toLowerCase()))
    .slice(0, 40)
    .map((k) => ({
      businessId,
      phrase: k.phrase,
      location: biz.city || undefined,
      intent: k.intent,
      status: 'candidate' as const,
      opportunityScore: k.opportunityScore,
    }));

  if (newKeywords.length > 0) {
    await db.insert(keywords).values(newKeywords);
  }

  // ── Persist content gaps ───────────────────────────────────────────────────
  let savedGaps = 0;
  for (const gap of state.contentGaps) {
    const competitorId =
      competitorIdByDomain.get(gap.competitorDomain.toLowerCase()) ?? null;
    await db.insert(contentGaps).values({
      businessId,
      competitorId,
      topic: gap.topic,
      evidence: {
        competitorDomain: gap.competitorDomain,
        competitorUrl: gap.competitorUrl,
        evidenceUrls: gap.evidenceUrls,
      },
      recommendedPageType: gap.recommendedPageType,
      suggestedTitle: gap.suggestedTitle,
      suggestedHeadings: gap.suggestedHeadings,
      suggestedFaqs: gap.suggestedFaqs,
      targetIntent: gap.targetIntent,
      priority: gap.priority,
      effort: gap.estimatedEffort,
      impact: gap.estimatedImpact,
      status: 'open',
    });
    savedGaps++;
  }

  // ── Persist review themes ──────────────────────────────────────────────────
  let savedThemes = 0;
  for (const theme of state.reviewThemes) {
    const firstCompetitor = state.competitorCandidates[0];
    await db.insert(reviewThemes).values({
      competitorId: firstCompetitor
        ? competitorIdByDomain.get(firstCompetitor.domain.toLowerCase()) ?? null
        : null,
      theme: theme.theme,
      sentiment: theme.sentiment,
      frequency: theme.frequency,
      examples: theme.examples,
      sourceReference: 'Google Local Reviews & Customer Feedback',
    });
    savedThemes++;
  }

  // ── Mark the business as freshly analyzed ──────────────────────────────────
  await db
    .update(businesses)
    .set({ lastAnalyzedAt: new Date(), dataStale: false, updatedAt: new Date() })
    .where(eq(businesses.id, businessId));

  // ── Persist report + recommendations ───────────────────────────────────────
  let reportId: string | null = null;
  if (persistReport && state.report) {
    const [report] = await db
      .insert(reports)
      .values({
        businessId,
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        summary: state.report as any,
        status: 'published',
      })
      .returning();
    reportId = report.id;

    for (const action of state.report.actionPlan) {
      const steps =
        action.implementationSteps && action.implementationSteps.length > 0
          ? action.implementationSteps
          : [
              `Review competitor positioning on ${action.searchQueries?.[0] || 'target query'}`,
              'Draft and publish targeted copy addressing core consumer friction',
              'Add LocalBusiness schema markup and request Google indexing',
            ];

      const [rec] = await db
        .insert(recommendations)
        .values({
          businessId,
          reportId: report.id,
          title: action.title,
          description: action.problem,
          impact: action.expectedImpact,
          effort: action.estimatedEffort,
          priority: action.priority,
          confidence: action.confidence,
          status: 'planned',
          checklist: { steps, completed: steps.map(() => false) },
        })
        .returning();

      const urls =
        action.sourceUrls && action.sourceUrls.length > 0
          ? action.sourceUrls
          : [biz.websiteUrl];

      for (const url of urls) {
        await db.insert(sourceEvidence).values({
          businessId,
          recommendationId: rec.id,
          sourceUrl: url,
          sourceTitle: action.searchQueries?.[0]
            ? `Query: ${action.searchQueries[0]}`
            : 'Source Evidence',
          claim: action.evidenceSummary || action.title,
          collectedAt: new Date(),
        });
      }
    }
  }

  // ── Hand off to the ranking sweep ──────────────────────────────────────────
  // Keyword discovery just produced (or refreshed) the phrases to monitor, and
  // the graph itself never records positions. Queueing the sweep here means a
  // newly onboarded business ends up with a populated Keywords page on its own.
  let rankSweepJobId: string | null = null;
  try {
    const sweepJob = await researchQueue.add(
      'rank-sweep',
      { businessId, workspaceId },
      { deduplication: { id: `rank-sweep:${businessId}:${Math.floor(Date.now() / 600000)}` } }
    );
    rankSweepJobId = sweepJob.id ? String(sweepJob.id) : null;
  } catch (err: any) {
    // A queueing hiccup must not fail the research run: the freshness
    // reconciler picks the business up on its next pass regardless.
    console.warn(`[ResearchGraphWorker] Could not queue rank sweep for ${businessId}: ${err?.message || err}`);
  }

  return {
    businessId,
    reportId,
    rankSweepJobId,
    counts: {
      competitors: savedCompetitors,
      keywords: newKeywords.length,
      contentGaps: savedGaps,
      reviewThemes: savedThemes,
      recommendations: state.recommendations.length,
      evidenceCitations: state.evidenceLog.length,
    },
    // Surfaced so the UI can be transparent about partial runs.
    errors: state.errors,
    report: state.report,
  };
}

/**
 * Legacy starter maintained for backwards compatibility.
 * All workloads are now managed by startMainJobWorker() in main.worker.ts.
 */
export function startResearchGraphWorker() {
  return { close: async () => {} };
}
