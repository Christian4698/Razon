import type { Timeframe, TradingMode } from "./timeframe.types";

/**
 * Final directional intent emitted by analysis layers.
 * NO_TRADE is a valid result and must be preserved in journals.
 */
export type SignalAction = "BUY" | "SELL" | "WAIT" | "NO_TRADE";

/**
 * Confidence is always bounded from 0 to 100.
 * It is never a guarantee or certainty claim.
 * Runtime code must validate the range before casting to this domain type.
 */
declare const confidenceScoreBrand: unique symbol;

export type ConfidenceScore = number & {
  readonly [confidenceScoreBrand]: "ConfidenceScore";
};

export type SignalSource =
  | "MARKET_ANALYSIS"
  | "KALOS"
  | "RISK_ENGINE"
  | "NO_TRADE_ENGINE"
  | "MANUAL";

export interface PriceLevel {
  readonly value: number;
  readonly symbol: string;
  readonly label?: string;
}

export interface SignalReason {
  readonly code: string;
  readonly message: string;
  readonly weight?: number;
}

export interface TradingSignal {
  readonly id: string;
  readonly symbol: string;
  readonly action: SignalAction;
  readonly confidence: ConfidenceScore;
  readonly timeframe: Timeframe;
  readonly mode: TradingMode;
  readonly source: SignalSource;
  readonly entry?: PriceLevel;
  readonly tp?: PriceLevel;
  readonly sl?: PriceLevel;
  readonly invalidation?: string;
  readonly reasons: readonly SignalReason[];
  readonly createdAt: string;
}
