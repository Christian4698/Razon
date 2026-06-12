import type { MarketConnectorHealth, SafeMarketConnector } from "./connectors.types";

export interface ConnectorHealthSummary {
  readonly generatedAt: string;
  readonly total: number;
  readonly connected: number;
  readonly delayed: number;
  readonly disconnected: number;
  readonly runtimeModes: {
    readonly LIVE: number;
    readonly DEMO: number;
    readonly MOCK: number;
  };
  readonly connectors: readonly MarketConnectorHealth[];
}

export class ConnectorHealthService {
  async check(connector: SafeMarketConnector): Promise<MarketConnectorHealth> {
    return connector.getConnectionStatus();
  }

  async checkAll(connectors: readonly SafeMarketConnector[]): Promise<ConnectorHealthSummary> {
    const health = await Promise.all(connectors.map(connector => connector.getConnectionStatus()));

    return {
      generatedAt: new Date().toISOString(),
      total: health.length,
      connected: health.filter(item => item.state === "connected").length,
      delayed: health.filter(item => item.state === "delayed").length,
      disconnected: health.filter(item => item.state === "disconnected").length,
      runtimeModes: {
        LIVE: health.filter(item => item.runtimeMode === "LIVE").length,
        DEMO: health.filter(item => item.runtimeMode === "DEMO").length,
        MOCK: health.filter(item => item.runtimeMode === "MOCK").length,
      },
      connectors: health,
    };
  }
}
