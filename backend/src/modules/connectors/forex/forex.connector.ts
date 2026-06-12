import { MockMarketConnector } from "../mock/mock.connector";
import type { MarketConnectorMode } from "../connector.types";
import { mapForexOptions } from "./forex.mapper";

/**
 * Forex API connector shell.
 * It reads server-side configuration and falls back to MOCK when no real source
 * is configured. Order methods remain blocked by the base connector.
 */
export class ForexMarketConnector extends MockMarketConnector {
  constructor(mode: MarketConnectorMode = "simulation") {
    super(mapForexOptions(mode));
  }
}
