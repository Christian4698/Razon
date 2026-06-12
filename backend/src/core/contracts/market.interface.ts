import type {
  MarketDataBatch,
  MarketDataRequest,
  MarketSnapshot,
  MarketSymbol,
  MarketTick,
  OhlcCandle,
} from "../types/market.types";

/**
 * Contract for future market data access.
 * Implementations may be backed by MT5, Deriv, Forex APIs, or cached storage.
 */
export interface MarketDataReader {
  readonly listSymbols: () => Promise<readonly MarketSymbol[]>;
  readonly getSnapshot: (symbol: string) => Promise<MarketSnapshot>;
  readonly getCandles: (request: MarketDataRequest) => Promise<readonly OhlcCandle[]>;
  readonly getTicks: (request: MarketDataRequest) => Promise<readonly MarketTick[]>;
}

/**
 * Contract for future market data validation and normalization.
 */
export interface MarketDataGateway extends MarketDataReader {
  readonly fetchBatch: (request: MarketDataRequest) => Promise<MarketDataBatch>;
}
