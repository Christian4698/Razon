import { MockMarketConnector } from "../mock/mock.connector";
import type { MarketConnectorMode } from "../connector.types";

/**
 * TradingView read-only connector placeholder.
 * Market data is marked as delayed until a licensed real-time feed is configured.
 */
export class TradingViewMarketConnector extends MockMarketConnector {
  constructor(mode: MarketConnectorMode = "simulation") {
    super({
      id: "tradingview",
      name: "TradingView",
      mode,
      simulatedLatencyMs: 35,
      delayedData: true,
    });
  }
}
