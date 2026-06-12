import type { RiskBlock, RiskLimits, RiskReasonCode, RiskSeverity } from "./risk.types";

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxRiskPerTradePercent: 2,
  maxTotalOpenRiskPercent: 6,
  minRiskRewardRatio: 2,
  maxDailyDrawdownPercent: 3,
  maxWeeklyDrawdownPercent: 6,
  maxTotalDrawdownPercent: 10,
  maxSymbolExposurePercent: 20,
  maxTotalExposurePercent: 50,
  maxSpread: 0.0005,
  maxSlippage: 0.0002,
  maxOpenPositions: 3,
};

export function mergeRiskLimits(overrides?: Partial<RiskLimits>): RiskLimits {
  return {
    ...DEFAULT_RISK_LIMITS,
    ...(overrides ?? {}),
  };
}

export function createRiskBlock(
  reason_code: RiskReasonCode,
  explanation: string,
  severity: RiskSeverity,
  recommended_action: string
): RiskBlock {
  return {
    blocked: true,
    reason_code,
    explanation,
    severity,
    recommended_action,
  };
}

export function roundRisk(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

export function calculateRR(entry: number | null, stopLoss: number | null, takeProfit: number | null) {
  if (typeof entry !== "number" || typeof stopLoss !== "number" || typeof takeProfit !== "number") return null;
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  if (risk <= 0 || reward <= 0) return null;
  return roundRisk(reward / risk, 4);
}
