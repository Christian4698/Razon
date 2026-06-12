import type { Timeframe } from "../../core/types/timeframe.types";

export type RiskMode = "SCALPING" | "SHORT_TERM" | "LONG_TERM";

export type RiskDecision = "BUY" | "SELL" | "WAIT" | "NO_TRADE";

export type RiskDataSource = "LIVE" | "DEMO" | "MOCK";

export type RiskTriggerModule = "KALOS" | "BACKTEST" | "MANUAL" | "AUTO";

export type RiskValidationIntent = "SIGNAL" | "BACKTEST" | "EXECUTION";

export type RiskSeverity = "info" | "warning" | "critical";

export type RiskReasonCode =
  | "MARTINGALE_FORBIDDEN"
  | "AUTO_INCREASE_AFTER_LOSS_FORBIDDEN"
  | "MISSING_STOP_LOSS"
  | "MISSING_TAKE_PROFIT"
  | "MISSING_JOURNAL"
  | "MOCK_EXECUTION_FORBIDDEN"
  | "INVALID_RR"
  | "RISK_PER_TRADE_TOO_HIGH"
  | "TOTAL_OPEN_RISK_TOO_HIGH"
  | "DAILY_DRAWDOWN_LIMIT"
  | "WEEKLY_DRAWDOWN_LIMIT"
  | "TOTAL_DRAWDOWN_LIMIT"
  | "SYMBOL_EXPOSURE_TOO_HIGH"
  | "TOTAL_EXPOSURE_TOO_HIGH"
  | "SPREAD_TOO_HIGH"
  | "SLIPPAGE_TOO_HIGH"
  | "INVALID_POSITION_SIZE";

export interface RiskBlock {
  readonly blocked: true;
  readonly reason_code: RiskReasonCode;
  readonly explanation: string;
  readonly severity: RiskSeverity;
  readonly recommended_action: string;
}

export interface RiskLimits {
  readonly maxRiskPerTradePercent: number;
  readonly maxTotalOpenRiskPercent: number;
  readonly minRiskRewardRatio: number;
  readonly maxDailyDrawdownPercent: number;
  readonly maxWeeklyDrawdownPercent: number;
  readonly maxTotalDrawdownPercent: number;
  readonly maxSymbolExposurePercent: number;
  readonly maxTotalExposurePercent: number;
  readonly maxSpread: number;
  readonly maxSlippage: number;
  readonly maxOpenPositions: number;
}

export interface RiskOpenPosition {
  readonly id: string;
  readonly symbol: string;
  readonly direction: "BUY" | "SELL";
  readonly entry: number;
  readonly stop_loss: number;
  readonly quantity: number;
  readonly riskAmount: number;
  readonly notional: number;
  readonly openedAt: string;
}

export interface EquitySnapshot {
  readonly timestamp: string;
  readonly equity: number;
}

export interface PositionSizeInput {
  readonly equity: number;
  readonly riskPerTradePercent: number;
  readonly entry: number;
  readonly stop_loss: number;
}

export interface PositionSizeResult {
  readonly riskAmount: number;
  readonly stopDistance: number;
  readonly positionSize: number;
  readonly effectiveRiskPercent: number;
}

export interface ATRStopInput {
  readonly direction: "BUY" | "SELL";
  readonly entry: number;
  readonly atr: number;
  readonly multiplier?: number;
  readonly minRiskRewardRatio?: number;
}

export interface ATRStopResult {
  readonly stop_loss: number;
  readonly take_profit: number;
  readonly invalidation: number;
  readonly rr: number;
}

export interface DrawdownValidationInput {
  readonly initialCapital: number;
  readonly currentEquity: number;
  readonly equityHistory?: readonly EquitySnapshot[];
  readonly limits?: Partial<RiskLimits>;
}

export interface DrawdownValidationResult {
  readonly dailyDrawdownPercent: number;
  readonly weeklyDrawdownPercent: number;
  readonly totalDrawdownPercent: number;
  readonly blocks: readonly RiskBlock[];
}

export interface RiskValidationInput {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly mode: RiskMode;
  readonly decision: RiskDecision;
  readonly confidence: number;
  readonly risk_score: number;
  readonly entry: number | null;
  readonly stop_loss: number | null;
  readonly take_profit: number | null;
  readonly initialCapital: number;
  readonly currentEquity: number;
  readonly riskPerTradePercent: number;
  readonly spread: number | null;
  readonly slippage: number | null;
  readonly volatility: string | number | null;
  readonly data_source: RiskDataSource;
  readonly trigger_module: RiskTriggerModule;
  readonly intent: RiskValidationIntent;
  readonly journaled: boolean;
  readonly autoModeEnabled: boolean;
  readonly martingaleEnabled?: boolean;
  readonly increaseAfterLossEnabled?: boolean;
  readonly openPositions?: readonly RiskOpenPosition[];
  readonly equityHistory?: readonly EquitySnapshot[];
  readonly atr?: number | null;
  readonly limits?: Partial<RiskLimits>;
}

export interface RiskCalculations {
  readonly positionSize: PositionSizeResult | null;
  readonly riskPerTradeAmount: number;
  readonly totalOpenRiskPercent: number;
  readonly rr: number | null;
  readonly slValid: boolean;
  readonly tpValid: boolean;
  readonly drawdown: DrawdownValidationResult;
  readonly exposureBySymbolPercent: number;
  readonly totalExposurePercent: number;
  readonly spreadAcceptable: boolean;
  readonly slippageAcceptable: boolean;
}

export interface RiskValidationResult {
  readonly accepted: boolean;
  readonly blocks: readonly RiskBlock[];
  readonly calculations: RiskCalculations;
}
