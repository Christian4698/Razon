import type { MarketSnapshot } from "../types/market.types";
import type { SignalReason } from "../types/signal.types";
import type { Timeframe } from "../types/timeframe.types";

export type StructurePattern = "HH" | "HL" | "LH" | "LL" | "BOS" | "CHOCH" | "RANGE";

export type LiquidityPattern =
  | "SUPPORT"
  | "RESISTANCE"
  | "EQUAL_HIGH"
  | "EQUAL_LOW"
  | "SWEEP"
  | "FVG"
  | "ORDER_BLOCK";

export interface StructureReading {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly patterns: readonly StructurePattern[];
  readonly reasons: readonly SignalReason[];
}

export interface LiquidityReading {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly patterns: readonly LiquidityPattern[];
  readonly reasons: readonly SignalReason[];
}

export interface MarketAnalysisResult {
  readonly snapshot: MarketSnapshot;
  readonly structure: StructureReading;
  readonly liquidity: LiquidityReading;
  readonly volatility?: number;
  readonly momentum?: number;
  readonly reasons: readonly SignalReason[];
  readonly analyzedAt: string;
}

/**
 * Contract for future analysis engines. It describes output shape only.
 */
export interface MarketAnalysisEngine {
  readonly analyze: (snapshot: MarketSnapshot) => Promise<MarketAnalysisResult>;
}
