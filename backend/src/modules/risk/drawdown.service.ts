import { createRiskBlock, mergeRiskLimits, roundRisk } from "./risk-rules";
import type { DrawdownValidationInput, DrawdownValidationResult, EquitySnapshot } from "./risk.types";

function drawdownFromPeak(peak: number, equity: number) {
  if (peak <= 0) return 0;
  return Math.max(((peak - equity) / peak) * 100, 0);
}

function periodDrawdown(history: readonly EquitySnapshot[], currentEquity: number, periodMs: number) {
  const cutoff = Date.now() - periodMs;
  const scoped = history.filter(item => Date.parse(item.timestamp) >= cutoff);
  const values = scoped.length > 0 ? scoped.map(item => item.equity) : [currentEquity];
  const peak = Math.max(...values, currentEquity);
  return drawdownFromPeak(peak, currentEquity);
}

export function validateDrawdown(input: DrawdownValidationInput): DrawdownValidationResult {
  const limits = mergeRiskLimits(input.limits);
  const history = input.equityHistory ?? [];
  const allEquity = history.map(item => item.equity);
  const totalPeak = Math.max(input.initialCapital, input.currentEquity, ...allEquity);
  const dailyDrawdownPercent = roundRisk(periodDrawdown(history, input.currentEquity, 24 * 60 * 60 * 1000), 2);
  const weeklyDrawdownPercent = roundRisk(periodDrawdown(history, input.currentEquity, 7 * 24 * 60 * 60 * 1000), 2);
  const totalDrawdownPercent = roundRisk(drawdownFromPeak(totalPeak, input.currentEquity), 2);
  const blocks = [];

  if (dailyDrawdownPercent >= limits.maxDailyDrawdownPercent) {
    blocks.push(
      createRiskBlock(
        "DAILY_DRAWDOWN_LIMIT",
        `Daily drawdown ${dailyDrawdownPercent}% reached the ${limits.maxDailyDrawdownPercent}% limit.`,
        "critical",
        "Stop trading for the day and review journal."
      )
    );
  }

  if (weeklyDrawdownPercent >= limits.maxWeeklyDrawdownPercent) {
    blocks.push(
      createRiskBlock(
        "WEEKLY_DRAWDOWN_LIMIT",
        `Weekly drawdown ${weeklyDrawdownPercent}% reached the ${limits.maxWeeklyDrawdownPercent}% limit.`,
        "critical",
        "Pause trading and review weekly performance."
      )
    );
  }

  if (totalDrawdownPercent >= limits.maxTotalDrawdownPercent) {
    blocks.push(
      createRiskBlock(
        "TOTAL_DRAWDOWN_LIMIT",
        `Total drawdown ${totalDrawdownPercent}% reached the ${limits.maxTotalDrawdownPercent}% limit.`,
        "critical",
        "Activate capital protection and stop new risk."
      )
    );
  }

  return {
    dailyDrawdownPercent,
    weeklyDrawdownPercent,
    totalDrawdownPercent,
    blocks,
  };
}
