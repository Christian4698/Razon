import type { Timeframe } from "../../core/types/timeframe.types";
import type { OhlcCandle, MarketTick } from "../../core/types/market.types";
import type { TradePosition } from "../../core/types/trade.types";

export type MarketConnectorMode = "simulation" | "paper" | "live";

export type ConnectorRuntimeMode = "LIVE" | "DEMO" | "MOCK";

export type MarketConnectorId = "mt5" | "deriv" | "forex" | "tradingview" | "mock";

export type MarketConnectorState = "connected" | "disconnected" | "delayed";

export type ConnectorSafetyStatus = "DISCONNECTED" | "CONNECTED_DEMO" | "CONNECTED_REAL_READONLY" | "LIVE_BLOCKED";

export type ConnectorAccessMode = "DEMO" | "REAL";

export type MarketConnectorDisplayStatus = "Connecté" | "Déconnecté" | "Données retardées";

export type ConnectorExecutionStatus = "BLOCKED" | "PREPARED";

export interface SecretRef {
  readonly key: string;
  readonly configured: boolean;
  readonly maskedValue?: string;
}

export interface ConnectorSecrets {
  readonly refs: readonly SecretRef[];
}

export interface MarketConnectorOptions {
  readonly id: MarketConnectorId;
  readonly name: string;
  readonly mode: MarketConnectorMode;
  readonly runtimeMode?: ConnectorRuntimeMode;
  readonly accessMode?: ConnectorAccessMode;
  readonly simulatedLatencyMs?: number;
  readonly delayedData?: boolean;
  readonly secrets?: ConnectorSecrets;
}

export interface MarketConnectorHealth {
  readonly id: MarketConnectorId;
  readonly name: string;
  readonly mode: MarketConnectorMode;
  readonly runtimeMode: ConnectorRuntimeMode;
  readonly accessMode: ConnectorAccessMode;
  readonly state: MarketConnectorState;
  readonly safetyStatus: ConnectorSafetyStatus;
  readonly displayStatus: MarketConnectorDisplayStatus;
  readonly latencyMs: number | null;
  readonly reconnectAttempts: number;
  readonly connectedAt?: string;
  readonly lastDataAt?: string;
  readonly message: string;
  readonly secrets: ConnectorSecrets;
  readonly readonlyByDefault: true;
  readonly liveTradingAllowed: false;
}

export interface CandleRequest {
  readonly connectorId: MarketConnectorId;
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly limit?: number;
}

export interface TickRequest {
  readonly connectorId: MarketConnectorId;
  readonly symbol: string;
}

export interface OrderBookLevel {
  readonly price: number;
  readonly volume: number;
}

export interface OrderBookSnapshot {
  readonly symbol: string;
  readonly connectorId: MarketConnectorId;
  readonly bids: readonly OrderBookLevel[];
  readonly asks: readonly OrderBookLevel[];
  readonly capturedAt: string;
}

export interface SpreadSnapshot {
  readonly symbol: string;
  readonly connectorId: MarketConnectorId;
  readonly bid: number;
  readonly ask: number;
  readonly spread: number;
  readonly capturedAt: string;
}

export interface ConnectorAccountInfo {
  readonly connectorId: MarketConnectorId;
  readonly runtimeMode: ConnectorRuntimeMode;
  readonly accountId: string | null;
  readonly currency: string;
  readonly balance: number;
  readonly equity: number;
  readonly margin: number;
  readonly freeMargin: number;
  readonly isSimulated: boolean;
  readonly updatedAt: string;
}

export interface ConnectorOrderRequest {
  readonly symbol: string;
  readonly side: "BUY" | "SELL";
  readonly volume: number;
  readonly entry?: number;
  readonly stop_loss?: number;
  readonly take_profit?: number;
  readonly clientRequestId?: string;
}

export interface ConnectorOrderResult {
  readonly status: ConnectorExecutionStatus;
  readonly safetyStatus: "LIVE_BLOCKED";
  readonly connectorId: MarketConnectorId;
  readonly runtimeMode: ConnectorRuntimeMode;
  readonly message: string;
  readonly clientRequestId?: string;
  readonly orderId?: string;
}

export interface ConnectorModifyOrderRequest {
  readonly orderId: string;
  readonly stop_loss?: number;
  readonly take_profit?: number;
}

export interface ConnectorCloseOrderRequest {
  readonly orderId: string;
  readonly reason: string;
}

export type ConnectorCandle = OhlcCandle;

export type ConnectorTick = MarketTick;

export type ConnectorOpenPosition = TradePosition;

export interface SafeMarketConnector {
  readonly id: MarketConnectorId;
  readonly name: string;
  readonly mode: MarketConnectorMode;
  readonly runtimeMode: ConnectorRuntimeMode;
  readonly accessMode: ConnectorAccessMode;
  connect: () => Promise<MarketConnectorHealth>;
  disconnect: () => Promise<MarketConnectorHealth>;
  reconnect: () => Promise<MarketConnectorHealth>;
  health: () => Promise<MarketConnectorHealth>;
  testConnection: () => Promise<MarketConnectorHealth>;
  getConnectionStatus: () => Promise<MarketConnectorHealth>;
  getCandles: (symbol: string, timeframe: Timeframe, limit?: number) => Promise<readonly ConnectorCandle[]>;
  getTick: (symbol: string) => Promise<ConnectorTick>;
  getOrderBook: (symbol: string) => Promise<OrderBookSnapshot>;
  getSpread: (symbol: string) => Promise<SpreadSnapshot>;
  getAccountInfo: () => Promise<ConnectorAccountInfo>;
  getOpenPositions: () => Promise<readonly ConnectorOpenPosition[]>;
  placeOrder: (request: ConnectorOrderRequest) => Promise<ConnectorOrderResult>;
  closeOrder: (request: ConnectorCloseOrderRequest) => Promise<ConnectorOrderResult>;
  modifyOrder: (request: ConnectorModifyOrderRequest) => Promise<ConnectorOrderResult>;
}

export function modeToRuntimeMode(mode: MarketConnectorMode): ConnectorRuntimeMode {
  if (mode === "live") return "LIVE";
  if (mode === "paper") return "DEMO";
  return "MOCK";
}

export function maskSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}
