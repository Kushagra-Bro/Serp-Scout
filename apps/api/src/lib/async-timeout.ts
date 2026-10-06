/**
 * Timeouts for Redis-backed queue calls.
 *
 * The shared ioredis connection is created with `maxRetriesPerRequest: null` —
 * required by BullMQ workers, which must retry forever rather than fail. The
 * side effect is that every *other* command issued while Redis is unreachable
 * (a DNS hiccup, an Upstash blip, a laptop waking up) waits indefinitely instead
 * of failing: `/api/jobs` never answers, the UI spins forever, and the
 * reconcilers stall mid-pass.
 *
 * These helpers give callers a bounded wait with an explicit fallback, so an
 * outage degrades into "nothing to report yet" instead of a hang, while the
 * worker connections keep reconnecting in the background as designed.
 */

/** Bounded wait; resolves with `fallback` if the promise has not settled in time. */
export async function withTimeoutFallback<T>(
  promise: PromiseLike<T>,
  ms: number,
  fallback: T,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  // The abandoned promise must not surface as an unhandled rejection once the
  // caller has already moved on with the fallback.
  const guarded = Promise.resolve(promise);
  guarded.catch(() => {
    /* swallowed: the fallback already answered */
  });

  try {
    return await Promise.race([
      guarded,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(
            `[Queues] ${label} did not answer within ${ms}ms — Redis looks unreachable; continuing without it.`
          );
          resolve(fallback);
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Default budget for a queue read/write issued outside a worker's own loop. */
export const QUEUE_OP_TIMEOUT_MS = 4000;

/** Bounded wait that reports failure instead of a value. */
export async function withTimeoutBoolean(
  promise: PromiseLike<unknown>,
  ms: number,
  label: string
): Promise<boolean> {
  const result = await withTimeoutFallback(
    Promise.resolve(promise).then(() => true),
    ms,
    false,
    label
  );
  return result;
}
