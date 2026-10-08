import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  db,
  businesses,
  competitors,
  contentGaps,
  keywords,
  rankingObservations,
  recommendations,
  reports,
  reviewThemes,
  searchRuns,
  services,
  sourceEvidence,
  workspaces,
} from '../db/index.js';
import { getRankingsForBusiness } from './ranking.service.js';
import type {
  ContentGap,
  DetailedReportSections,
  GeneratedReport,
  RankingShiftRow,
  Recommendation,
  ReportActionRow,
  ReportCompetitorRow,
  ReportKpis,
  ReportRankingShifts,
  ReportReputationTheme,
} from '@serp-scout/types';

export interface DetailedReportInput {
  businessId: string;
  periodStart: Date;
  periodEnd: Date;
  reportId?: string | null;
  /** Executive summary and action plan produced by the agents package. */
  generated?: GeneratedReport | null;
}

/**
 * Assembles everything the detailed (multi-section) report needs from stored
 * evidence.
 *
 * The ranking section is deliberately derived from `getRankingsForBusiness`,
 * which reports the business's *own* positions per check. Reading the two newest
 * `ranking_observations` rows directly (as the first implementation did) mixed
 * competitor rows into the business's previous rank — e.g. "dental implant clinic
 * near Windsor Street" appeared to move #8 → #12 when both numbers belonged to
 * rivals — and produced nothing at all for keywords where the business does not
 * rank, which is why the table could be blank.
 */
export async function buildDetailedReport(input: DetailedReportInput): Promise<DetailedReportSections> {
  const { businessId, periodStart, periodEnd, reportId = null, generated = null } = input;

  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business) throw new Error(`Business ${businessId} not found`);

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, business.workspaceId))
    .limit(1);

  const bizServices = await db.select().from(services).where(eq(services.businessId, businessId));

  // ── Rankings: own-domain positions per check ──────────────────────────────
  const rankingRows = await getRankingsForBusiness(businessId);

  const toShiftRow = (row: (typeof rankingRows)[number]): RankingShiftRow => {
    const { currentRank, previousRank, delta } = row;
    let status: RankingShiftRow['status'];
    if (currentRank === null) {
      // Distinguish "we had a position and the newest sweep lost it" (dropped
      // out) from "we have never recorded a position" (not ranking). Both are
      // reported honestly rather than as a rank of zero.
      status = previousRank !== null ? 'dropped-out' : 'not-ranking';
    } else if (previousRank === null) {
      status = 'new';
    } else if (delta === null || delta === 0) {
      status = 'unchanged';
    } else {
      status = delta > 0 ? 'climbed' : 'declined';
    }

    return {
      keyword: row.keyword.phrase,
      location: row.keyword.location,
      intent: row.keyword.intent,
      previousRank,
      currentRank,
      // Positive = moved up the page (lower rank number is better).
      shift: currentRank !== null && previousRank !== null ? previousRank - currentRank : null,
      status,
      bestCompetitorRank: row.bestCompetitorRank,
      bestCompetitorDomain: row.bestCompetitorDomain,
      opportunityScore: row.keyword.opportunityScore,
      lastObservedAt: row.lastObservedAt ? new Date(row.lastObservedAt).toISOString() : null,
      url: row.url,
      // Position history for the sparkline; nulls are sweeps where the business
      // did not appear, so a drop-out stays visible in the line.
      trend: row.checks.map((check) => ({
        at: new Date(check.at).toISOString(),
        rank: check.rank,
      })),
    };
  };

  const shiftRows = rankingRows.map(toShiftRow);
  const ranked = shiftRows.filter((r) => r.currentRank !== null);
  const climbed = shiftRows.filter((r) => r.status === 'climbed');
  const declined = shiftRows.filter((r) => r.status === 'declined');
  const unchanged = shiftRows.filter((r) => r.status === 'unchanged');
  const newEntries = shiftRows.filter((r) => r.status === 'new');
  const droppedOut = shiftRows.filter((r) => r.status === 'dropped-out');
  // Buckets must be disjoint: "not ranking" is the never-ranked set only, so it
  // does not double-count keywords that dropped out of the results.
  const notRanking = shiftRows.filter((r) => r.status === 'not-ranking');

  const withShift = shiftRows.filter((r) => r.shift !== null) as Array<RankingShiftRow & { shift: number }>;
  const averageShift = withShift.length
    ? Math.round((withShift.reduce((a, r) => a + r.shift, 0) / withShift.length) * 10) / 10
    : null;
  const averagePosition = ranked.length
    ? Math.round((ranked.reduce((a, r) => a + (r.currentRank as number), 0) / ranked.length) * 10) / 10
    : null;

  const largestGain = withShift.filter((r) => r.shift > 0).sort((a, b) => b.shift - a.shift)[0] ?? null;
  const largestDrop = withShift.filter((r) => r.shift < 0).sort((a, b) => a.shift - b.shift)[0] ?? null;

  const periodLabel = `${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)}`;

  const rankingShifts: ReportRankingShifts = {
    summary: {
      totalTracked: shiftRows.length,
      ranked: ranked.length,
      notRanked: notRanking.length,
      climbed: climbed.length,
      declined: declined.length,
      unchanged: unchanged.length,
      newEntries: newEntries.length,
      droppedOut: droppedOut.length,
      averagePosition,
      averageShift,
      periodLabel,
    },
    distribution: {
      top3: ranked.filter((r) => (r.currentRank as number) <= 3).length,
      top4to10: ranked.filter((r) => (r.currentRank as number) >= 4 && (r.currentRank as number) <= 10).length,
      page2: ranked.filter((r) => (r.currentRank as number) >= 11 && (r.currentRank as number) <= 20).length,
      beyond: ranked.filter((r) => (r.currentRank as number) > 20).length,
    },
    // Movers first (biggest absolute movement). Only keywords with two
    // comparable checks count as movement; first readings and drop-outs are
    // listed separately so the movers table never fills with "no change" noise.
    movers: [...climbed, ...declined].sort((a, b) => Math.abs(b.shift ?? 0) - Math.abs(a.shift ?? 0)),
    unchanged: unchanged.sort((a, b) => (a.currentRank ?? 99) - (b.currentRank ?? 99)),
    newEntries,
    droppedOut,
    notRanking: notRanking.sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0)),
  };

  // ── Competitors ───────────────────────────────────────────────────────────
  const competitorRows = await db
    .select()
    .from(competitors)
    .where(eq(competitors.businessId, businessId))
    .orderBy(desc(competitors.confidenceScore));

  const mappedCompetitors: ReportCompetitorRow[] = competitorRows.map((c) => {
    const meta = (c.metadata as Record<string, any>) || {};
    return {
      name: c.name,
      domain: c.domain,
      competitorType: c.competitorType,
      status: c.status,
      confidenceScore: Math.round(c.confidenceScore),
      threatLevel: meta.threatLevel ?? null,
      threatReason: meta.threatReason ?? null,
      category: c.category ?? null,
      rating: typeof meta.rating === 'number' ? meta.rating : null,
      reviewCount: typeof meta.reviewCount === 'number' ? meta.reviewCount : null,
      distanceMiles: typeof meta.distanceMiles === 'number' ? meta.distanceMiles : null,
      proximityLabel: meta.proximityLabel ?? null,
      hasAds: Boolean(meta.hasAds),
      serpOverlapPercent: typeof meta.serpOverlapPercent === 'number' ? meta.serpOverlapPercent : null,
    };
  });

  const severeThreats = mappedCompetitors.filter((c) => c.threatLevel === 'severe').length;

  // ── Content gaps ──────────────────────────────────────────────────────────
  const gapRows = await db
    .select()
    .from(contentGaps)
    .where(eq(contentGaps.businessId, businessId))
    .orderBy(contentGaps.priority)
    .limit(20);

  const contentOpportunities: ContentGap[] = gapRows.map((g) => {
    const evidence = (g.evidence as Record<string, any>) || {};
    return {
      topic: g.topic,
      competitorDomain: evidence.competitorDomain || '',
      competitorUrl: evidence.competitorUrl || '',
      evidenceUrls: Array.isArray(evidence.evidenceUrls) ? evidence.evidenceUrls : [],
      recommendedPageType: (g.recommendedPageType as ContentGap['recommendedPageType']) || 'service',
      suggestedTitle: g.suggestedTitle || g.topic,
      suggestedHeadings: (g.suggestedHeadings as string[]) || [],
      suggestedFaqs: (g.suggestedFaqs as string[]) || [],
      targetIntent: (g.targetIntent as ContentGap['targetIntent']) || 'commercial',
      estimatedImpact: (g.impact as ContentGap['estimatedImpact']) || 'medium',
      estimatedEffort: (g.effort as ContentGap['estimatedEffort']) || 'medium',
      priority: (g.priority as ContentGap['priority']) || 'P1',
    };
  });

  // ── Actions (persisted recommendations, falling back to the fresh plan) ────
  const recRows = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.businessId, businessId))
    .orderBy(desc(recommendations.createdAt))
    .limit(20);

  const scopedRecs = reportId ? recRows.filter((r) => r.reportId === reportId) : [];
  const recSource = scopedRecs.length > 0 ? scopedRecs : recRows;

  const actionPlan: Recommendation[] = generated?.actionPlan?.length
    ? generated.actionPlan
    : recSource.slice(0, 8).map((r) => {
        const checklist = (r.checklist as { steps?: string[] } | null) || null;
        return {
          title: r.title,
          problem: r.description,
          evidenceSummary: ((r.evidence as any)?.summary as string) || r.description,
          sourceUrls: ((r.evidence as any)?.urls as string[]) || [business.websiteUrl],
          searchQueries: ((r.evidence as any)?.queries as string[]) || [],
          expectedImpact: (r.impact as Recommendation['expectedImpact']) || 'medium',
          estimatedEffort: (r.effort as Recommendation['estimatedEffort']) || 'medium',
          priority: (r.priority as Recommendation['priority']) || 'P1',
          confidence: (r.confidence as Recommendation['confidence']) || 'medium',
          suggestedOwner: 'Practice Lead',
          suggestedDeadline: r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : 'Within 7 days',
          implementationSteps: checklist?.steps,
        };
      });

  const actions: ReportActionRow[] = actionPlan.map((a, idx) => {
    const source = recSource.find((r) => r.title === a.title) || recSource[idx];
    return {
      ...a,
      id: source?.id,
      status: source?.status,
      checklist: (source?.checklist as ReportActionRow['checklist']) ?? null,
      dueDate: source?.dueDate ? new Date(source.dueDate).toISOString() : null,
    };
  });

  // ── Evidence ──────────────────────────────────────────────────────────────
  const evidenceRows = await db
    .select()
    .from(sourceEvidence)
    .where(eq(sourceEvidence.businessId, businessId))
    .orderBy(desc(sourceEvidence.collectedAt))
    .limit(60);

  const evidence = evidenceRows.length
    ? evidenceRows.map((e) => ({
        query: e.sourceTitle || e.claim.slice(0, 80),
        source: 'Source Evidence',
        date: new Date(e.collectedAt).toISOString().slice(0, 10),
        resultType: 'evidence',
        url: e.sourceUrl,
      }))
    : generated?.evidenceAppendix ?? [];

  // ── Reputation (review themes hang off competitors) ───────────────────────
  const themeRows = competitorRows.length
    ? await db
        .select()
        .from(reviewThemes)
        .where(
          inArray(
            reviewThemes.competitorId,
            competitorRows.map((c) => c.id)
          )
        )
        .limit(40)
    : [];

  const themes: ReportReputationTheme[] = themeRows.map((t) => ({
    theme: t.theme,
    sentiment: t.sentiment,
    frequency: t.frequency,
    examples: Array.isArray(t.examples) ? (t.examples as string[]).slice(0, 3) : [],
    competitorDomain: competitorRows.find((c) => c.id === t.competitorId)?.domain ?? null,
  }));

  const positiveCount = themes.filter((t) => t.sentiment === 'positive').length;
  const negativeCount = themes.filter((t) => t.sentiment === 'negative').length;
  const neutralCount = themes.length - positiveCount - negativeCount;

  // ── Observation volume + how many checks exist for this business ──────────
  const kwIds = rankingRows.map((r) => r.keyword.id);
  const observationCount = kwIds.length
    ? (
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(rankingObservations)
          .where(inArray(rankingObservations.keywordId, kwIds))
      )[0].n
    : 0;

  const runCount = (
    await db.select({ n: sql<number>`count(*)::int` }).from(searchRuns).where(eq(searchRuns.businessId, businessId))
  )[0].n;

  const relatedReports = (
    await db.select({ n: sql<number>`count(*)::int` }).from(reports).where(eq(reports.businessId, businessId))
  )[0].n;

  // ── Local 3-Pack signals ──────────────────────────────────────────────────
  const topRivalByReviews = mappedCompetitors
    .filter((c) => typeof c.reviewCount === 'number')
    .sort((a, b) => (b.reviewCount as number) - (a.reviewCount as number))[0] ?? null;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis: ReportKpis = {
    trackedKeywords: shiftRows.length,
    rankedKeywords: ranked.length,
    notRankedKeywords: notRanking.length,
    top3: rankingShifts.distribution.top3,
    top10: rankingShifts.distribution.top3 + rankingShifts.distribution.top4to10,
    averagePosition,
    improved: climbed.length,
    declined: declined.length,
    unchanged: unchanged.length,
    newEntries: newEntries.length,
    droppedOut: droppedOut.length,
    largestGain: largestGain ? { keyword: largestGain.keyword, delta: largestGain.shift } : null,
    largestDrop: largestDrop ? { keyword: largestDrop.keyword, delta: largestDrop.shift } : null,
    competitors: mappedCompetitors.length,
    severeThreats,
    contentGaps: contentOpportunities.length,
    openActions: actions.filter((a) => (a.status ?? 'planned') !== 'completed').length,
    evidenceCitations: evidence.length,
    observationCount,
  };

  const localPresence = {
    hasMapsData: mappedCompetitors.some((c) => c.proximityLabel !== null || c.distanceMiles !== null),
    threePackMentions: shiftRows.filter((r) => (r.bestCompetitorRank ?? 99) <= 3).length,
    topRivalByReviews: topRivalByReviews
      ? {
          name: topRivalByReviews.name,
          domain: topRivalByReviews.domain,
          reviewCount: topRivalByReviews.reviewCount,
          rating: topRivalByReviews.rating,
        }
      : null,
    notes: [
      `${rankingShifts.summary.ranked} of ${rankingShifts.summary.totalTracked} tracked keywords have a recorded position for ${business.name}.`,
      mappedCompetitors.length > 0
        ? `${mappedCompetitors.length} competitor(s) monitored in this market, ${severeThreats} rated a severe threat.`
        : 'No competitors have been confirmed yet, so competitive benchmarks are not available.',
      observationCount > 0
        ? `${observationCount} ranking observation(s) recorded across ${runCount} search run(s).`
        : 'No ranking observations recorded yet — run a ranking sweep to establish a baseline.',
    ].filter(Boolean),
  };

  const limitations: string[] = [];
  if (notRanking.length > 0) {
    limitations.push(
      `${notRanking.length} tracked keyword(s) have no position on record: the business did not appear in the results collected for them. This is reported as "not ranking", not as a rank of zero.`
    );
  }
  if (shiftRows.length > 0 && withShift.length === 0) {
    limitations.push(
      'No keyword has two comparable checks yet, so position shifts cannot be computed. Shifts appear once a keyword has been observed in two separate sweeps.'
    );
  }
  if (themes.length === 0) {
    limitations.push('No review themes are stored for this market, so reputation analysis is not included.');
  }
  if (!localPresence.hasMapsData) {
    limitations.push('No Maps 3-Pack distance data is stored, so geographic proximity is not quantified.');
  }
  limitations.push(
    'Positions reflect the search engine that served each sweep (SerpApi/Google or the free fallback provider); a change of provider between checks can move a position without any real ranking change.'
  );

  const methodology = [
    'Every position in this report comes from a stored search run: each sweep queries the target phrase and records the organic results for the business domain and confirmed competitors only.',
    `A "check" is one search run. Current rank is the best own-domain position in the most recent check; previous rank is the same for the preceding check, so a shift always compares two separate sweeps.`,
    'Competitor threat levels are computed from position, review volume/rating, proximity, paid-search presence and SERP overlap — never from subjective judgement.',
    'Content gaps are only reported when a competitor was observed covering the topic and the business was not.',
    'Scores and priorities are decision aids derived from the stored evidence; the evidence appendix lists every citation used.',
  ];

  return {
    meta: {
      businessName: business.name,
      websiteUrl: business.websiteUrl,
      city: business.city ?? null,
      industry: business.industry ?? null,
      country: business.country ?? null,
      services: bizServices.map((s) => s.name),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      reportId,
      workspaceName: workspace?.name ?? null,
    },
    kpis,
    rankingShifts,
    competitors: mappedCompetitors,
    contentGaps: contentOpportunities,
    reputation: {
      themes,
      positiveCount,
      negativeCount,
      neutralCount,
      summary:
        themes.length === 0
          ? 'No review themes recorded for this market yet.'
          : `${themes.length} recurring theme(s) extracted from competitor review signals: ${positiveCount} positive, ${negativeCount} negative, ${neutralCount} neutral.`,
    },
    localPresence,
    actions,
    evidence,
    methodology: [...methodology, `Baseline report count for this business: ${relatedReports}.`],
    limitations,
  };
}
