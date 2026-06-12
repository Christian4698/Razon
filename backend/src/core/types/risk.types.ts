import type { SignalAction } from "./signal.types";

export type RiskDecision = "APPROVED" | "REJECTED" | "REQUIRES_REVIEW";

export type RiskBlockReason =
  | "LOW_CONFIDENCE"
  | "HIGH_SPREAD"
  | "HIGH_SLIPPAGE"
  | "CHAOTIC_MARKET"
  | "INSUFFICIENT_DATA"
  | "DAILY_LOSS_LIMIT"
  | "DRAWDOWN_LIMIT"
  | "RR_TOO_LOW"
  | "KILL_SWITCH"
  | "EMERGENCY_STOP"
  | "LIVE_TRADING_DISABLED";

export interface RiskLimits {
  readonly maxRiskPerTradePercent: number;
  readonly maxDailyLossPercent: number;
  readonly maxTotalDrawdownPercent: number;
  readonly minRiskRewardRatio: number;
  readonly allowMartingale: boolean;
}

export interface RiskState {
  readonly accountCurrency: string;
  readonly currentDrawdownPercent: number;
  readonly dailyLossPercent: number;
  readonly killSwitchEnabled: boolean;
  readonly emergencyStopEnabled: boolean;
  readonly updatedAt: string;
}

export interface RiskAssessment {
  readonly decision: RiskDecision;
  readonly intendedAction: SignalAction;
  readonly riskRewardRatio?: number;
  readonly calculatedVolume?: number;
  readonly blockedReasons: readonly RiskBlockReason[];
  readonly notes: readonly string[];
  readonly assessedAt: string;
}
