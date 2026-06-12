import { DerivMarketConnector } from "./deriv/deriv.connector";
import { ForexMarketConnector } from "./forex/forex.connector";
import { ConnectorHealthService, type ConnectorHealthSummary } from "./connector-health.service";
import { MockMarketConnector } from "./mock/mock.connector";
import { Mt5MarketConnector } from "./mt5/mt5.connector";
import { TradingViewMarketConnector } from "./tradingview/tradingview.connector";
import type { Timeframe } from "../../core/types/timeframe.types";
import type {
  CandleRequest,
  ConnectorAccountInfo,
  ConnectorCandle,
  ConnectorCloseOrderRequest,
  ConnectorModifyOrderRequest,
  ConnectorOpenPosition,
  ConnectorOrderRequest,
  ConnectorOrderResult,
  ConnectorTick,
  MarketConnectorHealth,
  MarketConnectorId,
  MarketConnectorMode,
  OrderBookSnapshot,
  SafeMarketConnector,
  SpreadSnapshot,
  TickRequest,
} from "./connector.types";

export interface ConnectorsServiceOptions {
  readonly mode?: MarketConnectorMode;
  readonly connectors?: readonly SafeMarketConnector[];
}

/**
 * Read-only connector service for Phase 3.
 * It tests connectivity, data reads, latency, and reconnection only.
 */
export class ConnectorsService {
  private readonly connectors: ReadonlyMap<MarketConnectorId, SafeMarketConnector>;
  private readonly healthService = new ConnectorHealthService();

  constructor(options: ConnectorsServiceOptions = {}) {
    const mode = options.mode ?? "simulation";
    const connectors =
      options.connectors ??
      [
        new Mt5MarketConnector(mode),
        new DerivMarketConnector(mode),
        new ForexMarketConnector(mode),
        new TradingViewMarketConnector(mode),
        new MockMarketConnector({
          id: "mock",
          name: "Mock Market Data",
          mode,
          simulatedLatencyMs: 5,
        }),
      ];

    this.connectors = new Map(connectors.map(connector => [connector.id, connector]));
  }

  async connect(connectorId: MarketConnectorId): Promise<MarketConnectorHealth> {
    return this.connector(connectorId).connect();
  }

  async disconnect(connectorId: MarketConnectorId): Promise<MarketConnectorHealth> {
    return this.connector(connectorId).disconnect();
  }

  async reconnect(connectorId: MarketConnectorId): Promise<MarketConnectorHealth> {
    return this.connector(connectorId).reconnect();
  }

  async testConnection(connectorId: MarketConnectorId): Promise<MarketConnectorHealth> {
    return this.connector(connectorId).testConnection();
  }

  async getConnectionStatus(connectorId: MarketConnectorId): Promise<MarketConnectorHealth> {
    return this.connector(connectorId).getConnectionStatus();
  }

  async health(connectorId?: MarketConnectorId): Promise<MarketConnectorHealth | readonly MarketConnectorHealth[]> {
    if (connectorId) return this.connector(connectorId).health();
    return Promise.all([...this.connectors.values()].map(connector => connector.health()));
  }

  async healthSummary(): Promise<ConnectorHealthSummary> {
    return this.healthService.checkAll(this.listConnectors());
  }

  async getCandles(request: CandleRequest): Promise<readonly ConnectorCandle[]> {
    return this.connector(request.connectorId).getCandles(request.symbol, request.timeframe, request.limit);
  }

  async getTick(request: TickRequest): Promise<ConnectorTick> {
    return this.connector(request.connectorId).getTick(request.symbol);
  }

  async getOrderBook(request: TickRequest): Promise<OrderBookSnapshot> {
    return this.connector(request.connectorId).getOrderBook(request.symbol);
  }

  async getSpread(request: TickRequest): Promise<SpreadSnapshot> {
    return this.connector(request.connectorId).getSpread(request.symbol);
  }

  async getAccountInfo(connectorId: MarketConnectorId): Promise<ConnectorAccountInfo> {
    return this.connector(connectorId).getAccountInfo();
  }

  async getOpenPositions(connectorId: MarketConnectorId): Promise<readonly ConnectorOpenPosition[]> {
    return this.connector(connectorId).getOpenPositions();
  }

  async placeOrder(connectorId: MarketConnectorId, request: ConnectorOrderRequest): Promise<ConnectorOrderResult> {
    return this.connector(connectorId).placeOrder(request);
  }

  async closeOrder(connectorId: MarketConnectorId, request: ConnectorCloseOrderRequest): Promise<ConnectorOrderResult> {
    return this.connector(connectorId).closeOrder(request);
  }

  async modifyOrder(connectorId: MarketConnectorId, request: ConnectorModifyOrderRequest): Promise<ConnectorOrderResult> {
    return this.connector(connectorId).modifyOrder(request);
  }

  listConnectors(): readonly SafeMarketConnector[] {
    return [...this.connectors.values()];
  }

  private connector(connectorId: MarketConnectorId): SafeMarketConnector {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new Error(`Connector '${connectorId}' is not registered.`);
    }

    return connector;
  }
}

export function createConnectorsService(options?: ConnectorsServiceOptions) {
  return new ConnectorsService(options);
}

export type { MarketConnectorId, MarketConnectorMode, Timeframe };
