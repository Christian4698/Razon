/**
 * Error codes reserved for future market data and analysis failures.
 */
export type MarketErrorCode =
  | "MARKET_DATA_UNAVAILABLE"
  | "MARKET_DATA_STALE"
  | "MARKET_DATA_INVALID"
  | "SYMBOL_NOT_SUPPORTED"
  | "TIMEFRAME_NOT_SUPPORTED"
  | "CONNECTOR_UNAVAILABLE";

export interface MarketErrorDetails {
  readonly code: MarketErrorCode;
  readonly symbol?: string;
  readonly message: string;
  readonly connector?: string;
}

/**
 * Typed market error shape for boundary contracts.
 * Runtime implementations can later map this to HTTP, logs, or exceptions.
 */
export interface MarketErrorContract extends MarketErrorDetails {
  readonly name: "MarketError";
  readonly recoverable: boolean;
}
