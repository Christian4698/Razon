import type { Timeframe } from "../../../core/types/timeframe.types";
import { modeToRuntimeMode } from "../connector.types";
import type {
  ConnectorCandle,
  ConnectorAccountInfo,
  ConnectorAccessMode,
  ConnectorCloseOrderRequest,
  ConnectorRuntimeMode,
  ConnectorSecrets,
  ConnectorModifyOrderRequest,
  ConnectorOpenPosition,
  ConnectorOrderRequest,
  ConnectorOrderResult,
  ConnectorSafetyStatus,
  ConnectorTick,
  MarketConnectorHealth,
  MarketConnectorId,
  MarketConnectorMode,
  MarketConnectorOptions,
  MarketConnectorState,
  OrderBookSnapshot,
  SafeMarketConnector,
  SpreadSnapshot,
} from "../connector.types";

const timeframeMinutes: Record<Timeframe, number> = {
  M1: 1,
  M5: 5,
  M15: 15,
  M30: 30,
  H1: 60,
  H4: 240,
  D1: 1440,
};

function now() {
  return new Date().toISOString();
}

function displayStatus(state: MarketConnectorState) {
  if (state === "connected") return "Connecté";
  if (state === "delayed") return "Données retardées";
  return "Déconnecté";
}

function symbolSeed(symbol: string) {
  return [...symbol].reduce((total, char) => total + char.charCodeAt(0), 0);
}

function roundPrice(value: number) {
  return Number(value.toFixed(5));
}

/**
 * Deterministic read-only connector used for simulation and tests.
 * Subclasses can change metadata while keeping the no-trade guarantee.
 */
export class MockMarketConnector implements SafeMarketConnector {
  readonly id: MarketConnectorId;
  readonly name: string;
  readonly mode: MarketConnectorMode;
  readonly runtimeMode: ConnectorRuntimeMode;
  readonly accessMode: ConnectorAccessMode;

  private readonly simulatedLatencyMs: number;
  private readonly delayedData: boolean;
  private readonly secrets: ConnectorSecrets;
  private connectedAt: string | undefined;
  private lastDataAt: string | undefined;
  private latencyMs: number | null = null;
  private reconnectAttempts = 0;
  private connected = false;

  constructor(options: MarketConnectorOptions) {
    this.id = options.id;
    this.name = options.name;
    this.mode = options.mode;
    this.runtimeMode = options.runtimeMode ?? modeToRuntimeMode(options.mode);
    this.accessMode = options.accessMode ?? (this.runtimeMode === "LIVE" ? "REAL" : "DEMO");
    this.simulatedLatencyMs = options.simulatedLatencyMs ?? 12;
    this.delayedData = options.delayedData ?? false;
    this.secrets = options.secrets ?? { refs: [] };
  }

  async connect(): Promise<MarketConnectorHealth> {
    await this.measureLatency();
    this.connected = true;
    this.connectedAt = now();
    return this.health();
  }

  async disconnect(): Promise<MarketConnectorHealth> {
    this.connected = false;
    this.connectedAt = undefined;
    return this.health();
  }

  async reconnect(): Promise<MarketConnectorHealth> {
    this.reconnectAttempts += 1;
    await this.disconnect();
    return this.connect();
  }

  async health(): Promise<MarketConnectorHealth> {
    const state = this.state();

    return {
      id: this.id,
      name: this.name,
      mode: this.mode,
      runtimeMode: this.runtimeMode,
      accessMode: this.accessMode,
      state,
      safetyStatus: this.safetyStatusFor(state),
      displayStatus: displayStatus(state),
      latencyMs: this.latencyMs,
      reconnectAttempts: this.reconnectAttempts,
      connectedAt: this.connectedAt,
      lastDataAt: this.lastDataAt,
      message: this.messageFor(state),
      secrets: this.secrets,
      readonlyByDefault: true,
      liveTradingAllowed: false,
    };
  }

  async testConnection(): Promise<MarketConnectorHealth> {
    return this.connect();
  }

  async getConnectionStatus(): Promise<MarketConnectorHealth> {
    return this.health();
  }

  async getCandles(symbol: string, timeframe: Timeframe, limit = 100): Promise<readonly ConnectorCandle[]> {
    await this.ensureConnected();
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const seed = symbolSeed(symbol);
    const intervalMs = timeframeMinutes[timeframe] * 60_000;
    const end = Date.now();

    this.lastDataAt = now();

    return Array.from({ length: safeLimit }, (_, index) => {
      const cursor = safeLimit - index;
      const base = this.basePrice(symbol) + Math.sin((seed + index) / 7) * 0.004;
      const open = roundPrice(base);
      const close = roundPrice(base + Math.cos((seed + index) / 5) * 0.0015);
      const high = roundPrice(Math.max(open, close) + 0.002);
      const low = roundPrice(Math.min(open, close) - 0.002);

      return {
        symbol,
        timeframe,
        timestamp: new Date(end - cursor * intervalMs).toISOString(),
        open,
        high,
        low,
        close,
        volume: 1000 + seed + index * 3,
        spread: this.spreadValue(symbol),
      };
    });
  }

  async getTick(symbol: string): Promise<ConnectorTick> {
    await this.ensureConnected();
    const mid = this.basePrice(symbol);
    const spread = this.spreadValue(symbol);
    this.lastDataAt = now();

    return {
      symbol,
      timestamp: now(),
      bid: roundPrice(mid - spread / 2),
      ask: roundPrice(mid + spread / 2),
      last: roundPrice(mid),
      volume: 1000 + symbolSeed(symbol),
      spread,
    };
  }

  async getOrderBook(symbol: string): Promise<OrderBookSnapshot> {
    await this.ensureConnected();
    const tick = await this.getTick(symbol);
    const spread = tick.spread ?? this.spreadValue(symbol);
    const levels = [1, 2, 3, 4, 5];

    return {
      symbol,
      connectorId: this.id,
      bids: levels.map(level => ({
        price: roundPrice(tick.bid - level * spread),
        volume: 100 * level,
      })),
      asks: levels.map(level => ({
        price: roundPrice(tick.ask + level * spread),
        volume: 100 * level,
      })),
      capturedAt: now(),
    };
  }

  async getSpread(symbol: string): Promise<SpreadSnapshot> {
    const tick = await this.getTick(symbol);

    return {
      symbol,
      connectorId: this.id,
      bid: tick.bid,
      ask: tick.ask,
      spread: roundPrice(tick.ask - tick.bid),
      capturedAt: now(),
    };
  }

  async getOpenPositions(): Promise<readonly ConnectorOpenPosition[]> {
    await this.ensureConnected();
    this.lastDataAt = now();
    return [];
  }

  async getAccountInfo(): Promise<ConnectorAccountInfo> {
    await this.ensureConnected();
    this.lastDataAt = now();

    return {
      connectorId: this.id,
      runtimeMode: this.runtimeMode,
      accountId:
        this.runtimeMode === "MOCK"
          ? "SIMULATION"
          : this.accessMode === "REAL"
            ? `${this.id.toUpperCase()}-REAL-READONLY`
            : `${this.id.toUpperCase()}-DEMO`,
      currency: "USD",
      balance: 10000,
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      isSimulated: this.runtimeMode !== "LIVE",
      updatedAt: now(),
    };
  }

  async placeOrder(request: ConnectorOrderRequest): Promise<ConnectorOrderResult> {
    return this.blockedExecution("placeOrder", request.clientRequestId);
  }

  async closeOrder(request: ConnectorCloseOrderRequest): Promise<ConnectorOrderResult> {
    return this.blockedExecution(`closeOrder:${request.orderId}`);
  }

  async modifyOrder(request: ConnectorModifyOrderRequest): Promise<ConnectorOrderResult> {
    return this.blockedExecution(`modifyOrder:${request.orderId}`);
  }

  private state(): MarketConnectorState {
    if (!this.connected) return "disconnected";
    return this.delayedData ? "delayed" : "connected";
  }

  private messageFor(state: MarketConnectorState) {
    if (state === "connected") return "Connecté";
    if (state === "delayed") return "Données retardées";
    return "Déconnecté";
  }

  private safetyStatusFor(state: MarketConnectorState): ConnectorSafetyStatus {
    if (state === "disconnected") return "DISCONNECTED";
    if (this.accessMode === "REAL") return "CONNECTED_REAL_READONLY";
    return "CONNECTED_DEMO";
  }

  private async ensureConnected() {
    if (!this.connected) {
      await this.connect();
    }
  }

  private async measureLatency() {
    const startedAt = Date.now();
    await new Promise(resolve => setTimeout(resolve, this.simulatedLatencyMs));
    this.latencyMs = Date.now() - startedAt;
  }

  private basePrice(symbol: string) {
    const seed = symbolSeed(symbol);
    if (symbol.includes("XAU")) return 2300 + (seed % 40);
    if (symbol.includes("JPY")) return 150 + (seed % 20) / 10;
    if (symbol.includes("BTC")) return 65000 + seed;
    return 1 + (seed % 200) / 1000;
  }

  private spreadValue(symbol: string) {
    const seed = symbolSeed(symbol);
    return roundPrice(0.0001 + (seed % 5) * 0.00005);
  }

  private blockedExecution(action: string, clientRequestId?: string): ConnectorOrderResult {
    return {
      status: "BLOCKED",
      safetyStatus: "LIVE_BLOCKED",
      connectorId: this.id,
      runtimeMode: this.runtimeMode,
      clientRequestId,
      message: `${action} is prepared but blocked. Connector execution is disabled in this phase.`,
    };
  }
}
