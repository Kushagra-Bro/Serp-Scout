import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeRedisBudget,
  MONTHLY_REDIS_BUDGET_LIMIT,
} from '../src/lib/redis-telemetry.js';

test('computeRedisBudget: calculates healthy status within 500k monthly limit', () => {
  // 1 command per minute = 60 cmds/hr = 43,200 cmds/month
  const oneHourMs = 60 * 60 * 1000;
  const stats = computeRedisBudget(60, oneHourMs);

  assert.equal(stats.commandsSinceBoot, 60);
  assert.equal(stats.uptimeHours, 1);
  assert.equal(stats.monthlyBudgetLimit, MONTHLY_REDIS_BUDGET_LIMIT);
  assert.equal(stats.estimatedMonthlyBurnRate, 43200);
  assert.equal(stats.budgetStatus, 'healthy');
});

test('computeRedisBudget: flags warning status when burn rate approaches 50%-90%', () => {
  // 450 cmds/hr = 324,000 cmds/month
  const oneHourMs = 60 * 60 * 1000;
  const stats = computeRedisBudget(450, oneHourMs);

  assert.equal(stats.estimatedMonthlyBurnRate, 324000);
  assert.equal(stats.budgetStatus, 'warning');
});

test('computeRedisBudget: flags critical status when burn rate exceeds 90% (450k+)', () => {
  // 700 cmds/hr = 504,000 cmds/month
  const oneHourMs = 60 * 60 * 1000;
  const stats = computeRedisBudget(700, oneHourMs);

  assert.equal(stats.estimatedMonthlyBurnRate, 504000);
  assert.equal(stats.budgetStatus, 'critical');
});

test('computeRedisBudget: handles near-zero uptime safely without NaN or Infinity', () => {
  const stats = computeRedisBudget(1, 0);

  assert.ok(!Number.isNaN(stats.estimatedMonthlyBurnRate));
  assert.ok(Number.isFinite(stats.estimatedMonthlyBurnRate));
  assert.ok(stats.uptimeHours >= 0);
});
