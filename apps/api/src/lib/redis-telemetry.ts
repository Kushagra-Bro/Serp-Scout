export interface RedisBudgetTelemetry {
  commandsSinceBoot: number;
  uptimeHours: number;
  estimatedMonthlyBurnRate: number;
  monthlyBudgetLimit: number;
  budgetStatus: 'healthy' | 'warning' | 'critical';
}

export const MONTHLY_REDIS_BUDGET_LIMIT = 500000;

/**
 * Computes live burn rate and status against the monthly Redis command quota.
 */
export function computeRedisBudget(
  commandsCount: number,
  uptimeMs: number,
  budgetLimit: number = MONTHLY_REDIS_BUDGET_LIMIT
): RedisBudgetTelemetry {
  const uptimeHours = Math.max(uptimeMs / (1000 * 60 * 60), 0.001);
  const burnRatePerHour = commandsCount / uptimeHours;
  const estimatedMonthlyBurn = Math.round(burnRatePerHour * 24 * 30);

  const budgetStatus: 'healthy' | 'warning' | 'critical' =
    estimatedMonthlyBurn <= budgetLimit * 0.5
      ? 'healthy'
      : estimatedMonthlyBurn <= budgetLimit * 0.9
      ? 'warning'
      : 'critical';

  return {
    commandsSinceBoot: commandsCount,
    uptimeHours: Math.round(uptimeHours * 100) / 100,
    estimatedMonthlyBurnRate: estimatedMonthlyBurn,
    monthlyBudgetLimit: budgetLimit,
    budgetStatus,
  };
}
