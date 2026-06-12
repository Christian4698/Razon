import type { MarketDataRequest } from "./market.types";
import type { TradeOrderDraft } from "./trade.types";

export type ConnectorProvider = "MT5" | "DERIV" | "FOREX_API" | "GENERIC_API";

export type ConnectorStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "DEGRADED"
  | "ERROR";

export type ConnectorCapability =
  | "MARKET_DATA"
  | "ACCOUNT"
  | "ORDER_PLACEMENT"
  | "POSITION_MANAGEMENT"
  | "HISTORICAL_DATA";

export interface ConnectorCredentialsRef {
  readonly provider: ConnectorProvider;
  readonly environmentKey: string;
  readonly accountId?: string;
}

export interface ConnectorConfig {
  readonly provider: ConnectorProvider;
  readonly name: string;
  readonly enabled: boolean;
  readonly mode: "demo" | "live" | "simulation";
  readonly endpoint?: string;
  readonly credentialsRef?: ConnectorCredentialsRef;
  readonly capabilities: readonly ConnectorCapability[];
  readonly allowOrderPlacement: boolean;
}

export interface ConnectorHealth {
  readonly provider: ConnectorProvider;
  readonly status: ConnectorStatus;
  readonly checkedAt: string;
  readonly latencyMs?: number;
  readonly message?: string;
}

export interface ConnectorAccountSnapshot {
  readonly provider: ConnectorProvider;
  readonly accountId: string;
  readonly currency: string;
  readonly balance: number;
  readonly equity?: number;
  readonly margin?: number;
  readonly freeMargin?: number;
  readonly capturedAt: string;
}

export interface ConnectorFetchRequest {
  readonly provider: ConnectorProvider;
  readonly marketData: MarketDataRequest;
}

export interface ConnectorOrderRequest {
  readonly provider: ConnectorProvider;
  readonly order: TradeOrderDraft;
}
