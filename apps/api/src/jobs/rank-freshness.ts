import { and, eq, inArray } from 'drizzle-orm';
import { db, businesses, keywords, searchRuns, workspaces } from '../db/index.js';
import { researchQueue, researchGraphQueue } from './queues.js';
import { env } from '../config/env.js';
import { withTimeoutFallback, QUEUE_OP_TIMEOUT_MS } from '../lib/async-timeout.js';

/**
 * How long a stored rank position stays "current" before it is refreshed.
 * Ranking sweeps run on the free organic engine when one is configured, so this
 * is deliberately short: the point of the monitoring view is that the numbers
 * are already there when the user opens it.
 */
export const RANK_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/** Bounds a single reconciliation pass so a cold start cannot flood the queue. */
const MAX_ENQUEUES_PER_PASS = 25;

/** Bounds the per-pass table scan; new businesses are picked up on later passes. */
const MAX_BUSINESSES_PER_PASS = 200;

/**
 * Dedupe window for queueing sweeps. The id is time-bucketed rather than plain
 * per-business: a job orphaned by a crashed worker stays "active" (and keeps its
 * dedupe key) until BullMQ's stalled-job detection reaps it, and a plain id
 * would silently swallow every later sweep for that business until then.
 */
const SWEEP_DEDUPE_WINDOW_MS = 60 * 60 * 1000;

function sweepDedupeId(businessId: string, now: Date): string {
  return `rank-sweep:${businessId}:${Math.floor(now.getTime() / SWEEP_DEDUPE_WINDOW_MS)}`;
}

const MONITORED_STATUSES = ['tracking', 'approved', 'candidate'];

/**
 * True when organic sweeps cost the workspace nothing. Tavily is a free tier for
 * this app, so its presence is what makes tight, automatic refresh intervals
 * affordable; with SerpApi alone the scheduler competes with the user's meter.
 */
const FREE_ORGANIC_ENGINE = Boolean(env.TAVILY_API_KEY);

export interface RankFreshnessDecision {
  businessId: string;
  businessName: string;
  action: 'rank-sweep' | 'discover-keywords' | 'skip';
  reason: string;
  monitoredKeywords: number;
  uncheckedKeywords: number;
  oldestCheckAgeHours: number | null;
}

export interface RankFreshnessResult {
  checked: number;
  enqueued: number;
  skippedManual: number;
  missingKeywords: number;
  decisions: RankFreshnessDecision[];
}

/**
 * Keeps ranking positions pre-computed for every monitored business.
 *
 * Postgres is the source of truth: a business needs a sweep when at least one
 * monitored keyword has never been checked, or when its oldest check is older
 * than `RANK_FRESHNESS_MS`. Businesses with no keywords (a brand-new profile)
 * get the research pipeline instead, which discovers the keywords to monitor and
 * then hands off to a sweep.
 *
 * A workspace on the `manual` cadence is never touched — that setting is the
 * user's explicit "don't spend my searches automatically" switch.
 *
 * Safe to call on every boot and on a timer: enqueues are deduplicated by
 * business, so overlapping passes collapse into one job.
 */
export async function runRankFreshnessReconciliation(
  options: {
    now?: Date;
    dryRun?: boolean;
    maxEnqueues?: number;
    freshnessMs?: number;
  } = {}
): Promise<RankFreshnessResult> {
  const now = options.now ?? new Date();
  const freshnessMs = options.freshnessMs ?? RANK_FRESHNESS_MS;
  const maxEnqueues = options.maxEnqueues ?? MAX_ENQUEUES_PER_PASS;
  const dryRun = options.dryRun ?? false;

  const rows = await db
    .select({
      businessId: businesses.id,
      businessName: businesses.name,
      websiteUrl: businesses.websiteUrl,
      workspaceId: businesses.workspaceId,
      cadence: workspaces.refreshCadence,
      usedQuota: workspaces.usedQuota,
      monthlyQuota: workspaces.monthlyQuota,
    })
    .from(businesses)
    .innerJoin(workspaces, eq(businesses.workspaceId, workspaces.id))
    .limit(MAX_BUSINESSES_PER_PASS);

  const result: RankFreshnessResult = {
    checked: rows.length,
    enqueued: 0,
    skippedManual: 0,
    missingKeywords: 0,
    decisions: [],
  };

  for (const row of rows) {
    const monitored = await db
      .select({ id: keywords.id, phrase: keywords.phrase })
      .from(keywords)
      .where(
        and(
          eq(keywords.businessId, row.businessId),
          inArray(keywords.status, MONITORED_STATUSES)
        )
      );

    if (row.cadence === 'manual') {
      result.skippedManual++;
      result.decisions.push({
        businessId: row.businessId,
        businessName: row.businessName,
        action: 'skip',
        reason: 'workspace cadence is manual',
        monitoredKeywords: monitored.length,
        uncheckedKeywords: 0,
        oldestCheckAgeHours: null,
      });
      continue;
    }

    // Brand-new profile: nothing to rank yet, so discover keywords (and
    // competitors) first. That run queues its own follow-up sweep.
    if (monitored.length === 0) {
      result.missingKeywords++;
      const withinCap = result.enqueued < maxEnqueues;
      if (withinCap) {
        result.enqueued++;
        if (!dryRun) {
          // Bounded: a Redis outage must not stall the reconciliation pass.
          const queued = await withTimeoutFallback(
            researchGraphQueue
              .add(
                'run-research-graph',
                { businessId: row.businessId, workspaceId: row.workspaceId, persistReport: true },
                { deduplication: { id: `rank-freshness:graph:${row.businessId}` } }
              )
              .then(() => true)
              .catch((err: any) => {
                console.warn(
                  `[RankFreshness] Could not queue keyword discovery for ${row.businessName}: ${err?.message || err}`
                );
                return false;
              }),
            QUEUE_OP_TIMEOUT_MS,
            false,
            'rankFreshness.addResearchGraph'
          );
          if (!queued) result.enqueued--;
        }
      }
      result.decisions.push({
        businessId: row.businessId,
        businessName: row.businessName,
        action: 'discover-keywords',
        reason: withinCap ? 'no monitored keywords yet' : 'deferred: burst cap reached',
        monitoredKeywords: 0,
        uncheckedKeywords: 0,
        oldestCheckAgeHours: null,
      });
      continue;
    }

    const runs = await db
      .select({ query: searchRuns.query, requestedAt: searchRuns.requestedAt })
      .from(searchRuns)
      .where(
        and(
          eq(searchRuns.businessId, row.businessId),
          inArray(
            searchRuns.query,
            monitored.map((k) => k.phrase)
          )
        )
      );

    const lastCheckedAt = new Map<string, number>();
    for (const run of runs) {
      const key = run.query.trim().toLowerCase();
      const at = new Date(run.requestedAt).getTime();
      if (at > (lastCheckedAt.get(key) ?? 0)) lastCheckedAt.set(key, at);
    }

    const uncheckedKeywords = monitored.filter(
      (k) => !lastCheckedAt.has(k.phrase.trim().toLowerCase())
    ).length;
    const checkedTimes = monitored
      .map((k) => lastCheckedAt.get(k.phrase.trim().toLowerCase()))
      .filter((t): t is number => typeof t === 'number' && t > 0);
    const oldestCheck =
      uncheckedKeywords > 0 && checkedTimes.length === 0
        ? null
        : checkedTimes.length > 0
          ? new Date(Math.min(...checkedTimes))
          : null;
    const oldestCheckAgeHours = oldestCheck
      ? Math.round(((now.getTime() - oldestCheck.getTime()) / 3_600_000) * 10) / 10
      : null;

    const needsSweep =
      uncheckedKeywords > 0 ||
      oldestCheck === null ||
      now.getTime() - oldestCheck.getTime() > freshnessMs;

    if (!needsSweep) {
      result.decisions.push({
        businessId: row.businessId,
        businessName: row.businessName,
        action: 'skip',
        reason: 'all keywords checked within the freshness window',
        monitoredKeywords: monitored.length,
        uncheckedKeywords,
        oldestCheckAgeHours,
      });
      continue;
    }

    let reason: string;
    if (uncheckedKeywords > 0) {
      reason = `${uncheckedKeywords} keyword(s) never checked`;
    } else if (oldestCheck === null) {
      reason = 'no stored checks yet';
    } else {
      reason = `oldest check ${oldestCheckAgeHours}h old`;
    }

    // Cost guard. Ranking sweeps are free while a free organic engine is
    // configured (Tavily); with SerpApi alone every check costs a meter unit, so
    // a workspace that is out of quota is left alone instead of being drained by
    // the scheduler. The sweep marks the business stale when it hits the wall.
    if (!FREE_ORGANIC_ENGINE && row.usedQuota >= row.monthlyQuota) {
      result.decisions.push({
        businessId: row.businessId,
        businessName: row.businessName,
        action: 'skip',
        reason: `${reason} — skipped: workspace search quota exhausted (${row.usedQuota}/${row.monthlyQuota})`,
        monitoredKeywords: monitored.length,
        uncheckedKeywords,
        oldestCheckAgeHours,
      });
      continue;
    }

    if (result.enqueued >= maxEnqueues) {
      reason += ' (deferred: burst cap reached)';
    } else if (!dryRun) {
      // Bounded so an unreachable Redis cannot hang the scheduler pass.
      const queued = await withTimeoutFallback(
        researchQueue
          .add(
            'rank-sweep',
            { businessId: row.businessId, workspaceId: row.workspaceId },
            { deduplication: { id: sweepDedupeId(row.businessId, now) } }
          )
          .then(() => true)
          .catch((err: any) => {
            console.warn(`[RankFreshness] Could not queue rank sweep for ${row.businessName}: ${err?.message || err}`);
            return false;
          }),
        QUEUE_OP_TIMEOUT_MS,
        false,
        'rankFreshness.addSweep'
      );
      if (queued) result.enqueued++;
      else reason += ' (queue unavailable)';
    } else {
      result.enqueued++;
    }

    result.decisions.push({
      businessId: row.businessId,
      businessName: row.businessName,
      action: 'rank-sweep',
      reason,
      monitoredKeywords: monitored.length,
      uncheckedKeywords,
      oldestCheckAgeHours,
    });
  }

  if (result.enqueued > 0) {
    console.log(
      `[RankFreshness] ${dryRun ? 'Would enqueue' : 'Enqueued'} ${result.enqueued} job(s) across ` +
        `${result.checked} business(es) (${result.skippedManual} manual, ` +
        `${result.missingKeywords} awaiting keyword discovery).`
    );
  }

  return result;
}
