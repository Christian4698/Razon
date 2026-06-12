import { MockMarketConnector } from "../mock/mock.connector";
import type { MarketConnectorMode } from "../connector.types";
import { mapMt5Options } from "./mt5.mapper";

/**
 * MT5 read-only connector placeholder.
 * Phase 3 validates connection/data behavior only; no real trading is exposed.
 */
export class Mt5MarketConnector extends MockMarketConnector {
  constructor(mode: MarketConnectorMode = "simulation") {
    super(mapMt5Options(mode));
  }
}
