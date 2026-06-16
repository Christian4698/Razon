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
  readonly balance?: { balance?: number; currency?: string; loginid?: string };
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

export interface DerivPersonalTokenTestResult {
  readonly ok: boolean;
  readonly connected: boolean;
  readonly accountType: "DEMO" | "REAL" | "UNKNOWN";
  readonly status: "CONNECTED" | "DISCONNECTED" | "INVALID";
  readonly source: "PERSONAL_DERIV_DEMO";
  readonly loginid: string | null;
  readonly latencyMs: number | null;
  readonly message: string;
}

const defaultDerivRequestTransport: DerivRequestTransport = (endpoint, payload) => {
  const WebSocketCtor = globalThis.WebSocket;

  if (!WebSocketCtor) {
    throw new Error("WebSocket runtime is not available.");
  }

  return new Promise((resolve, reject) => {
    const socket = new WebSocketCtor(endpoint);
    let opened = false;
    let authorizeSent = false;
    let balanceSent = false;
    const timeout = setTimeout(() => {
      socket.close();
      if (!opened) logSafeDerivWsStep("DERIV_WS_OPENED", false);
      if (isAuthorizePayload(payload) && !authorizeSent) logSafeDerivWsStep("DERIV_AUTHORIZE_SENT", false);
      if (isBalanceSubscribePayload(payload) && !balanceSent) logSafeDerivWsStep("DERIV_BALANCE_SENT", false);
      reject(new Error("Deriv WebSocket request timed out."));
    }, 8000);

    socket.addEventListener("open", () => {
      opened = true;
      logSafeDerivWsStep("DERIV_WS_OPENED", true);
      if (isAuthorizePayload(payload)) {
        authorizeSent = true;
        logSafeDerivWsStep("DERIV_AUTHORIZE_SENT", true);
      }
      if (isBalanceSubscribePayload(payload)) {
        balanceSent = true;
        logSafeDerivWsStep("DERIV_BALANCE_SENT", true);
      }
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
      logSafeDerivWsStep("DERIV_WS_OPENED", opened);
      if (isAuthorizePayload(payload) && !authorizeSent) logSafeDerivWsStep("DERIV_AUTHORIZE_SENT", false);
      if (isBalanceSubscribePayload(payload) && !balanceSent) logSafeDerivWsStep("DERIV_BALANCE_SENT", false);
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

const DEFAULT_DERIV_ENDPOINT = "wss://ws.derivws.com/websockets/v3";

function env(key: string) {
  return process.env[key];
}

function boolEnv(key: string) {
  return env(key) === "true";
}

function normalizeDerivAppId(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) return null;

  const unquoted = trimmed.replace(/^["'](.+)["']$/, "$1").trim();
  return /^\d+$/.test(unquoted) ? unquoted : null;
}

export function isDerivApiTokenConfigured(value: string | undefined) {
  return value?.trim().startsWith("pat_") ?? false;
}

let lastLoggedTokenConfigured: boolean | null = null;
let lastLoggedAppIdPresent: boolean | null = null;
let lastLoggedDerivWsUrlValid: boolean | null = null;

function logSafeTokenConfigured(tokenConfigured: boolean) {
  if (lastLoggedTokenConfigured === tokenConfigured) return;

  lastLoggedTokenConfigured = tokenConfigured;
  console.info(`[RAZON Deriv] tokenConfigured=${tokenConfigured}`);
}

function logSafeAppIdPresent(appIdPresent: boolean) {
  if (lastLoggedAppIdPresent === appIdPresent) return;

  lastLoggedAppIdPresent = appIdPresent;
  console.info(`[RAZON Deriv] DERIV_APP_ID_PRESENT=${appIdPresent}`);
}

function logSafeDerivWsUrlValid(valid: boolean) {
  if (lastLoggedDerivWsUrlValid === valid) return;

  lastLoggedDerivWsUrlValid = valid;
  console.info(`[RAZON Deriv] DERIV_WS_URL_VALID=${valid}`);
}

function logSafeDerivWsStep(step: string, value: boolean) {
  console.info(`[RAZON Deriv] ${step}=${value}`);
}

function now() {
  return new Date().toISOString();
}

function buildEndpoint(endpoint: string, appId: string) {
  return normalizeDerivEndpoint(endpoint, appId);
}

function normalizeDerivEndpoint(endpoint: string | null | undefined, appId: string) {
  const rawEndpoint = endpoint?.trim() || DEFAULT_DERIV_ENDPOINT;
  const normalizedAppId = normalizeDerivAppId(appId);
  let url: URL;

  try {
    url = new URL(rawEndpoint);
  } catch {
    url = new URL(DEFAULT_DERIV_ENDPOINT);
  }

  if (url.protocol !== "wss:" && url.protocol !== "ws:") {
    url = new URL(DEFAULT_DERIV_ENDPOINT);
  }

  if (!url.pathname || url.pathname === "/") {
    url.pathname = "/websockets/v3";
  }

  if (normalizedAppId) {
    url.searchParams.set("app_id", normalizedAppId);
  }

  logSafeDerivWsUrlValid((url.protocol === "wss:" || url.protocol === "ws:") && Boolean(url.searchParams.get("app_id")));
  return url.toString();
}

function isAuthorizePayload(payload: DerivRequestPayload) {
  return typeof payload.authorize === "string";
}

function isBalanceSubscribePayload(payload: DerivRequestPayload) {
  return payload.balance === 1 && payload.subscribe === 1;
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

function sourceLabel(personal = false) {
  return personal ? "PERSONAL_DERIV_DEMO" : "Deriv DEMO Read-Only";
}

function parseNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

export function getDerivDemoConfig(): DerivClientConfig {
  const apiTokenConfigured = isDerivApiTokenConfigured(env("DERIV_API_TOKEN"));
  const appId = normalizeDerivAppId(env("DERIV_APP_ID"));
  logSafeTokenConfigured(apiTokenConfigured);
  logSafeAppIdPresent(Boolean(appId));

  return {
    enabled: boolEnv("DERIV_ENABLED"),
    appId,
    apiTokenConfigured,
    endpoint: env("DERIV_ENDPOINT")?.trim() || DEFAULT_DERIV_ENDPOINT,
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
        source: sourceLabel(),
        updatedAt: message.tick?.epoch ? new Date(message.tick.epoch * 1000).toISOString() : now(),
      };
    } catch (error) {
      this.connected = false;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = error instanceof Error ? error.message : "Deriv DEMO tick read failed.";
      return unavailableTicker(symbol, sourceLabel(), this.lastMessage);
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
          source: sourceLabel(),
        };
      });
    } catch (error) {
      this.connected = false;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = error instanceof Error ? error.message : "Deriv DEMO candles read failed.";
      return [];
    }
  }

  async testPersonalToken(token: string): Promise<DerivPersonalTokenTestResult> {
    const trimmed = token.trim();
    const startedAt = Date.now();

    if (!this.isPersonalConnectorConfigured()) {
      return {
        ok: false,
        connected: false,
        accountType: "UNKNOWN",
        status: "DISCONNECTED",
        source: "PERSONAL_DERIV_DEMO",
        loginid: null,
        latencyMs: null,
        message: "DERIV_APP_ID is required for Deriv DEMO personal connector.",
      };
    }

    if (trimmed.length < 6) {
      return {
        ok: false,
        connected: false,
        accountType: "UNKNOWN",
        status: "INVALID",
        source: "PERSONAL_DERIV_DEMO",
        loginid: null,
        latencyMs: Date.now() - startedAt,
        message: "Deriv token is missing or too short.",
      };
    }

    try {
      const [message, balanceMessage] = await this.requestPersonalAuthorizeAndBalance(trimmed);
      const authorize = message.authorize;

      if (!authorize) {
        throw new Error("Deriv did not return an authorize payload.");
      }

      if (authorize.is_virtual !== 1) {
        return {
          ok: false,
          connected: false,
          accountType: "REAL",
          status: "INVALID",
          source: "PERSONAL_DERIV_DEMO",
          loginid: authorize.loginid ?? null,
          latencyMs: Date.now() - startedAt,
          message: "Only Deriv DEMO tokens are allowed. Real/live accounts are refused.",
        };
      }

      if (!authorize.loginid?.startsWith("VRTC")) {
        return {
          ok: false,
          connected: false,
          accountType: "UNKNOWN",
          status: "INVALID",
          source: "PERSONAL_DERIV_DEMO",
          loginid: authorize.loginid ?? null,
          latencyMs: Date.now() - startedAt,
          message: "Deriv DEMO loginid must start with VRTC.",
        };
      }

      if (!balanceMessage.balance) {
        throw new Error("Deriv did not return a balance payload.");
      }

      this.connected = true;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = "Personal Deriv DEMO token authorized read-only with balance subscription.";

      return {
        ok: true,
        connected: true,
        accountType: "DEMO",
        status: "CONNECTED",
        source: "PERSONAL_DERIV_DEMO",
        loginid: authorize.loginid ?? null,
        latencyMs: this.latencyMs,
        message: "Compte Deriv DEMO personnel connecté en lecture seule.",
      };
    } catch (error) {
      this.connected = false;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = error instanceof Error ? error.message : "Deriv DEMO token authorization failed.";

      return {
        ok: false,
        connected: false,
        accountType: "UNKNOWN",
        status: "INVALID",
        source: "PERSONAL_DERIV_DEMO",
        loginid: null,
        latencyMs: this.latencyMs,
        message: this.lastMessage,
      };
    }
  }

  async getTickerWithPersonalToken(token: string, symbol: string): Promise<NormalizedTicker> {
    const auth = await this.testPersonalToken(token);
    if (!auth.ok) return unavailableTicker(symbol, sourceLabel(true), auth.message);

    const startedAt = Date.now();

    try {
      const message = await this.request({ ticks: symbol });
      const quote = message.tick?.quote;

      if (typeof quote !== "number") {
        throw new Error(message.error?.message ?? "Deriv tick unavailable");
      }

      this.connected = true;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = "Personal Deriv DEMO tick read succeeded.";

      return {
        symbol,
        category: "derivSynthetic",
        price: quote,
        changePercent: null,
        volume: null,
        trend: "sideways",
        status: "live",
        source: sourceLabel(true),
        updatedAt: message.tick?.epoch ? new Date(message.tick.epoch * 1000).toISOString() : now(),
        providerMessage: "Personal Deriv DEMO read-only token authorized.",
      };
    } catch (error) {
      this.connected = false;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = error instanceof Error ? error.message : "Personal Deriv DEMO tick read failed.";
      return unavailableTicker(symbol, sourceLabel(true), this.lastMessage);
    }
  }

  async getCandlesWithPersonalToken(token: string, symbol: string, timeframe: MarketTimeframe, limit = 120): Promise<readonly NormalizedCandle[]> {
    const auth = await this.testPersonalToken(token);
    if (!auth.ok) return [];

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
      this.lastMessage = "Personal Deriv DEMO candles read succeeded.";

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
          source: sourceLabel(true),
        };
      });
    } catch (error) {
      this.connected = false;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = error instanceof Error ? error.message : "Personal Deriv DEMO candles read failed.";
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
    return this.config.enabled && Boolean(normalizeDerivAppId(this.config.appId ?? undefined)) && this.config.accountType === "demo";
  }

  private isPersonalConnectorConfigured() {
    return Boolean(normalizeDerivAppId(this.config.appId ?? undefined)) && this.config.accountType === "demo";
  }

  private async requestPersonalAuthorizeAndBalance(token: string): Promise<readonly [DerivMessage, DerivMessage]> {
    if (this.transport !== defaultDerivRequestTransport) {
      const authorize = await this.request({ authorize: token });

      if (authorize.authorize?.is_virtual !== 1) {
        return [authorize, {}];
      }

      const balance = await this.request({ balance: 1, subscribe: 1 });
      return [authorize, balance];
    }

    const [authorize, balance] = await this.requestSequence([
      { authorize: token },
      { balance: 1, subscribe: 1 },
    ]);

    return [authorize ?? {}, balance ?? {}];
  }

  private async requestSequence(payloads: readonly DerivRequestPayload[]): Promise<readonly DerivMessage[]> {
    const appId = normalizeDerivAppId(this.config.appId ?? undefined);

    if (!appId) {
      throw new Error("DERIV_APP_ID must be a numeric Deriv app id for WebSocket requests.");
    }

    const WebSocketCtor = globalThis.WebSocket;

    if (!WebSocketCtor) {
      throw new Error("WebSocket runtime is not available.");
    }

    const endpoint = buildEndpoint(this.config.endpoint, appId);

    return new Promise((resolve, reject) => {
      const socket = new WebSocketCtor(endpoint);
      const responses: DerivMessage[] = [];
      let index = 0;
      let opened = false;
      let authorizeSent = false;
      let balanceSent = false;

      const timeout = setTimeout(() => {
        socket.close();
        if (!opened) logSafeDerivWsStep("DERIV_WS_OPENED", false);
        if (!authorizeSent) logSafeDerivWsStep("DERIV_AUTHORIZE_SENT", false);
        if (!balanceSent) logSafeDerivWsStep("DERIV_BALANCE_SENT", false);
        reject(new Error("Deriv WebSocket request timed out."));
      }, 10000);

      const fail = (message: string) => {
        clearTimeout(timeout);
        socket.close();
        if (!opened) logSafeDerivWsStep("DERIV_WS_OPENED", false);
        if (!authorizeSent) logSafeDerivWsStep("DERIV_AUTHORIZE_SENT", false);
        if (!balanceSent) logSafeDerivWsStep("DERIV_BALANCE_SENT", false);
        reject(new Error(message));
      };

      const sendNext = () => {
        const payload = payloads[index];

        if (!payload) {
          clearTimeout(timeout);
          socket.close();
          resolve(responses);
          return;
        }

        if (isAuthorizePayload(payload)) {
          authorizeSent = true;
          logSafeDerivWsStep("DERIV_AUTHORIZE_SENT", true);
        }
        if (isBalanceSubscribePayload(payload)) {
          balanceSent = true;
          logSafeDerivWsStep("DERIV_BALANCE_SENT", true);
        }
        socket.send(JSON.stringify(payload));
      };

      socket.addEventListener("open", () => {
        opened = true;
        logSafeDerivWsStep("DERIV_WS_OPENED", true);
        sendNext();
      });

      socket.addEventListener("message", event => {
        try {
          const message = JSON.parse(String(event.data)) as DerivMessage;

          if (message.error) {
            fail(message.error.message ?? "Deriv WebSocket returned an error.");
            return;
          }

          responses.push(message);
          index += 1;
          sendNext();
        } catch {
          fail("Invalid Deriv WebSocket response.");
        }
      });

      socket.addEventListener("error", () => {
        logSafeDerivWsStep("DERIV_WS_OPENED", opened);
        if (!authorizeSent) logSafeDerivWsStep("DERIV_AUTHORIZE_SENT", false);
        if (!balanceSent) logSafeDerivWsStep("DERIV_BALANCE_SENT", false);
        fail("Deriv WebSocket connection failed.");
      });
    });
  }

  private async request(payload: DerivRequestPayload): Promise<DerivMessage> {
    const appId = normalizeDerivAppId(this.config.appId ?? undefined);

    if (!appId) {
      throw new Error("DERIV_APP_ID must be a numeric Deriv app id for WebSocket requests.");
    }

    const endpoint = buildEndpoint(this.config.endpoint, appId);
    return this.transport(endpoint, payload);
  }
}

export const derivDemoReadOnlyClient = new DerivDemoReadOnlyClient();
