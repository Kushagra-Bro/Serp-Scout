export interface RedisBudgetTelemetry {
  commandsSinceBoot: number;
  uptimeHours: number;
  estimatedMonthlyBurnRate: number;
  monthlyBudgetLimit: number;
  budgetStatus: 'healthy' | 'warning' | 'critical';
  /** True until the sample window is long enough for the extrapolation to mean anything. */
  provisional: boolean;
}

export const MONTHLY_REDIS_BUDGET_LIMIT = 500000;

/**
 * Minimum observation window before a burn rate is extrapolated to a month.
 *
 * Startup is command-dense (workers connecting, boot reconciliation) and the
 * process is short-lived, so dividing a few dozen commands by a few seconds
 * extrapolates to millions per month and reports "critical" on every healthy
 * boot. Below this window the rate is scaled from a full hour instead, so the
 * number stays conservative and is flagged `provisional`.
 */
const MIN_OBSERVATION_WINDOW_HOURS = 1;

/**
 * Computes live burn rate and status against the monthly Redis command quota.
 */
export function computeRedisBudget(
  commandsCount: number,
  uptimeMs: number,
  budgetLimit: number = MONTHLY_REDIS_BUDGET_LIMIT
): RedisBudgetTelemetry {
  const actualUptimeHours = Math.max(uptimeMs / (1000 * 60 * 60), 0.001);
  const provisional = actualUptimeHours < MIN_OBSERVATION_WINDOW_HOURS;
  const scalingHours = Math.max(actualUptimeHours, MIN_OBSERVATION_WINDOW_HOURS);

  const burnRatePerHour = commandsCount / scalingHours;
  const estimatedMonthlyBurn = Math.round(burnRatePerHour * 24 * 30);

  const budgetStatus: 'healthy' | 'warning' | 'critical' =
    estimatedMonthlyBurn <= budgetLimit * 0.5
      ? 'healthy'
      : estimatedMonthlyBurn <= budgetLimit * 0.9
      ? 'warning'
      : 'critical';

  return {
    commandsSinceBoot: commandsCount,
    uptimeHours: Math.round(actualUptimeHours * 100) / 100,
    estimatedMonthlyBurnRate: estimatedMonthlyBurn,
    monthlyBudgetLimit: budgetLimit,
    budgetStatus,
    provisional,
  };
}
