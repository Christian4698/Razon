import WebSocket from "ws";
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

interface DerivRestAccount {
  readonly id?: string;
  readonly accountId?: string;
  readonly account_id?: string;
  readonly loginid?: string;
  readonly login_id?: string;
  readonly type?: string;
  readonly account_type?: string;
  readonly environment?: string;
  readonly is_virtual?: boolean | 0 | 1;
}

interface DerivRestResponse {
  readonly data?: unknown;
  readonly errors?: readonly { readonly message?: string; readonly code?: string; readonly status?: string }[];
  readonly error?: { readonly message?: string; readonly code?: string };
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
  readonly wsAppId: string | null;
  readonly wsAppIdPresent: boolean;
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
  readonly source: "PERSONAL_DERIV_DEMO" | "PERSONAL_DERIV_DEMO_OAUTH";
  readonly loginid: string | null;
  readonly accountId: string | null;
  readonly balanceAvailable: boolean;
  readonly tickReceived: boolean;
  readonly candleReceived: boolean;
  readonly dataQuality: "GOOD" | "DISCONNECTED";
  readonly latencyMs: number | null;
  readonly message: string;
}

export interface DerivDiagnostics {
  readonly wsAppIdPresent: boolean;
  readonly wsAppIdFormat: "NUMERIC" | "MISSING";
  readonly patAppIdPresent: boolean;
  readonly patAppIdFormat: "PAT" | "NUMERIC" | "UNKNOWN";
  readonly endpointValid: boolean;
  readonly oauthStartReached: boolean;
  readonly authPassed: boolean;
  readonly pkceGenerated: boolean;
  readonly oauthRedirectIssued: boolean;
  readonly oauthRedirectReady: boolean;
  readonly oauthCallbackOk: boolean;
  readonly oauthTokenExchangeOk: boolean;
  readonly restAuthOk: boolean;
  readonly optionsAccountsOk: boolean;
  readonly accountDiscoveryOk: boolean;
  readonly demoAccountFound: boolean;
  readonly otpRequestSent: boolean;
  readonly otpOk: boolean;
  readonly demoWsOpened: boolean;
  readonly wsOpened: boolean;
  readonly authorizeSent: boolean;
  readonly authorizeOk: boolean;
  readonly demoAccount: boolean;
  readonly loginidPrefix: "VRTC" | "REAL" | "UNKNOWN";
  readonly balanceSent: boolean;
  readonly balanceOk: boolean;
  readonly tickSubscribeSent: boolean;
  readonly tickReceived: boolean;
  readonly candleSubscribeSent: boolean;
  readonly candleReceived: boolean;
  readonly lastError: string | null;
  readonly source: "PERSONAL_DERIV_DEMO" | "PERSONAL_DERIV_DEMO_OAUTH" | "DEMO" | "MOCK_DATA";
  readonly liveExecutionEnabled: false;
  readonly orderPlacementAllowed: false;
  readonly secretsExposed: false;
}

const defaultDerivRequestTransport: DerivRequestTransport = (endpoint, payload) => {
  validateWsPackageAvailable();

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
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

    socket.on("open", () => {
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

    socket.on("message", data => {
      clearTimeout(timeout);
      socket.close();

      try {
        const message = JSON.parse(data.toString()) as DerivMessage;

        if (message.error) {
          reject(new Error(message.error.message ?? "Deriv WebSocket returned an error."));
          return;
        }

        resolve(message);
      } catch {
        reject(new Error("Invalid Deriv WebSocket response."));
      }
    });

    socket.on("error", () => {
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
const DEFAULT_DERIV_WS_APP_ID = "1089";
const DEFAULT_DERIV_REST_BASE_URL = "https://api.derivws.com";

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
  if (unquoted.length > 128) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(unquoted)) return null;
  return unquoted;
}

function normalizeDerivWsAppId(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) return DEFAULT_DERIV_WS_APP_ID;

  const unquoted = trimmed.replace(/^["'](.+)["']$/, "$1").trim();
  return /^\d+$/.test(unquoted) ? unquoted : null;
}

function derivPatAppIdFormat(value: string | null | undefined): DerivDiagnostics["patAppIdFormat"] {
  if (!value) return "UNKNOWN";
  if (/^\d+$/.test(value)) return "NUMERIC";
  if (/^[a-zA-Z0-9_-]+$/.test(value)) return "PAT";
  return "UNKNOWN";
}

function derivWsAppIdFormat(value: string | null | undefined): DerivDiagnostics["wsAppIdFormat"] {
  return value && /^\d+$/.test(value) ? "NUMERIC" : "MISSING";
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
  console.info(`[RAZON Deriv] DERIV_WS_APP_ID_EFFECTIVE=${appIdPresent}`);
}

function logSafeDerivWsUrlValid(valid: boolean) {
  if (lastLoggedDerivWsUrlValid === valid) return;

  lastLoggedDerivWsUrlValid = valid;
  console.info(`[RAZON Deriv] DERIV_WS_URL_VALID=${valid}`);
}

function logSafeDerivWsStep(step: string, value: boolean) {
  console.info(`[RAZON Deriv] ${step}=${value}`);
}

function logSafeDerivStage(step: string, value: boolean) {
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
  const normalizedAppId = normalizeDerivWsAppId(appId);
  let url: URL;
  let endpointValid = true;

  try {
    url = new URL(rawEndpoint);
  } catch {
    endpointValid = false;
    url = new URL(DEFAULT_DERIV_ENDPOINT);
  }

  if (url.protocol !== "wss:" || url.hostname !== "ws.derivws.com") {
    endpointValid = false;
    url = new URL(DEFAULT_DERIV_ENDPOINT);
  }

  if (url.pathname !== "/websockets/v3") {
    endpointValid = false;
    url.pathname = "/websockets/v3";
  }

  if (normalizedAppId) {
    url.search = "";
    url.searchParams.set("app_id", normalizedAppId);
  } else {
    endpointValid = false;
  }

  endpointValid = endpointValid && url.protocol === "wss:" && url.searchParams.getAll("app_id").length === 1;
  logSafeDerivWsUrlValid(endpointValid);
  return url.toString();
}

function isAuthorizePayload(payload: DerivRequestPayload) {
  return typeof payload.authorize === "string";
}

function isBalanceSubscribePayload(payload: DerivRequestPayload) {
  return payload.balance === 1 && payload.subscribe === 1;
}

function isTickSubscribePayload(payload: DerivRequestPayload) {
  return typeof payload.ticks === "string" && payload.subscribe === 1;
}

function isCandlePayload(payload: DerivRequestPayload) {
  return typeof payload.ticks_history === "string" && payload.style === "candles";
}

function validateWsPackageAvailable() {
  if (typeof WebSocket !== "function") {
    throw new Error("WebSocket dependency ws is not available.");
  }
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
  return personal ? "PERSONAL_DERIV_DEMO_OAUTH" : "Deriv DEMO Read-Only";
}

function parseNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function normalizeRestBaseUrl(value: string | undefined) {
  const raw = value?.trim() || DEFAULT_DERIV_REST_BASE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "api.derivws.com") return DEFAULT_DERIV_REST_BASE_URL;
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_DERIV_REST_BASE_URL;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractAccounts(payload: DerivRestResponse): DerivRestAccount[] {
  const data = payload.data;
  if (Array.isArray(data)) return data.filter(asRecord) as DerivRestAccount[];

  const record = asRecord(data);
  if (!record) return [];

  for (const key of ["accounts", "items", "result", "options_accounts"]) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter(asRecord) as DerivRestAccount[];
  }

  return [];
}

function accountIdOf(account: DerivRestAccount) {
  return account.accountId ?? account.account_id ?? account.id ?? account.loginid ?? account.login_id ?? null;
}

function loginidOf(account: DerivRestAccount) {
  return account.loginid ?? account.login_id ?? account.accountId ?? account.account_id ?? account.id ?? null;
}

function isDemoAccount(account: DerivRestAccount) {
  const values = [
    account.type,
    account.account_type,
    account.environment,
    account.loginid,
    account.login_id,
    account.accountId,
    account.account_id,
    account.id,
  ]
    .filter((value): value is string => typeof value === "string")
    .map(value => value.toUpperCase());

  return account.is_virtual === true || account.is_virtual === 1 || values.some(value => value.includes("DEMO") || value.startsWith("VRTC"));
}

export function getDerivDemoConfig(): DerivClientConfig {
  const apiTokenConfigured = isDerivApiTokenConfigured(env("DERIV_API_TOKEN"));
  const wsAppIdRaw = env("DERIV_WS_APP_ID");
  const wsAppId = normalizeDerivWsAppId(wsAppIdRaw);
  const appId = normalizeDerivAppId(env("DERIV_OAUTH_CLIENT_ID")) ?? normalizeDerivAppId(env("DERIV_APP_ID"));
  logSafeTokenConfigured(apiTokenConfigured);
  logSafeAppIdPresent(Boolean(wsAppId));

  return {
    enabled: boolEnv("DERIV_ENABLED"),
    wsAppId,
    wsAppIdPresent: Boolean(wsAppIdRaw?.trim()),
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
  private diagnostics: DerivDiagnostics;

  constructor(
    config: DerivClientConfig = getDerivDemoConfig(),
    transport: DerivRequestTransport = defaultDerivRequestTransport
  ) {
    this.config = config;
    this.transport = transport;
    this.diagnostics = this.createDiagnostics();
  }

  async connect(): Promise<DerivConnectorHealth> {
    if (!this.isConfigured()) {
      this.connected = false;
      this.latencyMs = null;
      this.lastMessage = "DERIV_ENABLED and a numeric DERIV_WS_APP_ID or fallback app id are required for Deriv DEMO read-only.";
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
    this.patchDiagnostics({
      wsOpened: false,
      authorizeOk: false,
      demoAccount: false,
      balanceOk: false,
      tickReceived: false,
      candleReceived: false,
      source: "MOCK_DATA",
      lastError: this.lastMessage,
    });
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
      appIdConfigured: Boolean(this.config.wsAppId),
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
    this.resetDiagnostics("PERSONAL_DERIV_DEMO_OAUTH");

    if (!this.isPersonalConnectorConfigured()) {
      this.patchDiagnostics({ lastError: "A numeric DERIV_WS_APP_ID or fallback app id is required for Deriv DEMO personal connector." });
      return {
        ok: false,
        connected: false,
        accountType: "UNKNOWN",
        status: "DISCONNECTED",
        source: "PERSONAL_DERIV_DEMO_OAUTH",
        loginid: null,
        accountId: null,
        balanceAvailable: false,
        tickReceived: false,
        candleReceived: false,
        dataQuality: "DISCONNECTED",
        latencyMs: null,
        message: "A numeric DERIV_WS_APP_ID or fallback app id is required for Deriv DEMO personal connector.",
      };
    }

    if (trimmed.length < 6) {
      this.patchDiagnostics({ lastError: "Deriv token is missing or too short." });
      return {
        ok: false,
        connected: false,
        accountType: "UNKNOWN",
        status: "INVALID",
        source: "PERSONAL_DERIV_DEMO_OAUTH",
        loginid: null,
        accountId: null,
        balanceAvailable: false,
        tickReceived: false,
        candleReceived: false,
        dataQuality: "DISCONNECTED",
        latencyMs: Date.now() - startedAt,
        message: "Deriv token is missing or too short.",
      };
    }

    try {
      const testSymbol = await this.resolveProviderSymbol("Boom 500", "BOOM500");
      const account = await this.discoverDemoAccount(trimmed);
      const accountId = accountIdOf(account);
      const loginid = loginidOf(account);

      if (!accountId || !loginid) {
        throw new Error("BLOCKED_ACCOUNT_ID_REQUIRED: Deriv account discovery did not return a readable demo account id/loginid.");
      }

      if (!loginid.startsWith("VRTC") && !isDemoAccount(account)) {
        this.patchDiagnostics({
          authorizeOk: true,
          demoAccount: false,
          loginidPrefix: loginid ? "REAL" : "UNKNOWN",
          lastError: "Only Deriv DEMO accounts are allowed. Real/live accounts are refused.",
        });
        return {
          ok: false,
          connected: false,
          accountType: "REAL",
          status: "INVALID",
          source: "PERSONAL_DERIV_DEMO_OAUTH",
          loginid,
          accountId,
          balanceAvailable: false,
          tickReceived: false,
          candleReceived: false,
          dataQuality: "DISCONNECTED",
          latencyMs: Date.now() - startedAt,
          message: "Only Deriv DEMO accounts are allowed. Real/live accounts are refused.",
        };
      }

      const demoWsUrl = await this.requestDemoOtp(trimmed, accountId);
      const [balanceMessage, tickMessage, candleMessage] = await this.requestAuthenticatedDemoSequence(demoWsUrl, testSymbol);

      if (!balanceMessage.balance) {
        throw new Error("Deriv did not return a balance payload.");
      }
      if (typeof tickMessage.tick?.quote !== "number") {
        throw new Error("Deriv did not return a subscribed tick payload.");
      }
      if (!Array.isArray(candleMessage.candles) || candleMessage.candles.length === 0) {
        throw new Error("Deriv did not return candle history.");
      }

      this.connected = true;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = "Personal Deriv DEMO token authorized read-only with balance, tick, and candle data.";
      this.patchDiagnostics({
        authorizeOk: true,
        demoAccount: true,
        loginidPrefix: "VRTC",
        balanceOk: true,
        tickReceived: true,
        candleReceived: true,
        lastError: null,
      });

      return {
        ok: true,
        connected: true,
        accountType: "DEMO",
        status: "CONNECTED",
        source: "PERSONAL_DERIV_DEMO_OAUTH",
        loginid,
        accountId,
        balanceAvailable: true,
        tickReceived: true,
        candleReceived: true,
        dataQuality: "GOOD",
        latencyMs: this.latencyMs,
        message: "Compte Deriv DEMO personnel connecté en lecture seule.",
      };
    } catch (error) {
      this.connected = false;
      this.latencyMs = Date.now() - startedAt;
      this.lastMessage = error instanceof Error ? error.message : "Deriv DEMO token authorization failed.";
      this.patchDiagnostics({ lastError: this.lastMessage });

      return {
        ok: false,
        connected: false,
        accountType: "UNKNOWN",
        status: "INVALID",
        source: "PERSONAL_DERIV_DEMO_OAUTH",
        loginid: null,
        accountId: null,
        balanceAvailable: false,
        tickReceived: false,
        candleReceived: false,
        dataQuality: "DISCONNECTED",
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

  getDiagnostics(): DerivDiagnostics {
    return { ...this.diagnostics };
  }

  updateOAuthDiagnostics(
    patch: Pick<
      Partial<DerivDiagnostics>,
      | "oauthStartReached"
      | "authPassed"
      | "pkceGenerated"
      | "oauthRedirectIssued"
      | "oauthRedirectReady"
      | "oauthCallbackOk"
      | "oauthTokenExchangeOk"
      | "lastError"
    >
  ) {
    this.patchDiagnostics(patch);
  }

  async resolveProviderSymbol(displayName: string, fallbackSymbol: string): Promise<string> {
    try {
      const symbols = await this.getActiveSymbols();
      const normalizedDisplay = displayName.toLowerCase();
      const exact = symbols.find(item => item.display_name?.toLowerCase() === normalizedDisplay);
      if (exact?.symbol) return exact.symbol;

      const fallback = symbols.find(item => item.symbol?.toUpperCase() === fallbackSymbol.toUpperCase());
      if (fallback?.symbol) return fallback.symbol;
    } catch {
      // Keep the known code and let the following Deriv request expose the failing stage.
    }

    return fallbackSymbol;
  }

  private async discoverDemoAccount(token: string): Promise<DerivRestAccount> {
    const response = await this.restRequest(token, "/trading/v1/options/accounts", "GET");
    const accounts = extractAccounts(response);
    this.patchDiagnostics({ restAuthOk: true, optionsAccountsOk: true, accountDiscoveryOk: accounts.length > 0 });
    logSafeDerivStage("REST_AUTH_OK", true);
    logSafeDerivStage("OPTIONS_ACCOUNTS_OK", true);
    logSafeDerivStage("ACCOUNT_DISCOVERY_OK", accounts.length > 0);

    const demo = accounts.find(isDemoAccount);
    if (!demo && accounts[0]) {
      this.patchDiagnostics({
        demoAccountFound: false,
        demoAccount: false,
        loginidPrefix: loginidOf(accounts[0]) ? "REAL" : "UNKNOWN",
      });
      return accounts[0];
    }

    if (!demo) {
      this.patchDiagnostics({
        demoAccountFound: false,
        lastError: "BLOCKED_ACCOUNT_ID_REQUIRED: no readable Deriv DEMO account found in REST account discovery response.",
      });
      throw new Error("BLOCKED_ACCOUNT_ID_REQUIRED: no readable Deriv DEMO account found in REST account discovery response.");
    }

    this.patchDiagnostics({
      demoAccountFound: true,
      demoAccount: true,
      loginidPrefix: loginidOf(demo)?.startsWith("VRTC") ? "VRTC" : "UNKNOWN",
      authorizeOk: true,
    });
    logSafeDerivStage("DEMO_ACCOUNT_FOUND", true);
    return demo;
  }

  private async requestDemoOtp(token: string, accountId: string): Promise<string> {
    this.patchDiagnostics({ otpRequestSent: true });
    const response = await this.restRequest(
      token,
      `/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`,
      "POST"
    );
    const data = asRecord(response.data);
    const url = typeof data?.url === "string" ? data.url : typeof (response as { url?: unknown }).url === "string" ? (response as { url: string }).url : null;

    if (!url) {
      this.patchDiagnostics({ otpOk: false, lastError: "Deriv OTP response did not include a WebSocket URL." });
      logSafeDerivStage("OTP_OK", false);
      throw new Error("Deriv OTP response did not include a WebSocket URL.");
    }

    const parsed = new URL(url);
    if (parsed.protocol !== "wss:" || parsed.hostname !== "api.derivws.com" || !parsed.pathname.includes("/ws/demo")) {
      this.patchDiagnostics({ otpOk: false, lastError: "Deriv OTP response did not return a DEMO WebSocket URL." });
      logSafeDerivStage("OTP_OK", false);
      throw new Error("Deriv OTP response did not return a DEMO WebSocket URL.");
    }

    this.patchDiagnostics({ otpOk: true });
    logSafeDerivStage("OTP_OK", true);
    return url;
  }

  private async restRequest(token: string, path: string, method: "GET" | "POST"): Promise<DerivRestResponse> {
    const appId = this.config.appId;
    if (!appId) {
      this.patchDiagnostics({ lastError: "REST_AUTH: DERIV_APP_ID or DERIV_OAUTH_CLIENT_ID is required for Deriv OAuth REST calls." });
      throw new Error("REST_AUTH: DERIV_APP_ID or DERIV_OAUTH_CLIENT_ID is required for Deriv OAuth REST calls.");
    }

    const url = `${normalizeRestBaseUrl(env("DERIV_REST_BASE_URL"))}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Deriv-App-ID": appId,
      },
    });
    const payload = (await response.json().catch(() => ({}))) as DerivRestResponse;

    if (!response.ok || payload.error || (payload.errors?.length ?? 0) > 0) {
      const message = payload.error?.message ?? payload.errors?.[0]?.message ?? `Deriv REST returned ${response.status}`;
      this.patchDiagnostics({ restAuthOk: false, optionsAccountsOk: false, lastError: `REST_AUTH: ${message}` });
      logSafeDerivStage("REST_AUTH_OK", false);
      throw new Error(`REST_AUTH: ${message}`);
    }

    this.patchDiagnostics({ restAuthOk: true });
    logSafeDerivStage("REST_AUTH_OK", true);
    return payload;
  }

  private isConfigured() {
    return this.config.enabled && Boolean(normalizeDerivWsAppId(this.config.wsAppId ?? undefined)) && this.config.accountType === "demo";
  }

  private isPersonalConnectorConfigured() {
    return Boolean(normalizeDerivWsAppId(this.config.wsAppId ?? undefined)) && this.config.accountType === "demo";
  }

  private async requestPersonalConnectionProbe(token: string, symbol: string): Promise<readonly [DerivMessage, DerivMessage, DerivMessage, DerivMessage]> {
    if (this.transport !== defaultDerivRequestTransport) {
      const authorize = await this.request({ authorize: token });

      if (authorize.authorize?.is_virtual !== 1) {
        return [authorize, {}, {}, {}];
      }

      const balance = await this.request({ balance: 1, subscribe: 1 });
      const tick = await this.request({ ticks: symbol, subscribe: 1 });
      const candles = await this.request({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: 2,
        end: "latest",
        granularity: granularityMap["1m"],
        style: "candles",
      });
      return [authorize, balance, tick, candles];
    }

    const [authorize, balance, tick, candles] = await this.requestSequence([
      { authorize: token },
      { balance: 1, subscribe: 1 },
      { ticks: symbol, subscribe: 1 },
      {
        ticks_history: symbol,
        adjust_start_time: 1,
        count: 2,
        end: "latest",
        granularity: granularityMap["1m"],
        style: "candles",
      },
    ]);

    return [authorize ?? {}, balance ?? {}, tick ?? {}, candles ?? {}];
  }

  private async requestAuthenticatedDemoSequence(wsUrl: string, symbol: string): Promise<readonly [DerivMessage, DerivMessage, DerivMessage]> {
    if (this.transport !== defaultDerivRequestTransport) {
      this.patchDiagnostics({ wsOpened: true, demoWsOpened: true });
      const balance = await this.transport(wsUrl, { balance: 1, subscribe: 1 });
      if (balance.balance) this.patchDiagnostics({ balanceSent: true, balanceOk: true });
      const tick = await this.transport(wsUrl, { ticks: symbol, subscribe: 1 });
      if (tick.tick) this.patchDiagnostics({ tickSubscribeSent: true, tickReceived: true });
      const candles = await this.transport(wsUrl, {
        ticks_history: symbol,
        adjust_start_time: 1,
        count: 2,
        end: "latest",
        granularity: granularityMap["1m"],
        style: "candles",
      });
      if (Array.isArray(candles.candles) && candles.candles.length > 0) this.patchDiagnostics({ candleSubscribeSent: true, candleReceived: true });
      return [balance, tick, candles];
    }

    validateWsPackageAvailable();

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      const responses: DerivMessage[] = [];
      const payloads: DerivRequestPayload[] = [
        { balance: 1, subscribe: 1 },
        { ticks: symbol, subscribe: 1 },
        {
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 2,
          end: "latest",
          granularity: granularityMap["1m"],
          style: "candles",
        },
      ];
      let index = 0;
      let opened = false;

      const timeout = setTimeout(() => {
        socket.close();
        if (!opened) logSafeDerivWsStep("DERIV_DEMO_WS_OPENED", false);
        this.patchDiagnostics({ lastError: "Deriv DEMO OTP WebSocket request timed out." });
        reject(new Error("Deriv DEMO OTP WebSocket request timed out."));
      }, 12000);

      const fail = (message: string) => {
        clearTimeout(timeout);
        socket.close();
        this.patchDiagnostics({ lastError: message });
        reject(new Error(message));
      };

      const sendNext = () => {
        const payload = payloads[index];
        if (!payload) {
          clearTimeout(timeout);
          socket.close();
          resolve([responses[0] ?? {}, responses[1] ?? {}, responses[2] ?? {}]);
          return;
        }

        if (isBalanceSubscribePayload(payload)) {
          logSafeDerivWsStep("DERIV_BALANCE_SENT", true);
          this.patchDiagnostics({ balanceSent: true });
        }
        if (isTickSubscribePayload(payload)) {
          logSafeDerivWsStep("DERIV_TICK_SUBSCRIBE_SENT", true);
          this.patchDiagnostics({ tickSubscribeSent: true });
        }
        if (isCandlePayload(payload)) {
          logSafeDerivWsStep("DERIV_CANDLE_SUBSCRIBE_SENT", true);
          this.patchDiagnostics({ candleSubscribeSent: true });
        }
        socket.send(JSON.stringify(payload));
      };

      socket.on("open", () => {
        opened = true;
        logSafeDerivWsStep("DERIV_DEMO_WS_OPENED", true);
        logSafeDerivStage("DEMO_WS_OPENED", true);
        this.patchDiagnostics({ wsOpened: true, demoWsOpened: true });
        sendNext();
      });

      socket.on("message", data => {
        try {
          const message = JSON.parse(data.toString()) as DerivMessage;
          if (message.error) {
            fail(message.error.message ?? "Deriv DEMO OTP WebSocket returned an error.");
            return;
          }

          if (message.balance) {
            logSafeDerivWsStep("DERIV_BALANCE_OK", true);
            this.patchDiagnostics({ balanceOk: true });
          }
          if (message.tick) {
            logSafeDerivWsStep("DERIV_TICK_RECEIVED", true);
            this.patchDiagnostics({ tickReceived: true });
          }
          if (Array.isArray(message.candles) && message.candles.length > 0) {
            logSafeDerivWsStep("DERIV_CANDLE_RECEIVED", true);
            this.patchDiagnostics({ candleReceived: true });
          }

          responses.push(message);
          index += 1;
          sendNext();
        } catch {
          fail("Invalid Deriv DEMO OTP WebSocket response.");
        }
      });

      socket.on("error", () => {
        if (!opened) logSafeDerivWsStep("DERIV_DEMO_WS_OPENED", false);
        if (!opened) logSafeDerivStage("DEMO_WS_OPENED", false);
        fail("Deriv DEMO OTP WebSocket connection failed.");
      });
    });
  }

  private async requestSequence(payloads: readonly DerivRequestPayload[]): Promise<readonly DerivMessage[]> {
    const appId = normalizeDerivWsAppId(this.config.wsAppId ?? undefined);

    if (!appId) {
      throw new Error("DERIV_WS_APP_ID must be numeric for Deriv WebSocket requests.");
    }

    validateWsPackageAvailable();

    const endpoint = buildEndpoint(this.config.endpoint, appId);

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(endpoint);
      const responses: DerivMessage[] = [];
      let index = 0;
      let opened = false;
      let authorizeSent = false;
      let balanceSent = false;
      let tickSubscribeSent = false;
      let candleSubscribeSent = false;

      const timeout = setTimeout(() => {
        socket.close();
        if (!opened) logSafeDerivWsStep("DERIV_WS_OPENED", false);
        if (!authorizeSent) logSafeDerivWsStep("DERIV_AUTHORIZE_SENT", false);
        if (!balanceSent) logSafeDerivWsStep("DERIV_BALANCE_SENT", false);
        if (!tickSubscribeSent) logSafeDerivWsStep("DERIV_TICK_SUBSCRIBE_SENT", false);
        if (!candleSubscribeSent) logSafeDerivWsStep("DERIV_CANDLE_SUBSCRIBE_SENT", false);
        this.patchDiagnostics({ lastError: "Deriv WebSocket request timed out." });
        reject(new Error("Deriv WebSocket request timed out."));
      }, 10000);

      const fail = (message: string) => {
        clearTimeout(timeout);
        socket.close();
        if (!opened) logSafeDerivWsStep("DERIV_WS_OPENED", false);
        if (!authorizeSent) logSafeDerivWsStep("DERIV_AUTHORIZE_SENT", false);
        if (!balanceSent) logSafeDerivWsStep("DERIV_BALANCE_SENT", false);
        if (!tickSubscribeSent) logSafeDerivWsStep("DERIV_TICK_SUBSCRIBE_SENT", false);
        if (!candleSubscribeSent) logSafeDerivWsStep("DERIV_CANDLE_SUBSCRIBE_SENT", false);
        this.patchDiagnostics({ lastError: message });
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
          this.patchDiagnostics({ authorizeSent: true });
        }
        if (isBalanceSubscribePayload(payload)) {
          balanceSent = true;
          logSafeDerivWsStep("DERIV_BALANCE_SENT", true);
          this.patchDiagnostics({ balanceSent: true });
        }
        if (isTickSubscribePayload(payload)) {
          tickSubscribeSent = true;
          logSafeDerivWsStep("DERIV_TICK_SUBSCRIBE_SENT", true);
          this.patchDiagnostics({ tickSubscribeSent: true });
        }
        if (isCandlePayload(payload)) {
          candleSubscribeSent = true;
          logSafeDerivWsStep("DERIV_CANDLE_SUBSCRIBE_SENT", true);
          this.patchDiagnostics({ candleSubscribeSent: true });
        }
        socket.send(JSON.stringify(payload));
      };

      socket.on("open", () => {
        opened = true;
        logSafeDerivWsStep("DERIV_WS_OPENED", true);
        this.patchDiagnostics({ wsOpened: true });
        sendNext();
      });

      socket.on("message", data => {
        try {
          const message = JSON.parse(data.toString()) as DerivMessage;

          if (message.error) {
            fail(message.error.message ?? "Deriv WebSocket returned an error.");
            return;
          }

          if (message.authorize) {
            const prefix = message.authorize.loginid?.startsWith("VRTC")
              ? "VRTC"
              : message.authorize.loginid
                ? "REAL"
                : "UNKNOWN";
            logSafeDerivWsStep("DERIV_AUTHORIZE_OK", true);
            console.info(`[RAZON Deriv] DERIV_LOGINID_PREFIX=${prefix}`);
            this.patchDiagnostics({
              authorizeOk: true,
              demoAccount: prefix === "VRTC" && message.authorize.is_virtual === 1,
              loginidPrefix: prefix,
            });
          }
          if (message.balance) {
            logSafeDerivWsStep("DERIV_BALANCE_OK", true);
            this.patchDiagnostics({ balanceOk: true });
          }
          if (message.tick) {
            logSafeDerivWsStep("DERIV_TICK_RECEIVED", true);
            this.patchDiagnostics({ tickReceived: true });
          }
          if (Array.isArray(message.candles) && message.candles.length > 0) {
            logSafeDerivWsStep("DERIV_CANDLE_RECEIVED", true);
            this.patchDiagnostics({ candleReceived: true });
          }

          responses.push(message);
          index += 1;
          sendNext();
        } catch {
          fail("Invalid Deriv WebSocket response.");
        }
      });

      socket.on("error", () => {
        logSafeDerivWsStep("DERIV_WS_OPENED", opened);
        if (!authorizeSent) logSafeDerivWsStep("DERIV_AUTHORIZE_SENT", false);
        if (!balanceSent) logSafeDerivWsStep("DERIV_BALANCE_SENT", false);
        if (!tickSubscribeSent) logSafeDerivWsStep("DERIV_TICK_SUBSCRIBE_SENT", false);
        if (!candleSubscribeSent) logSafeDerivWsStep("DERIV_CANDLE_SUBSCRIBE_SENT", false);
        fail("Deriv WebSocket connection failed.");
      });
    });
  }

  private async request(payload: DerivRequestPayload): Promise<DerivMessage> {
    const appId = normalizeDerivWsAppId(this.config.wsAppId ?? undefined);

    if (!appId) {
      throw new Error("DERIV_WS_APP_ID must be numeric for Deriv WebSocket requests.");
    }

    const endpoint = buildEndpoint(this.config.endpoint, appId);
    try {
      if (isAuthorizePayload(payload)) this.patchDiagnostics({ authorizeSent: true });
      if (isBalanceSubscribePayload(payload)) this.patchDiagnostics({ balanceSent: true });
      if (isTickSubscribePayload(payload)) this.patchDiagnostics({ tickSubscribeSent: true });
      if (isCandlePayload(payload)) this.patchDiagnostics({ candleSubscribeSent: true });

      const message = await this.transport(endpoint, payload);
      this.patchDiagnostics({ wsOpened: true, lastError: null });

      if (message.authorize) {
        const prefix = message.authorize.loginid?.startsWith("VRTC")
          ? "VRTC"
          : message.authorize.loginid
            ? "REAL"
            : "UNKNOWN";
        this.patchDiagnostics({
          authorizeOk: true,
          demoAccount: prefix === "VRTC" && message.authorize.is_virtual === 1,
          loginidPrefix: prefix,
        });
      }
      if (message.balance) this.patchDiagnostics({ balanceOk: true });
      if (message.tick) this.patchDiagnostics({ tickReceived: true });
      if (Array.isArray(message.candles) && message.candles.length > 0) this.patchDiagnostics({ candleReceived: true });

      return message;
    } catch (error) {
      this.patchDiagnostics({
        lastError: error instanceof Error ? error.message : "Deriv WebSocket request failed.",
      });
      throw error;
    }
  }

  private createDiagnostics(source: DerivDiagnostics["source"] = "DEMO"): DerivDiagnostics {
    const wsAppId = normalizeDerivWsAppId(this.config.wsAppId ?? undefined);
    const patAppId = normalizeDerivAppId(this.config.appId ?? undefined);
    const endpoint = wsAppId ? buildEndpoint(this.config.endpoint, wsAppId) : DEFAULT_DERIV_ENDPOINT;
    const endpointUrl = new URL(endpoint);

    return {
      wsAppIdPresent: this.config.wsAppIdPresent,
      wsAppIdFormat: this.config.wsAppIdPresent ? derivWsAppIdFormat(wsAppId) : "MISSING",
      patAppIdPresent: Boolean(patAppId),
      patAppIdFormat: derivPatAppIdFormat(patAppId),
      endpointValid:
        Boolean(wsAppId) &&
        endpointUrl.protocol === "wss:" &&
        endpointUrl.hostname === "ws.derivws.com" &&
        endpointUrl.pathname === "/websockets/v3" &&
        endpointUrl.searchParams.getAll("app_id").length === 1,
      oauthStartReached: false,
      authPassed: false,
      pkceGenerated: false,
      oauthRedirectIssued: false,
      oauthRedirectReady: false,
      oauthCallbackOk: false,
      oauthTokenExchangeOk: false,
      restAuthOk: false,
      optionsAccountsOk: false,
      accountDiscoveryOk: false,
      demoAccountFound: false,
      otpRequestSent: false,
      otpOk: false,
      demoWsOpened: false,
      wsOpened: false,
      authorizeSent: false,
      authorizeOk: false,
      demoAccount: false,
      loginidPrefix: "UNKNOWN",
      balanceSent: false,
      balanceOk: false,
      tickSubscribeSent: false,
      tickReceived: false,
      candleSubscribeSent: false,
      candleReceived: false,
      lastError: null,
      source,
      liveExecutionEnabled: false,
      orderPlacementAllowed: false,
      secretsExposed: false,
    };
  }

  private resetDiagnostics(source: DerivDiagnostics["source"]) {
    this.diagnostics = this.createDiagnostics(source);
  }

  private patchDiagnostics(patch: Partial<DerivDiagnostics>) {
    this.diagnostics = { ...this.diagnostics, ...patch };
  }
}

export const derivDemoReadOnlyClient = new DerivDemoReadOnlyClient();
