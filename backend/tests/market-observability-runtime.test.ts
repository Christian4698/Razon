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
      appId: "1089",
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
      appId: "1089",
      apiTokenConfigured: false,
      endpoint: "wss://ws.derivws.com/websockets/v3",
      accountType: "demo",
      allowOrderPlacement: false,
    };
    const transport: DerivRequestTransport = async (_endpoint, payload) => {
      if (payload.authorize === "demo-token") {
        return { authorize: { loginid: "VRTC123456", is_virtual: 1 } };
      }

      if (payload.authorize === "real-token") {
        return { authorize: { loginid: "CR123456", is_virtual: 0 } };
      }

      if (payload.balance === 1 && payload.subscribe === 1) {
        return { balance: { balance: 10000, currency: "USD", loginid: "VRTC123456" } };
      }

      return { error: { code: "InvalidToken", message: "Invalid token." } };
    };
    const client = new DerivDemoReadOnlyClient(config, transport);

    const demo = await client.testPersonalToken("demo-token");
    const real = await client.testPersonalToken("real-token");
    const invalid = await client.testPersonalToken("bad-token");

    expect(demo.ok).toBe(true);
    expect(demo.accountType).toBe("DEMO");
    expect(demo.source).toBe("PERSONAL_DERIV_DEMO");
    expect(real.ok).toBe(false);
    expect(real.accountType).toBe("REAL");
    expect(real.message).toContain("Only Deriv DEMO tokens are allowed");
    expect(invalid.status).toBe("INVALID");
    expect(JSON.stringify({ demo, real, invalid })).not.toContain("demo-token");
  });

  it("uses MOCK_DATA fallback only when DATA_MODE=DEMO_DATA and Deriv is disabled", async () => {
    process.env.DERIV_ENABLED = "false";
    process.env.DERIV_APP_ID = "";
    process.env.DATA_MODE = "DEMO_DATA";
    vi.resetModules();

    const demoModule = await import("../../server/services/market/marketAggregator");
    const demoSnapshot = await demoModule.marketAggregator.getSnapshot("BOOM500", "5m");

    expect(demoSnapshot.fallback).toBe("MOCK_DATA");
    expect(demoSnapshot.ticker.source).toBe("MOCK_DATA");
    expect(demoSnapshot.observability.source).toBe("MOCK");

    process.env.DATA_MODE = "REAL_DATA";
    vi.resetModules();

    const realModule = await import("../../server/services/market/marketAggregator");
    const realSnapshot = await realModule.marketAggregator.getSnapshot("BOOM1000", "5m");

    expect(realSnapshot.fallback).toBe("NONE");
    expect(realSnapshot.ticker.source).not.toBe("MOCK_DATA");
    expect(realSnapshot.observability.sourceStatus).toBe("DISCONNECTED");
  });
});
