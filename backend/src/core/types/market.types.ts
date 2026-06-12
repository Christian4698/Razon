import type { Timeframe } from "./timeframe.types";

export type MarketAssetClass =
  | "FOREX"
  | "GOLD"
  | "INDEX"
  | "DERIV"
  | "DERIV_SYNTHETIC"
  | "OTC"
  | "CRYPTO"
  | "FUTURES"
  | "STOCKS";

export type MarketState = "TREND" | "RANGE" | "CHAOTIC" | "NEWS_SENSITIVE";

export type MarketDirection = "BULLISH" | "BEARISH" | "NEUTRAL";

export type MarketSession = "ASIA" | "LONDON" | "NEW_YORK" | "OVERLAP" | "CLOSED";

export interface MarketSymbol {
  readonly symbol: string;
  readonly displayName: string;
  readonly assetClass: MarketAssetClass;
  readonly brokerSymbol?: string;
  readonly baseAsset?: string;
  readonly quoteAsset?: string;
}

export interface OhlcCandle {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly timestamp: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
  readonly spread?: number;
}

export interface MarketTick {
  readonly symbol: string;
  readonly timestamp: string;
  readonly bid: number;
  readonly ask: number;
  readonly last?: number;
  readonly volume?: number;
  readonly spread?: number;
}

export interface MarketSnapshot {
  readonly symbol: MarketSymbol;
  readonly timeframe: Timeframe;
  readonly state: MarketState;
  readonly direction: MarketDirection;
  readonly session?: MarketSession;
  readonly latestCandle?: OhlcCandle;
  readonly latestTick?: MarketTick;
  readonly volatility?: number;
  readonly capturedAt: string;
}

export interface MarketDataRequest {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
}

export interface MarketDataBatch {
  readonly request: MarketDataRequest;
  readonly candles: readonly OhlcCandle[];
  readonly ticks?: readonly MarketTick[];
  readonly receivedAt: string;
}
