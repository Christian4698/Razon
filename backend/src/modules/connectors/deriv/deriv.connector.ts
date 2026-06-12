import { MockMarketConnector } from "../mock/mock.connector";
import type { MarketConnectorMode } from "../connector.types";
import { mapDerivOptions } from "./deriv.mapper";

/**
 * Deriv read-only connector placeholder.
 * It is safe for latency and reconnection tests without order placement.
 */
export class DerivMarketConnector extends MockMarketConnector {
  constructor(mode: MarketConnectorMode = "simulation") {
    super(mapDerivOptions(mode));
  }
}
