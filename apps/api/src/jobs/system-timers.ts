import { executeStaleCheck } from './stale-check.js';
import { runCatchUpReconciliation } from './catchup.js';
import { runQuotaReset } from './quota-reset.js';
import { nextQuotaResetDelayMs } from '../lib/cadence.js';

export interface SystemTimersHandle {
  close(): Promise<void>;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const CATCHUP_OFFSET_MS = 15 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_483_647; // Node.js setTimeout limit

/**
 * In-process replacements for the former BullMQ repeatable jobs.
 *
 * Recurring background work (stale evaluation, catch-up reconciliation, monthly
 * quota reset) previously ran as BullMQ repeatables on a dedicated `stale-check`
 * queue with a standing worker. Every pass is Postgres-driven, so a plain JS
 * timer is enough — and removing the repeatables + worker eliminates the
 * standing queue's constant blocking-pop polling, which was the dominant cost
 * against the 500k/month Upstash request budget.
 *
 * The handle is registered with the graceful-shutdown handler so timers are
 * cleared on SIGTERM/SIGINT.
 */
export function startSystemTimers(): SystemTimersHandle {
  let closed = false;
  const timers: NodeJS.Timeout[] = [];

  const runSafe = (label: string) => async (fn: () => Promise<unknown>) => {
    if (closed) return;
    try {
      await fn();
    } catch (error) {
      console.error(`[SystemTimer] ${label} failed:`, error);
    }
  };

  // Stale-data evaluation every 6 hours (matches the old `0 */6 * * *`).
  const staleTimer = setInterval(() => {
    void runSafe('stale-check')(() => executeStaleCheck({}));
  }, SIX_HOURS_MS);
  timers.push(staleTimer);

  // Catch-up reconciliation every 6 hours, offset so it never contends with
  // the stale pass on the same tick (matches `15 */6 * * *`). This is now the
  // driver for per-business cadence: it reads `lastAnalyzedAt` + `refreshCadence`
  // from Postgres and enqueues overdue refreshes on the research-run queue.
  const catchUpTimer = setInterval(() => {
    void runSafe('catch-up')(runCatchUpReconciliation);
  }, SIX_HOURS_MS + CATCHUP_OFFSET_MS);
  timers.push(catchUpTimer);

  // Monthly quota reset on the 1st at 00:05 UTC (`5 0 1 * *`). If the delay
  // exceeds Node's max timeout, we sleep in chunks to avoid integer overflow.
  const armQuotaReset = async (now: Date = new Date()) => {
    if (closed) return;
    let delay = nextQuotaResetDelayMs(now);
    while (delay > MAX_TIMEOUT_MS && !closed) {
      await new Promise((resolve) => {
        const chunk = setTimeout(resolve, MAX_TIMEOUT_MS);
        timers.push(chunk);
      });
      if (closed) return;
      delay = nextQuotaResetDelayMs(new Date());
    }
    if (closed) return;
    const t = setTimeout(async () => {
      await runSafe('quota-reset')(runQuotaReset);
      void armQuotaReset(new Date());
    }, delay);
    timers.push(t);
  };
  void armQuotaReset(new Date());

  return {
    async close() {
      closed = true;
      for (const timer of timers) clearTimeout(timer);
    },
  };
}