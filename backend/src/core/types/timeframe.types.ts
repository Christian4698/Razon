/**
 * Trading horizons supported by RAZON.
 * These values describe user intent, not a market decision.
 */
export type TradingHorizon = "SCALPING" | "SHORT_TERM" | "LONG_TERM";

/**
 * Operating modes supported by the future orchestration layer.
 * Execution-specific permissions must be checked elsewhere.
 */
export type TradingMode =
  | "ANALYSIS"
  | "MANUAL"
  | "SEMI_AUTO"
  | "AUTO"
  | TradingHorizon;

/**
 * Market timeframes used by multi-timeframe analysis.
 */
export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";

/**
 * A validated timeframe selection for a specific horizon.
 */
export interface TimeframePolicy {
  readonly horizon: TradingHorizon;
  readonly allowedTimeframes: readonly Timeframe[];
  readonly primaryTimeframe: Timeframe;
}

/**
 * Role assigned to a timeframe in a top-down market read.
 */
export type TimeframeRole =
  | "CONTEXT"
  | "DIRECTION"
  | "STRUCTURE"
  | "SETUP"
  | "ENTRY"
  | "ADJUSTMENT";

export interface MultiTimeframeStep {
  readonly timeframe: Timeframe;
  readonly role: TimeframeRole;
}
