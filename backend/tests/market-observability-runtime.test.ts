import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DerivDemoReadOnlyClient,
  type DerivClientConfig,
  type DerivRequestTransport,
} from "../../server/services/deriv/DerivDemoReadOnlyClient";
import { DERIV_SYNTHETIC_SYMBOLS } from "../../server/services/deriv/derivSymbols";
import {
  applyKalosDataGuard,
  buildMarketDataHealth,
} from "../../server/services/market/marketObservability";
import type { NormalizedCandle, NormalizedTicker } from "../../server/services/market/marketProvider";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.resetModules();
});

function ticker(updatedAt: string): NormalizedTicker {
  return {
    symbol: "BOOM500",
    category: "derivSynthetic",
    price: 1234.56,
    changePercent: null,
    volume: null,
    trend: "sideways",
    status: "live",
    source: "Deriv DEMO Read-Only",
    updatedAt,
  };
}

function candles(count: number, updatedAt = new Date().toISOString()): NormalizedCandle[] {
  const end = Date.parse(updatedAt);

  return Array.from({ length: count }, (_, index) => ({
    symbol: "BOOM500",
    timestamp: new Date(end - (count - 1 - index) * 300000).toISOString(),
    open: 1200 + index,
    high: 1202 + index,
    low: 1198 + index,
    close: 1201 + index,
    volume: null,
    source: "Deriv DEMO Read-Only",
  }));
}

describe("Market Data Observability runtime contracts", () => {
  it("uses the correct Deriv synthetic provider symbol mapping", () => {
    expect(DERIV_SYNTHETIC_SYMBOLS["Boom 500"]).toBe("BOOM500");
    expect(DERIV_SYNTHETIC_SYMBOLS["Boom 1000"]).toBe("BOOM1000");
    expect(DERIV_SYNTHETIC_SYMBOLS["Crash 500"]).toBe("CRASH500");
    expect(DERIV_SYNTHETIC_SYMBOLS["Crash 1000"]).toBe("CRASH1000");
    expect(DERIV_SYNTHETIC_SYMBOLS["Volatility 10"]).toBe("R_10");
    expect(DERIV_SYNTHETIC_SYMBOLS["Volatility 25"]).toBe("R_25");
    expect(DERIV_SYNTHETIC_SYMBOLS["Volatility 50"]).toBe("R_50");
    expect(DERIV_SYNTHETIC_SYMBOLS["Volatility 75"]).toBe("R_75");
    expect(DERIV_SYNTHETIC_SYMBOLS["Volatility 100"]).toBe("R_100");
  });

  it("marks fresh complete demo data as healthy and allows analysis", () => {
    const updatedAt = new Date().toISOString();
    const health = buildMarketDataHealth({
      ticker: ticker(updatedAt),
      candles: candles(120, updatedAt),
      timeframe: "5m",
      latencyMs: 42,
      tickRate: 1,
    });
    const guard = applyKalosDataGuard(health);

    expect(health.dataQuality).toBe("HEALTHY");
    expect(health.sourceStatus).toBe("CONNECTED");
    expect(guard.action).toBe("ALLOW_ANALYSIS");
  });

  it("forces NO_TRADE when data is stale", () => {
    const updatedAt = new Date(Date.now() - 3600_000).toISOString();
    const health = buildMarketDataHealth({
      ticker: ticker(updatedAt),
      candles: candles(120, updatedAt),
      timeframe: "5m",
      latencyMs: 20,
      tickRate: 1,
    });
    const guard = applyKalosDataGuard(health);

    expect(health.dataQuality).toBe("STALE");
    expect(guard.action).toBe("NO_TRADE");
    expect(guard.decisionOverride).toBe("NO_TRADE");
  });

  it("marks missing candles as DATA_LOW", () => {
    const updatedAt = new Date().toISOString();
    const health = buildMarketDataHealth({
      ticker: ticker(updatedAt),
      candles: candles(80, updatedAt),
      timeframe: "5m",
      latencyMs: 18,
      tickRate: 1,
    });
    const guard = applyKalosDataGuard(health);

    expect(health.dataQuality).toBe("DEGRADED");
    expect(health.missingCandles).toBe(40);
    expect(guard.action).toBe("DATA_LOW");
  });

  it("forces WAIT when spread is abnormal", () => {
    const updatedAt = new Date().toISOString();
    const health = buildMarketDataHealth({
      ticker: ticker(updatedAt),
      candles: candles(120, updatedAt),
      timeframe: "5m",
      latencyMs: 18,
      spread: -1,
      tickRate: 1,
    });
    const guard = applyKalosDataGuard(health);

    expect(health.spreadQuality).toBe("ABNORMAL");
    expect(guard.action).toBe("WAIT");
    expect(guard.decisionOverride).toBe("WAIT");
  });

  it("keeps a connected Deriv DEMO snapshot out of MOCK_DATA", async () => {
    const config: DerivClientConfig = {
      enabled: true,
      wsAppId: "1089",
      wsAppIdPresent: true,
      appId: '"1089"',
      apiTokenConfigured: true,
      endpoint: "wss://ws.derivws.com/websockets/v3",
      accountType: "demo",
      allowOrderPlacement: false,
    };
    const baseEpoch = Math.floor(Date.now() / 1000);
    const transport: DerivRequestTransport = async (_endpoint, payload) => {
      if ("active_symbols" in payload) {
        return { active_symbols: [{ display_name: "Boom 500 Index", symbol: "BOOM500" }] };
      }

      if ("ticks" in payload) {
        return { tick: { quote: 5123.45, epoch: baseEpoch, symbol: "BOOM500" } };
      }

      if ("ticks_history" in payload) {
        return {
          candles: Array.from({ length: 120 }, (_, index) => ({
            epoch: baseEpoch - (119 - index) * 300,
            open: 5000 + index,
            high: 5003 + index,
            low: 4997 + index,
            close: 5001 + index,
          })),
        };
      }

      return {};
    };
    const client = new DerivDemoReadOnlyClient(config, transport);

    const health = await client.connect();
    const snapshot = await client.getSnapshot("BOOM500", "5m");

    expect(health.runtimeMode).toBe("DEMO");
    expect(health.sourceStatus).toBe("CONNECTED");
    expect(health.orderPlacementAllowed).toBe(false);
    expect(health.tokenVisible).toBe(false);
    expect(snapshot.ticker.source).toBe("Deriv DEMO Read-Only");
    expect(snapshot.ticker.source).not.toBe("MOCK_DATA");
    expect(snapshot.observability.source).toBe("DEMO");
    expect(snapshot.observability.sourceStatus).toBe("CONNECTED");
  });

  it("authorizes only personal Deriv DEMO tokens and refuses real tokens", async () => {
    const config: DerivClientConfig = {
      enabled: true,
      wsAppId: "1089",
      wsAppIdPresent: true,
      appId: "1089",
      apiTokenConfigured: false,
      endpoint: "wss://ws.derivws.com/websockets/v3",
      accountType: "demo",
      allowOrderPlacement: false,
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const auth = init?.headers instanceof Headers
        ? init.headers.get("Authorization")
        : (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (auth === "Bearer demo-token" && url.endsWith("/trading/v1/options/accounts")) {
        return new Response(JSON.stringify({ data: { accounts: [{ accountId: "VRTC123456", loginid: "VRTC123456", account_type: "demo" }] } }), { status: 200 });
      }
      if (auth === "Bearer real-token" && url.endsWith("/trading/v1/options/accounts")) {
        return new Response(JSON.stringify({ data: { accounts: [{ accountId: "CR123456", loginid: "CR123456", account_type: "real" }] } }), { status: 200 });
      }
      if (auth === "Bearer demo-token" && url.endsWith("/trading/v1/options/accounts/VRTC123456/otp")) {
        return new Response(JSON.stringify({ data: { url: "wss://api.derivws.com/trading/v1/options/ws/demo?otp=test-otp" } }), { status: 200 });
      }
      return new Response(JSON.stringify({ errors: [{ message: "Invalid token." }] }), { status: 401 });
    }));
    const transport: DerivRequestTransport = async (_endpoint, payload) => {
      if (payload.balance === 1 && payload.subscribe === 1) {
        return { balance: { balance: 10000, currency: "USD", loginid: "VRTC123456" } };
      }

      if (payload.ticks === "BOOM500" && payload.subscribe === 1) {
        return { tick: { quote: 5248.129, epoch: 1781600000, symbol: "BOOM500" } };
      }

      if (payload.ticks_history === "BOOM500" && payload.style === "candles") {
        return {
          candles: [
            { epoch: 1781599940, open: 5248, high: 5249, low: 5247, close: 5248.5 },
            { epoch: 1781600000, open: 5248.5, high: 5249.2, low: 5248.1, close: 5248.9 },
          ],
        };
      }

      return { error: { code: "InvalidToken", message: "Invalid token." } };
    };
    const client = new DerivDemoReadOnlyClient(config, transport);

    const demo = await client.testPersonalToken("demo-token");
    const real = await client.testPersonalToken("real-token");
    const invalid = await client.testPersonalToken("bad-token");

    expect(demo.ok).toBe(true);
    expect(demo.accountType).toBe("DEMO");
    expect(demo.source).toBe("PERSONAL_DERIV_DEMO_OAUTH");
    expect(demo.balanceAvailable).toBe(true);
    expect(demo.tickReceived).toBe(true);
    expect(demo.candleReceived).toBe(true);
    expect(real.ok).toBe(false);
    expect(real.accountType).toBe("REAL");
    expect(real.message).toContain("Only Deriv DEMO accounts are allowed");
    expect(invalid.status).toBe("INVALID");
    expect(JSON.stringify({ demo, real, invalid })).not.toContain("demo-token");
  });

  it("normalizes Deriv WebSocket endpoint and injects the configured app id", async () => {
    const config: DerivClientConfig = {
      enabled: true,
      wsAppId: "1089",
      wsAppIdPresent: true,
      appId: "1089",
      apiTokenConfigured: false,
      endpoint: "https://ws.derivws.com",
      accountType: "demo",
      allowOrderPlacement: false,
    };
    let capturedEndpoint = "";
    const transport: DerivRequestTransport = async (endpoint, payload) => {
      capturedEndpoint = endpoint;

      if (payload.ticks === "R_75") {
        return { tick: { quote: 39400.25, epoch: 1781600000, symbol: "R_75" } };
      }

      return {};
    };
    const client = new DerivDemoReadOnlyClient(config, transport);
    const tickerResult = await client.getTicker("R_75");
    const endpointUrl = new URL(capturedEndpoint);

    expect(tickerResult.price).toBe(39400.25);
    expect(endpointUrl.protocol).toBe("wss:");
    expect(endpointUrl.hostname).toBe("ws.derivws.com");
    expect(endpointUrl.pathname).toBe("/websockets/v3");
    expect(endpointUrl.searchParams.get("app_id")).toBe("1089");
  });

  it("uses numeric WebSocket app ids while keeping PAT app ids as metadata only", async () => {
    const config: DerivClientConfig = {
      enabled: true,
      wsAppId: "1089",
      wsAppIdPresent: true,
      appId: "33zqe4Br9GlyBlnkDwxbC",
      apiTokenConfigured: false,
      endpoint: "wss://ws.derivws.com/websockets/v3?app_id=old",
      accountType: "demo",
      allowOrderPlacement: false,
    };
    let capturedEndpoint = "";
    const transport: DerivRequestTransport = async (endpoint, payload) => {
      capturedEndpoint = endpoint;

      if (payload.ticks === "R_75") {
        return { tick: { quote: 39400.25, epoch: 1781600000, symbol: "R_75" } };
      }

      return {};
    };
    const client = new DerivDemoReadOnlyClient(config, transport);
    const tickerResult = await client.getTicker("R_75");
    const endpointUrl = new URL(capturedEndpoint);
    const diagnostics = client.getDiagnostics();

    expect(tickerResult.price).toBe(39400.25);
    expect(endpointUrl.toString()).toBe("wss://ws.derivws.com/websockets/v3?app_id=1089");
    expect(endpointUrl.searchParams.getAll("app_id")).toHaveLength(1);
    expect(diagnostics.wsAppIdPresent).toBe(true);
    expect(diagnostics.wsAppIdFormat).toBe("NUMERIC");
    expect(diagnostics.patAppIdPresent).toBe(true);
    expect(diagnostics.patAppIdFormat).toBe("PAT");
    expect(diagnostics.endpointValid).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toContain("33zqe4Br9GlyBlnkDwxbC");
  });

  it("falls back to public numeric app id 1089 when DERIV_WS_APP_ID is missing", async () => {
    const config: DerivClientConfig = {
      enabled: true,
      wsAppId: "1089",
      wsAppIdPresent: false,
      appId: "33zqe4Br9GlyBlnkDwxbC",
      apiTokenConfigured: false,
      endpoint: "wss://ws.derivws.com/websockets/v3",
      accountType: "demo",
      allowOrderPlacement: false,
    };
    let capturedEndpoint = "";
    const client = new DerivDemoReadOnlyClient(config, async (endpoint, payload) => {
      capturedEndpoint = endpoint;
      if (payload.ticks === "R_75") return { tick: { quote: 12, epoch: 1781600000, symbol: "R_75" } };
      return {};
    });

    await client.getTicker("R_75");
    const diagnostics = client.getDiagnostics();

    expect(new URL(capturedEndpoint).searchParams.get("app_id")).toBe("1089");
    expect(diagnostics.wsAppIdPresent).toBe(false);
    expect(diagnostics.wsAppIdFormat).toBe("MISSING");
    expect(diagnostics.endpointValid).toBe(true);
  });

  it("uses MOCK_DATA fallback only when DATA_MODE=DEMO_DATA and Deriv is disabled", async () => {
    process.env.DERIV_ENABLED = "false";
    process.env.DERIV_WS_APP_ID = "not-numeric";
    process.env.DERIV_APP_ID = "";
    process.env.DATA_MODE = "DEMO_DATA";
    vi.resetModules();

    const demoModule = await import("../../server/services/market/marketAggregator");
    const demoSnapshot = await demoModule.marketAggregator.getSnapshot("BOOM500", "5m");

    expect(demoSnapshot.fallback).toBe("MOCK_DATA");
    expect(demoSnapshot.ticker.source).toBe("MOCK_DATA");
    expect(demoSnapshot.observability.source).toBe("MOCK");

    process.env.DATA_MODE = "REAL_DATA";
    process.env.DERIV_ENABLED = "false";
    process.env.DERIV_WS_APP_ID = "not-numeric";
    vi.resetModules();

    const realModule = await import("../../server/services/market/marketAggregator");
    const realSnapshot = await realModule.marketAggregator.getSnapshot("BOOM1000", "5m");

    expect(realSnapshot.fallback).toBe("NONE");
    expect(realSnapshot.ticker.source).not.toBe("MOCK_DATA");
    expect(realSnapshot.observability.sourceStatus).toBe("DISCONNECTED");
  }, 15000);
});
