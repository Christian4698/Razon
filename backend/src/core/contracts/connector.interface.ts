import type {
  ConnectorAccountSnapshot,
  ConnectorConfig,
  ConnectorFetchRequest,
  ConnectorHealth,
  ConnectorOrderRequest,
  ConnectorProvider,
} from "../types/connector.types";
import type { MarketDataBatch } from "../types/market.types";
import type { TradeOrder } from "../types/trade.types";

/**
 * Common connector boundary for MT5, Deriv, Forex APIs, and generic APIs.
 */
export interface Connector {
  readonly provider: ConnectorProvider;
  readonly config: ConnectorConfig;
  readonly connect: () => Promise<ConnectorHealth>;
  readonly disconnect: () => Promise<ConnectorHealth>;
  readonly status: () => Promise<ConnectorHealth>;
  readonly test: () => Promise<ConnectorHealth>;
  readonly fetch: (request: ConnectorFetchRequest) => Promise<MarketDataBatch>;
  readonly account: () => Promise<ConnectorAccountSnapshot>;
  readonly placeOrder?: (request: ConnectorOrderRequest) => Promise<TradeOrder>;
}

export interface ConnectorRegistry {
  readonly list: () => readonly Connector[];
  readonly get: (provider: ConnectorProvider) => Connector | undefined;
}
