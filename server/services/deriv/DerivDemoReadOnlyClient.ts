import type { MarketTimeframe, NormalizedCandle, NormalizedTicker } from "../market/marketProvider";
import {
  applyKalosDataGuard,
  buildMarketDataHealth,
  type KalosDataGuardOutput,
  type MarketDataHealthModel,
} from "../market/marketObservability";

export type DerivRequestPayload = Record<string, unknown>;

interface DerivActiveSymbol {
  readonly display_name?: string;
  readonly symbol?: string;
  readonly market_display_name?: string;
}

export interface DerivMessage {
  readonly authorize?: { loginid?: string; is_virtual?: 0 | 1 };
  readonly active_symbols?: readonly DerivActiveSymbol[];
  readonly tick?: { quote?: number; epoch?: number; symbol?: string };
  readonly candles?: readonly DerivRawCandle[];
  readonly error?: { message?: string; code?: string };
}

interface DerivRawCandle {
  readonly epoch: number;
  readonly open: number | string;
  readonly high: number | string;
  readonly low: number | string;
  readonly close: number | string;
}

export interface DerivClientConfig {
  readonly enabled: boolean;
  readonly appId: string | null;
  readonly apiTokenConfigured: boolean;
  readonly endpoint: string;
  readonly accountType: "demo" | "live";
  readonly allowOrderPlacement: boolean;
}

export type DerivRequestTransport = (
  endpoint: string,
  payload: DerivRequestPayload
) => Promise<DerivMessage>;

export interface DerivConnectorHealth {
  readonly id: "deriv-demo";
  readonly name: "Deriv Demo";
  readonly runtimeMode: "DEMO" | "MOCK";
  readonly state: "connected" | "disconnected" | "delayed";
  readonly sourceStatus: "CONNECTED" | "DISCONNECTED" | "MOCK";
  readonly safetyStatus: "CONNECTED_DEMO" | "DISCONNECTED";
  readonly executionStatus: "LIVE_BLOCKED";
  readonly accessMode: "DEMO";
  readonly readonly: true;
  readonly readonlyByDefault: true;
  readonly liveTradingAllowed: false;
  readonly orderPlacementAllowed: false;
  readonly tokenConfigured: boolean;
  readonly tokenVisible: false;
  readonly endpointConfigured: boolean;
  readonly appIdConfigured: boolean;
  readonly latencyMs: number | null;
  readonly message: string;
  readonly generatedAt: string;
}

export interface DerivReadOnlySnapshot {
  readonly ticker: NormalizedTicker;
  readonly candles: readonly NormalizedCandle[];
  readonly observability: MarketDataHealthModel;
  readonly dataGuard: KalosDataGuardOutput;
}

const defaultDerivRequestTransport: DerivRequestTransport = (endpoint, payload) => {
  const WebSocketCtor = globalThis.WebSocket;

  if (!WebSocketCtor) {
    throw new Error("WebSocket runtime is not available.");
  }

  return new Promise((resolve, reject) => {
    const socket = new WebSocketCtor(endpoint);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Deriv WebSocket request timed out."));
    }, 8000);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify(payload));
    });

    socket.addEventListener("message", event => {
      clearTimeout(timeout);
      socket.close();

      try {
        const message = JSON.parse(String(event.data)) as DerivMessage;

        if (message.error) {
          reject(new Error(message.error.message ?? "Deriv WebSocket returned an error."));
          return;
        }

        resolve(message);
      } catch {
        reject(new Error("Invalid Deriv WebSocket response."));
      }
    });

    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      socket.close();
      reject(new Error("Deriv WebSocket connection failed."));
    });
  });
};

const granularityMap: Record<MarketTimeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "1d": 86400,
};

function env(key: string) {
  return process.env[key];
}

function boolEnv(key: string) {
  return env(key) === "true";
}

export function isDerivApiTokenConfigured(value: string | undefined) {
  return value?.trim().startsWith("pat_") ?? false;
}

let lastLoggedTokenConfigured: boolean | null = null;

function logSafeTokenConfigured(tokenConfigured: boolean) {
  if (lastLoggedTokenConfigured === tokenConfigured) return;

  lastLoggedTokenConfigured = tokenConfigured;
  console.info(`[RAZON Deriv] tokenConfigured=${tokenConfigured}`);
}

function now() {
  return new Date().toISOString();
}

function buildEndpoint(endpoint: string, appId: string) {
  const url = new URL(endpoint);
  url.searchParams.set("app_id", appId);
  return url.toString();
}

function unavailableTicker(symbol: string, source: string, message: string): NormalizedTicker {
  return {
    symbol,
    category: "derivSynthetic",
    price: null,
    changePercent: null,
    volume: null,
    trend: "unavailable",
    status: "unavailable",
    source,
    updatedAt: now(),
    providerMessage: message,
  };
}

function parseNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

export function getDerivDemoConfig(): DerivClientConfig {
  const apiTokenConfigured = isDerivApiTokenConfigured(env("DERIV_API_TOKEN"));
  logSafeTokenConfigured(apiTokenConfigured);

  return {
    enabled: boolEnv("DERIV_ENABLED"),
    appId: env("DERIV_APP_ID")?.trim() || null,
    apiTokenConfigured,
    endpoint: env("DERIV_ENDPOINT")?.trim() || "wss://ws.derivws.com/websockets/v3",
    accountType: env("DERIV_ACCOUNT_TYPE") === "live" ? "live" : "demo",
    allowOrderPlacement: boolEnv("DERIV_ALLOW_ORDER_PLACEMENT"),
  };
}

export class DerivDemoReadOnlyClient {
  private readonly config: DerivClientConfig;
  private readonly transport: DerivRequestTransport;
  private connected = false;
  private latencyMs: number | null = null;
  private lastMessage = "Deriv DEMO read-only is not connected.";

  constructor(
    config: DerivClientConfig = getDerivDemoConfig(),
    transport: DerivRequestTransport = defaultDerivRequestTransport
  ) {
    this.config = config;
    this.transport = transport;
  }

  async connect(): Promise<DerivConnectorHealth> {
    if (!this.isConfigured()) {
      this.connected = false;
      this.latencyMs = null;
      this.lastMessage = "DERIV_ENABLED and DERIV_APP_ID are required for Deriv DEMO read-only.";
      return this.health();
    }

    const startedAt = Date.now();

    try {
      await this.getActiveSymbols();
      this.connected = true;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = "Deriv DEMO read-only WebSocket is connected.";
    } catch (error) {
      this.connected = false;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = error instanceof Error ? error.message : "Deriv DEMO read-only connection failed.";
    }

    return this.health();
  }

  disconnect(): DerivConnectorHealth {
    this.connected = false;
    this.lastMessage = "Deriv DEMO read-only disconnected.";
    return this.health();
  }

  health(): DerivConnectorHealth {
    const configured = this.isConfigured();
    const connected = configured && this.connected;

    return {
      id: "deriv-demo",
      name: "Deriv Demo",
      runtimeMode: connected ? "DEMO" : "MOCK",
      state: connected ? "connected" : "disconnected",
      sourceStatus: connected ? "CONNECTED" : configured ? "DISCONNECTED" : "MOCK",
      safetyStatus: connected ? "CONNECTED_DEMO" : "DISCONNECTED",
      executionStatus: "LIVE_BLOCKED",
      accessMode: "DEMO",
      readonly: true,
      readonlyByDefault: true,
      liveTradingAllowed: false,
      orderPlacementAllowed: false,
      tokenConfigured: this.config.apiTokenConfigured,
      tokenVisible: false,
      endpointConfigured: Boolean(this.config.endpoint),
      appIdConfigured: Boolean(this.config.appId),
      latencyMs: this.latencyMs,
      message: this.lastMessage,
      generatedAt: now(),
    };
  }

  async getActiveSymbols(): Promise<readonly DerivActiveSymbol[]> {
    const message = await this.request({
      active_symbols: "brief",
      product_type: "basic",
    });

    return message.active_symbols ?? [];
  }

  async getTicks(symbol: string): Promise<readonly NormalizedTicker[]> {
    return [await this.getTicker(symbol)];
  }

  async getTicker(symbol: string): Promise<NormalizedTicker> {
    if (!this.isConfigured()) {
      return unavailableTicker(symbol, "Deriv DEMO Read-Only", "Deriv DEMO is not configured.");
    }

    const startedAt = Date.now();

    try {
      const message = await this.request({ ticks: symbol });
      const quote = message.tick?.quote;

      if (typeof quote !== "number") {
        throw new Error(message.error?.message ?? "Deriv tick unavailable");
      }

      this.connected = true;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = "Deriv DEMO tick read succeeded.";

      return {
        symbol,
        category: "derivSynthetic",
        price: quote,
        changePercent: null,
        volume: null,
        trend: "sideways",
        status: "live",
        source: "Deriv DEMO Read-Only",
        updatedAt: message.tick?.epoch ? new Date(message.tick.epoch * 1000).toISOString() : now(),
      };
    } catch (error) {
      this.connected = false;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = error instanceof Error ? error.message : "Deriv DEMO tick read failed.";
      return unavailableTicker(symbol, "Deriv DEMO Read-Only", this.lastMessage);
    }
  }

  async getCandles(symbol: string, timeframe: MarketTimeframe, limit = 120): Promise<readonly NormalizedCandle[]> {
    if (!this.isConfigured()) return [];

    const startedAt = Date.now();

    try {
      const message = await this.request({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: Math.max(1, Math.min(limit, 500)),
        end: "latest",
        granularity: granularityMap[timeframe],
        style: "candles",
      });

      if (message.error) {
        throw new Error(message.error.message ?? "Deriv candle read failed.");
      }

      this.connected = true;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = "Deriv DEMO candles read succeeded.";

      return (message.candles ?? []).flatMap(item => {
        const open = parseNumber(item.open);
        const high = parseNumber(item.high);
        const low = parseNumber(item.low);
        const close = parseNumber(item.close);

        if (![open, high, low, close].every(Number.isFinite)) return [];

        return {
          symbol,
          timestamp: new Date(item.epoch * 1000).toISOString(),
          open,
          high,
          low,
          close,
          volume: null,
          source: "Deriv DEMO Read-Only",
        };
      });
    } catch (error) {
      this.connected = false;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = error instanceof Error ? error.message : "Deriv DEMO candles read failed.";
      return [];
    }
  }

  async getSnapshot(symbol: string, timeframe: MarketTimeframe): Promise<DerivReadOnlySnapshot> {
    const startedAt = Date.now();
    const [ticker, candles] = await Promise.all([
      this.getTicker(symbol),
      this.getCandles(symbol, timeframe),
    ]);
    const latencyMs = Date.now() - startedAt;
    const observability = buildMarketDataHealth({
      ticker,
      candles,
      timeframe,
      latencyMs,
      tickRate: ticker.price === null ? 0 : 1,
    });

    return {
      ticker,
      candles,
      observability,
      dataGuard: applyKalosDataGuard(observability),
    };
  }

  private isConfigured() {
    return this.config.enabled && Boolean(this.config.appId) && this.config.accountType === "demo";
  }

  private async request(payload: DerivRequestPayload): Promise<DerivMessage> {
    if (!this.config.appId) {
      throw new Error("DERIV_APP_ID is required for Deriv WebSocket requests.");
    }

    const endpoint = buildEndpoint(this.config.endpoint, this.config.appId);
    return this.transport(endpoint, payload);
  }
}

export const derivDemoReadOnlyClient = new DerivDemoReadOnlyClient();
