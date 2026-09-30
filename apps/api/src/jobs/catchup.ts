import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { researchQueue } from './queues.js';
import { db, workspaces, businesses } from '../db/index.js';

/**
 * Catch-up reconciliation.
 *
 * BullMQ repeatable jobs only execute while a worker process is running, so any
 * occurrence that came due while the API was down is skipped — BullMQ computes
 * the next occurrence from `max(prevMillis, now)` and jumps to the next *future*
 * slot rather than replaying missed ones. This module repairs that gap by
 * treating Postgres (`lastAnalyzedAt` + `refreshCadence`) as the source of truth
 * and enqueueing a refresh for any business whose data is older than its cadence.
 *
 * Because it reads the database rather than Redis, it still converges after a
 * full Redis wipe, a multi-day outage, or a lost repeat job.
 */
export const CADENCE_INTERVAL_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

/**
 * A delayed job only counts as "already on the way" if it is due inside this
 * window. A repeat job scheduled for tomorrow must NOT block a catch-up (that
 * would leave a 3-day-old business stale for another day), but an overdue one
 * that the worker is about to promote must.
 */
const DELAYED_HORIZON_MS = 15 * 60 * 1000;

export interface CatchUpResult {
  checked: number;
  fresh: number;
  /** Cadence is 'manual' (or unknown) — nothing is expected to run. */
  offCadence: number;
  /** Never analyzed; onboarding seeds this, so we never auto-spend credits. */
  neverAnalyzed: number;
  alreadyPending: number;
  enqueued: number;
  enqueuedBusinessIds: string[];
}

export function getCatchUpIntervalMs(cadence?: string | null): number | null {
  if (!cadence) return null;
  return CADENCE_INTERVAL_MS[cadence] ?? null;
}

export function isBusinessOverdue(params: {
  cadence?: string | null;
  lastAnalyzedAt?: Date | string | null;
  now: Date;
}): boolean {
  const interval = getCatchUpIntervalMs(params.cadence);
  if (interval === null) return false;
  if (!params.lastAnalyzedAt) return false;

  const last = new Date(params.lastAnalyzedAt).getTime();
  if (Number.isNaN(last)) return false;

  return params.now.getTime() - last > interval;
}

/** When a job will become runnable: its creation time plus any delay.
 *
 * `Job.fromJSON` populates a top-level `delay` (NaN when the job has none) and
 * keeps `opts.delay` for some creation paths, so both are consulted. `state` is
 * deliberately NOT read: `getJobs()` never populates it, which is why each
 * state is fetched separately below.
 */
function jobDueAt(job: Job): number {
  const created = Number.isFinite(job.timestamp) ? job.timestamp : 0;
  const candidates = [job.delay, job.opts?.delay];
  const delay = candidates.find((d) => typeof d === 'number' && Number.isFinite(d));
  return created + (delay ?? 0);
}

/**
 * Business ids that already have a research run queued or in flight.
 *
 * Only near-term jobs count: anything active/waiting/prioritized, plus delayed
 * jobs due within DELAYED_HORIZON_MS. Far-future repeat jobs are ignored so a
 * tomorrow's-schedule cannot mask genuinely overdue data.
 */
async function getImminentBusinessIds(now: Date): Promise<Set<string>> {
  const [active, waiting, prioritized, delayed] = await Promise.all([
    researchQueue.getJobs(['active']),
    researchQueue.getJobs(['waiting']),
    researchQueue.getJobs(['prioritized']),
    researchQueue.getJobs(['delayed']),
  ]);

  const ids = new Set<string>();
  const horizon = now.getTime() + DELAYED_HORIZON_MS;

  const add = (job: Job) => {
    const businessId = job?.data?.businessId;
    if (typeof businessId === 'string' && businessId) ids.add(businessId);
  };

  for (const job of [...active, ...waiting, ...prioritized]) add(job);

  // A delayed job only counts if it is already due or about to be: an overdue
  // repeat is about to be promoted by the worker (so no second job is needed),
  // while tomorrow's repeat must not block the catch-up.
  for (const job of delayed) {
    if (jobDueAt(job) > horizon) continue;
    add(job);
  }

  return ids;
}

/**
 * Enqueues a refresh for every business whose data is older than its cadence.
 *
 * Safe to call on every boot and on a timer:
 *  - healthy businesses cost one DB query and enqueue nothing;
 *  - repeated invocations are deduplicated by BullMQ while a job is in flight
 *    (the dedup key is deleted on completion/failure, so retries stay possible);
 *  - businesses already covered by a queued run are skipped entirely.
 */
export async function runCatchUpReconciliation(now: Date = new Date()): Promise<CatchUpResult> {
  const rows = await db
    .select({
      businessId: businesses.id,
      businessName: businesses.name,
      workspaceId: businesses.workspaceId,
      lastAnalyzedAt: businesses.lastAnalyzedAt,
      cadence: workspaces.refreshCadence,
    })
    .from(businesses)
    .innerJoin(workspaces, eq(businesses.workspaceId, workspaces.id));

  const result: CatchUpResult = {
    checked: rows.length,
    fresh: 0,
    offCadence: 0,
    neverAnalyzed: 0,
    alreadyPending: 0,
    enqueued: 0,
    enqueuedBusinessIds: [],
  };

  const overdue = rows.filter((row) => {
    const interval = getCatchUpIntervalMs(row.cadence);
    if (interval === null) {
      result.offCadence++;
      return false;
    }
    if (!row.lastAnalyzedAt) {
      result.neverAnalyzed++;
      return false;
    }
    if (!isBusinessOverdue({ cadence: row.cadence, lastAnalyzedAt: row.lastAnalyzedAt, now })) {
      result.fresh++;
      return false;
    }
    return true;
  });

  if (overdue.length === 0) return result;

  // Read the queue only when something is actually overdue.
  const imminent = await getImminentBusinessIds(now);

  for (const row of overdue) {
    if (imminent.has(row.businessId)) {
      result.alreadyPending++;
      continue;
    }

    await researchQueue.add(
      'catch-up-refresh',
      {
        businessId: row.businessId,
        workspaceId: row.workspaceId,
        triggerReport: true,
      },
      {
        // Dedupes concurrent boots / the 6h timer / multi-replica deployments
        // without ever blocking future runs after this one finishes.
        deduplication: { id: `catchup:${row.businessId}` },
      }
    );

    result.enqueued++;
    result.enqueuedBusinessIds.push(row.businessId);
    console.log(
      `[CatchUp] Business "${row.businessName}" (${row.businessId}) is past its ` +
        `"${row.cadence}" cadence (last analyzed ${row.lastAnalyzedAt}) — enqueued refresh.`
    );
  }

  if (result.enqueued > 0 || result.alreadyPending > 0) {
    console.log(
      `[CatchUp] Reconciliation finished: ${result.enqueued} enqueued, ` +
        `${result.alreadyPending} already pending, ${result.fresh} fresh, ` +
        `${result.offCadence} off-cadence, ${result.neverAnalyzed} never analyzed.`
    );
  }

  return result;
}
