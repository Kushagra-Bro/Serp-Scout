import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import {
  db,
  businesses,
  competitors,
  keywords,
  searchRuns,
  searchResults,
  rankingObservations,
} from '../db/index.js';
import { executeSearchRun } from './search-run.service.js';
import { classifySearchError } from '../lib/search-errors.js';

export interface KeywordRankingDetail {
  keyword: {
    id: string;
    phrase: string;
    location: string | null;
    intent: string | null;
    status: string;
    opportunityScore: number;
    createdAt: Date;
  };
  currentRank: number | null;
  previousRank: number | null;
  delta: number | null;
  resultType: string | null;
  url: string | null;
  serpFeatures: string[] | null;
  lastObservedAt: Date | null;
  /** When this phrase was last swept, whether or not the business appeared. */
  lastCheckedAt: Date | null;
  /**
   * True when the newest sweep of this phrase produced no position for the
   * business, so `currentRank` is null and `previousRank` holds the last known
   * position. Distinct from "never checked".
   */
  absentFromLatestCheck: boolean;
  /**
   * Chronological position history for this keyword (oldest first): one entry per
   * sweep of the phrase, with `rank: null` where the business did not appear.
   * Capped to the most recent MAX_TREND_POINTS checks.
   */
  checks: Array<{ at: Date; rank: number | null }>;
  bestCompetitorRank: number | null;
  bestCompetitorDomain: string | null;
}

/** How many past checks a keyword's trend keeps (sparkline width in the report). */
export const MAX_TREND_POINTS = 12;

export function extractDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.replace(/^www\./, '').toLowerCase();
  }
}

/**
 * Records ranking observations for a keyword from a search run's results
 */
export async function recordRankingObservations(params: {
  businessId: string;
  keywordId: string;
  searchRunId?: string | null;
  results: {
    rank: number;
    url: string;
    domain: string;
    resultType?: string;
    serpFeatures?: string[];
  }[];
}) {
  const { businessId, keywordId, searchRunId, results } = params;

  // 1. Fetch business and its confirmed competitors
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!biz) return [];

  const userDomain = extractDomainFromUrl(biz.websiteUrl);

  const compList = await db
    .select()
    .from(competitors)
    .where(eq(competitors.businessId, businessId));

  const competitorDomains = new Set(compList.map((c) => c.domain.toLowerCase()));

  // 2. Identify observations for user business and competitors
  const recorded = [];

  for (const item of results) {
    const itemDomain = item.domain.toLowerCase();
    const isUserDomain = itemDomain.includes(userDomain) || userDomain.includes(itemDomain);
    const isCompetitor = competitorDomains.has(itemDomain);

    if (isUserDomain || isCompetitor) {
      // Find prior observation to track delta
      const [previous] = await db
        .select()
        .from(rankingObservations)
        .where(
          and(
            eq(rankingObservations.keywordId, keywordId),
            eq(rankingObservations.domain, itemDomain)
          )
        )
        .orderBy(desc(rankingObservations.observedAt))
        .limit(1);

      const [obs] = await db
        .insert(rankingObservations)
        .values({
          businessId,
          keywordId,
          domain: itemDomain,
          url: item.url,
          rank: item.rank,
          resultType: item.resultType || 'organic',
          serpFeatures: item.serpFeatures ? item.serpFeatures : [],
          searchRunId: searchRunId || null,
        })
        .returning();

      const delta = previous ? previous.rank - item.rank : null; // positive = improvement (e.g. 5 -> 3 = +2)

      recorded.push({
        observation: obs,
        previousRank: previous?.rank ?? null,
        delta,
        isUserDomain,
      });
    }
  }

  return recorded;
}

/**
 * Retrieves all keywords for a business with their latest ranking status & deltas
 */
export async function getRankingsForBusiness(
  businessId: string,
  statusFilter?: string
): Promise<KeywordRankingDetail[]> {
  const conditions = [eq(keywords.businessId, businessId)];
  if (statusFilter) {
    conditions.push(eq(keywords.status, statusFilter));
  }

  const keywordList = await db
    .select()
    .from(keywords)
    .where(and(...conditions))
    .orderBy(desc(keywords.opportunityScore));

  if (keywordList.length === 0) {
    return [];
  }

  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const userDomain = biz ? extractDomainFromUrl(biz.websiteUrl) : '';

  const compList = await db
    .select()
    .from(competitors)
    .where(eq(competitors.businessId, businessId));
  const competitorDomains = new Set(compList.map((c) => c.domain.toLowerCase()));

  const keywordIds = keywordList.map((k) => k.id);

  // Fetch all recent observations for these keywords
  const allObservations = await db
    .select()
    .from(rankingObservations)
    .where(inArray(rankingObservations.keywordId, keywordIds))
    .orderBy(desc(rankingObservations.observedAt));

  // When was each phrase swept? A sweep newer than our newest own-domain
  // observation means the business was absent from that sweep, so the previous
  // position is history rather than the current rank. The full sweep list is kept
  // per phrase so each keyword can carry a real position trend.
  const phraseList = keywordList.map((k) => k.phrase);
  const runRows = phraseList.length
    ? await db
        .select({
          id: searchRuns.id,
          query: searchRuns.query,
          requestedAt: searchRuns.requestedAt,
        })
        .from(searchRuns)
        .where(and(eq(searchRuns.businessId, businessId), inArray(searchRuns.query, phraseList)))
    : [];

  const sweepsByPhrase = new Map<string, Array<{ runId: string; at: number }>>();
  for (const run of runRows) {
    const key = run.query.trim().toLowerCase();
    const list = sweepsByPhrase.get(key) ?? [];
    list.push({ runId: run.id, at: new Date(run.requestedAt).getTime() });
    sweepsByPhrase.set(key, list);
  }

  const lastSweptAtByPhrase = new Map<string, number>();
  for (const [key, sweeps] of sweepsByPhrase) {
    lastSweptAtByPhrase.set(key, Math.max(...sweeps.map((s) => s.at)));
  }

  const result: KeywordRankingDetail[] = [];

  for (const kw of keywordList) {
    const kwObs = allObservations.filter((o) => o.keywordId === kw.id);

    // Find observations for user's domain
    const userObsList = kwObs.filter(
      (o) => o.domain.toLowerCase().includes(userDomain) || userDomain.includes(o.domain.toLowerCase())
    );

    // Group the business's own observations by the search run that produced
    // them. `currentRank` must be the *best* position seen in the most recent
    // check, not whichever row was inserted last: a single SERP can contain the
    // same domain several times (e.g. #1 and #6), and ordering by observedAt
    // DESC then reported the worst of them while showing the runner-up as
    // "previous" — a fake delta computed inside one check.
    const checksByRun = new Map<
      string,
      { rank: number; observedAt: Date; obs: (typeof userObsList)[number] }
    >();
    for (const obs of userObsList) {
      const key = obs.searchRunId ?? `observation:${obs.id}`;
      const observedAt = new Date(obs.observedAt);
      const existing = checksByRun.get(key);
      if (!existing) {
        checksByRun.set(key, { rank: obs.rank, observedAt, obs });
      } else {
        if (obs.rank < existing.rank) {
          existing.rank = obs.rank;
          existing.obs = obs;
        }
        if (observedAt.getTime() > existing.observedAt.getTime()) existing.observedAt = observedAt;
      }
    }

    const checks = [...checksByRun.values()].sort(
      (a, b) => b.observedAt.getTime() - a.observedAt.getTime()
    );
    const latestCheck = checks[0] ?? null;
    const previousCheck = checks[1] ?? null;

    // A sweep for this phrase that ran after our newest own-domain observation
    // means the business did not appear in it. Reporting the older position as
    // "current" would be stale, so the row becomes absent-from-latest-check and
    // the last known position moves to `previousRank`.
    const lastSweptAt = lastSweptAtByPhrase.get(kw.phrase.trim().toLowerCase()) ?? null;
    const absentFromLatestCheck =
      lastSweptAt !== null && (latestCheck === null || lastSweptAt > latestCheck.observedAt.getTime());

    const currentRank = absentFromLatestCheck ? null : latestCheck ? latestCheck.rank : null;
    const previousRank = absentFromLatestCheck
      ? latestCheck
        ? latestCheck.rank
        : null
      : previousCheck
        ? previousCheck.rank
        : null;

    const delta =
      currentRank !== null && previousRank !== null ? previousRank - currentRank : null;

    // Find best competitor observation
    const competitorObs = kwObs
      .filter((o) => competitorDomains.has(o.domain.toLowerCase()))
      .sort((a, b) => a.rank - b.rank);

    const bestComp = competitorObs[0] || null;

    // Position trend: one point per sweep of this phrase, chronological. Sweeps
    // where the business did not appear become `rank: null` gap points, and any
    // own observation whose run is missing from the sweep list is folded in so
    // legacy rows still produce a line.
    const trendByRun = new Map<string, { at: number; rank: number | null }>();
    for (const sweep of sweepsByPhrase.get(kw.phrase.trim().toLowerCase()) ?? []) {
      trendByRun.set(sweep.runId, { at: sweep.at, rank: null });
    }
    for (const check of checksByRun.values()) {
      const runId = check.obs.searchRunId ?? `observation:${check.obs.id}`;
      const existing = trendByRun.get(runId);
      if (existing) {
        existing.rank = check.rank;
      } else {
        trendByRun.set(runId, { at: check.observedAt.getTime(), rank: check.rank });
      }
    }

    const trend = [...trendByRun.values()]
      .sort((a, b) => a.at - b.at)
      .slice(-MAX_TREND_POINTS);

    result.push({
      keyword: {
        id: kw.id,
        phrase: kw.phrase,
        location: kw.location,
        intent: kw.intent,
        status: kw.status,
        opportunityScore: kw.opportunityScore,
        createdAt: kw.createdAt,
      },
      currentRank,
      previousRank,
      delta,
      resultType: latestCheck ? latestCheck.obs.resultType : null,
      url: latestCheck ? latestCheck.obs.url : null,
      serpFeatures: (latestCheck?.obs.serpFeatures as string[]) || null,
      lastObservedAt: latestCheck ? latestCheck.observedAt : null,
      lastCheckedAt: lastSweptAt !== null ? new Date(lastSweptAt) : null,
      absentFromLatestCheck,
      checks: trend.map((point) => ({ at: new Date(point.at), rank: point.rank })),
      bestCompetitorRank: bestComp ? bestComp.rank : null,
      bestCompetitorDomain: bestComp ? bestComp.domain : null,
    });
  }

  return result;
}

/**
 * Refreshes ranking observations for the least-recently-checked tracking,
 * approved and candidate keywords (capped per pass to respect search quotas).
 */
export async function refreshKeywordRankings(params: {
  businessId: string;
  workspaceId: string;
  searchType?: 'google' | 'google_maps';
}): Promise<{
  refreshedCount: number;
  failedCount: number;
  failures: Array<{ phrase: string; error: string }>;
  /** Observations written for this business's own domain or a confirmed rival. */
  observationsRecorded: number;
  /** Monitored keywords that still have no stored check at all after this pass. */
  uncheckedRemaining: number;
  /** True when the search meter/provider refused a query, so the sweep stopped early. */
  quotaExhausted: boolean;
  details: KeywordRankingDetail[];
}> {
  const { businessId, workspaceId, searchType = 'google' } = params;

  // 1. Get every keyword that should be monitored. The cap below protects the
  //    search quota, so the slice must rotate instead of pinning the same first
  //    ten rows forever — otherwise most of a large keyword set can never
  //    accumulate a single observation.
  //
  //    Staleness is read from `search_runs` (one row per checked phrase), not
  //    from `ranking_observations`: an observation only exists when the business
  //    or a confirmed competitor actually appeared in the results, so
  //    observation timestamps would keep re-selecting the same unrankable
  //    keywords and starve every keyword that can produce data.
  const eligibleKeywords = await db
    .select()
    .from(keywords)
    .where(
      and(
        eq(keywords.businessId, businessId),
        inArray(keywords.status, ['tracking', 'approved', 'candidate'])
      )
    )
    .orderBy(desc(keywords.opportunityScore));

  const lastCheckedAt = new Map<string, number>();
  if (eligibleKeywords.length > 0) {
    const runs = await db
      .select({ query: searchRuns.query, requestedAt: searchRuns.requestedAt })
      .from(searchRuns)
      .where(
        and(
          eq(searchRuns.businessId, businessId),
          inArray(
            searchRuns.query,
            eligibleKeywords.map((k) => k.phrase)
          )
        )
      );

    for (const run of runs) {
      const key = run.query.trim().toLowerCase();
      const at = new Date(run.requestedAt).getTime();
      if (at > (lastCheckedAt.get(key) ?? 0)) lastCheckedAt.set(key, at);
    }
  }

  const activeKeywords = [...eligibleKeywords]
    .sort((a, b) => {
      const aChecked = lastCheckedAt.get(a.phrase.trim().toLowerCase()) ?? 0;
      const bChecked = lastCheckedAt.get(b.phrase.trim().toLowerCase()) ?? 0;
      if (aChecked !== bChecked) return aChecked - bChecked; // never/least recently checked first
      return b.opportunityScore - a.opportunityScore;
    })
    .slice(0, 10); // cap per refresh to respect quotas

  // Keywords that have never been checked at all. `runRankSweep` loops on this
  // to give a freshly onboarded business a complete ranking table automatically.
  const uncheckedBefore = eligibleKeywords.filter(
    (k) => !lastCheckedAt.has(k.phrase.trim().toLowerCase())
  ).length;

  let refreshedCount = 0;
  let observationsRecorded = 0;
  let quotaExhausted = false;
  const failures: Array<{ phrase: string; error: string }> = [];

  for (const kw of activeKeywords) {
    try {
      const runResult = await executeSearchRun({
        businessId,
        workspaceId,
        searchType,
        query: kw.phrase,
        location: kw.location || undefined,
        num: 20,
      });

      // Fetch search results saved in database
      const dbResults = await db
        .select()
        .from(searchResults)
        .where(eq(searchResults.searchRunId, runResult.run.id));

      const recorded = await recordRankingObservations({
        businessId,
        keywordId: kw.id,
        searchRunId: runResult.run.id,
        results: dbResults.map((r) => ({
          rank: r.rank,
          url: r.url,
          domain: r.domain,
          resultType: r.resultType,
        })),
      });
      observationsRecorded += recorded.length;

      refreshedCount++;
    } catch (err: any) {
      // Never fail silently: the caller surfaces this so a quota/provider
      // outage does not masquerade as "0 keywords refreshed" success.
      const message = err?.message || String(err);
      if (classifySearchError(err) !== 'other') quotaExhausted = true;
      console.warn(`Failed to refresh ranking for keyword "${kw.phrase}":`, err);
      failures.push({ phrase: kw.phrase, error: message });
    }
  }

  const updatedDetails = await getRankingsForBusiness(businessId);

  return {
    refreshedCount,
    failedCount: failures.length,
    failures,
    observationsRecorded,
    // A failed query still leaves its `search_runs` row behind (the run is
    // recorded before the provider is called), so both outcomes count as
    // "checked" — otherwise one flaky phrase would keep the sweep retrying
    // forever without ever completing coverage.
    uncheckedRemaining: Math.max(0, uncheckedBefore - refreshedCount - failures.length),
    quotaExhausted,
    details: updatedDetails,
  };
}

export interface RankSweepResult {
  passes: number;
  keywordsChecked: number;
  observationsRecorded: number;
  failedCount: number;
  failures: Array<{ phrase: string; error: string }>;
  /** Monitored keywords still without any stored check once the sweep stopped. */
  uncheckedRemaining: number;
  quotaExhausted: boolean;
  /** True when the wall-clock budget stopped the sweep before coverage completed. */
  timedOut: boolean;
}

/**
 * Runs back-to-back ranking passes until every monitored keyword has been
 * checked at least once, or the per-sweep budget / search quota stops it.
 *
 * `refreshKeywordRankings` is capped at ten keywords per pass so a single
 * request can never spend an unbounded number of searches; this loop is what
 * lets the background scheduler produce a complete, pre-computed ranking table
 * for a business without anyone pressing "Refresh Rankings".
 */
export async function runRankSweep(params: {
  businessId: string;
  workspaceId: string;
  searchType?: 'google' | 'google_maps';
  /** Hard cap on keywords checked in one sweep (10-100). */
  maxKeywords?: number;
  /** Hard cap on wall-clock time, so the job always finishes inside its lock. */
  maxDurationMs?: number;
}): Promise<RankSweepResult> {
  const {
    businessId,
    workspaceId,
    searchType = 'google',
    maxKeywords = 60,
    maxDurationMs = 3 * 60 * 1000,
  } = params;
  const budget = Math.max(10, Math.min(maxKeywords, 100));
  const startedAt = Date.now();

  let passes = 0;
  let keywordsChecked = 0;
  let observationsRecorded = 0;
  let failedCount = 0;
  let uncheckedRemaining = 0;
  let quotaExhausted = false;
  let timedOut = false;
  const failures: Array<{ phrase: string; error: string }> = [];

  while (keywordsChecked < budget && !quotaExhausted) {
    if (Date.now() - startedAt > maxDurationMs) {
      timedOut = true;
      break;
    }

    const pass = await refreshKeywordRankings({ businessId, workspaceId, searchType });
    passes++;
    keywordsChecked += pass.refreshedCount;
    observationsRecorded += pass.observationsRecorded;
    failedCount += pass.failedCount;
    failures.push(...pass.failures);
    uncheckedRemaining = pass.uncheckedRemaining;
    quotaExhausted = pass.quotaExhausted;

    // Nothing left to check at all (no monitored keywords, or an empty pass).
    if (pass.refreshedCount === 0 && pass.failedCount === 0) break;
    // Every monitored keyword now has at least one stored check.
    if (pass.uncheckedRemaining === 0) break;
  }

  return {
    passes,
    keywordsChecked,
    observationsRecorded,
    failedCount,
    failures: failures.slice(0, 10),
    uncheckedRemaining,
    quotaExhausted,
    timedOut,
  };
}
