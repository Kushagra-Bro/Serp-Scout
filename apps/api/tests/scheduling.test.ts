import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNextCadenceRun,
  CADENCE_CRON_PATTERNS,
  nextQuotaResetDelayMs,
  QUOTA_RESET_CRON,
} from '../src/lib/cadence.js';

// --- computeNextCadenceRun (DB-driven "next scheduled refresh") ------------

test('computeNextCadenceRun: manual cadence has no next run', () => {
  assert.equal(computeNextCadenceRun('manual', new Date('2026-10-03T12:00:00Z')), null);
  assert.equal(computeNextCadenceRun(undefined, new Date('2026-10-03T12:00:00Z')), null);
  assert.equal(computeNextCadenceRun(null, new Date('2026-10-03T12:00:00Z')), null);
});

test('computeNextCadenceRun: unknown cadence has no next run', () => {
  assert.equal(computeNextCadenceRun('fortnightly', new Date('2026-10-03T12:00:00Z')), null);
});

test('computeNextCadenceRun: daily lands on the next 06:00 UTC', () => {
  const before = new Date('2026-10-03T01:00:00Z');
  const after = new Date('2026-10-03T09:00:00Z');

  assert.equal(
    computeNextCadenceRun('daily', before)!.toISOString(),
    '2026-10-03T06:00:00.000Z'
  );
  // Past today's 06:00 -> tomorrow 06:00 UTC.
  assert.equal(
    computeNextCadenceRun('daily', after)!.toISOString(),
    '2026-10-04T06:00:00.000Z'
  );
});

test('computeNextCadenceRun: weekly lands on the next Monday 06:00 UTC', () => {
  // Saturday 2026-10-03 -> Monday 2026-10-05.
  const saturday = new Date('2026-10-03T12:00:00Z');
  assert.equal(
    computeNextCadenceRun('weekly', saturday)!.toISOString(),
    '2026-10-05T06:00:00.000Z'
  );

  // Monday 06:30 has passed this week's slot -> next Monday.
  const mondayLate = new Date('2026-10-05T06:30:00Z');
  assert.equal(
    computeNextCadenceRun('weekly', mondayLate)!.toISOString(),
    '2026-10-12T06:00:00.000Z'
  );
});

test('computeNextCadenceRun: monthly lands on the next 1st 06:00 UTC', () => {
  const midMonth = new Date('2026-10-15T12:00:00Z');
  assert.equal(
    computeNextCadenceRun('monthly', midMonth)!.toISOString(),
    '2026-11-01T06:00:00.000Z'
  );

  const beforeFirst = new Date('2026-10-01T05:00:00Z');
  assert.equal(
    computeNextCadenceRun('monthly', beforeFirst)!.toISOString(),
    '2026-10-01T06:00:00.000Z'
  );
});

// --- nextQuotaResetDelayMs (in-process quota reset arming) -----------------

test('nextQuotaResetDelayMs lands on the next 1st of month at 00:05 UTC', () => {
  const now = new Date('2026-10-03T12:34:56Z');
  const delay = nextQuotaResetDelayMs(now);

  const expected = new Date('2026-11-01T00:05:00.000Z').getTime() - now.getTime();
  assert.equal(delay, expected);
});

test('nextQuotaResetDelayMs never returns zero or negative', () => {
  // Exactly on the reset boundary: rolls to the following month, still >= 1s.
  const boundary = new Date('2026-11-01T00:05:00.000Z');
  const delay = nextQuotaResetDelayMs(boundary);
  assert.ok(delay >= 1000);
});

function assertCronFiveParts(cron: string) {
  const parts = cron.trim().split(/\s+/);
  assert.equal(parts.length, 5, `expected 5-part cron, got "${cron}"`);
}

test('cadence cron patterns are valid 5-part crons', () => {
  for (const [cadence, cron] of Object.entries(CADENCE_CRON_PATTERNS)) {
    assertCronFiveParts(cron);
  }
  assertCronFiveParts(QUOTA_RESET_CRON);
});