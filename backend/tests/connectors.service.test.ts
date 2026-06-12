import { describe, expect, it } from "vitest";
import { createConnectorsService } from "../src/modules/connectors/connectors.service";

describe("ConnectorsService", () => {
  function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  }

  function restoreEnvSet(snapshot: Readonly<Record<string, string | undefined>>) {
    Object.entries(snapshot).forEach(([key, value]) => restoreEnv(key, value));
  }

  it("connects and disconnects a connector with display labels", async () => {
    const service = createConnectorsService({ mode: "simulation" });

    const connected = await service.connect("mock");
    expect(connected.state).toBe("connected");
    expect(connected.displayStatus).toBe("Connecté");
    expect(connected.latencyMs).toBeGreaterThanOrEqual(0);

    const disconnected = await service.disconnect("mock");
    expect(disconnected.state).toBe("disconnected");
    expect(disconnected.displayStatus).toBe("Déconnecté");
  });

  it("reads candles, tick, order book, spread, and open positions without trading", async () => {
    const service = createConnectorsService({ mode: "paper" });
    await service.connect("mock");

    const candles = await service.getCandles({
      connectorId: "mock",
      symbol: "EURUSD",
      timeframe: "M5",
      limit: 12,
    });
    const tick = await service.getTick({ connectorId: "mock", symbol: "EURUSD" });
    const orderBook = await service.getOrderBook({ connectorId: "mock", symbol: "EURUSD" });
    const spread = await service.getSpread({ connectorId: "mock", symbol: "EURUSD" });
    const openPositions = await service.getOpenPositions("mock");

    expect(candles).toHaveLength(12);
    expect(tick.ask).toBeGreaterThan(tick.bid);
    expect(orderBook.bids).toHaveLength(5);
    expect(orderBook.asks).toHaveLength(5);
    expect(spread.spread).toBeGreaterThan(0);
    expect(openPositions).toEqual([]);

    const orderResult = await service.placeOrder("mock", {
      symbol: "EURUSD",
      side: "BUY",
      volume: 0.1,
      stop_loss: 1.07,
      take_profit: 1.09,
      clientRequestId: "test-order-1",
    });

    expect(orderResult.status).toBe("BLOCKED");
    expect(orderResult.clientRequestId).toBe("test-order-1");
  });

  it("marks TradingView data as delayed", async () => {
    const service = createConnectorsService({ mode: "simulation" });

    const health = await service.connect("tradingview");
    expect(health.state).toBe("delayed");
    expect(health.displayStatus).toBe("Données retardées");
  });

  it("supports reconnection and increments reconnect attempts", async () => {
    const service = createConnectorsService({ mode: "live" });

    await service.connect("deriv");
    const health = await service.reconnect("deriv");

    expect(health.state).toBe("connected");
    expect(health.displayStatus).toBe("Connecté");
    expect(health.reconnectAttempts).toBe(1);
  });

  it("reports health for all registered connectors", async () => {
    const service = createConnectorsService();

    const health = await service.health();

    expect(Array.isArray(health)).toBe(true);
    expect(health).toHaveLength(5);
  });

  it("registers MT5, Deriv, Forex, TradingView, and Mock connectors", () => {
    const service = createConnectorsService({ mode: "simulation" });

    expect(service.listConnectors().map(connector => connector.id)).toEqual([
      "mt5",
      "deriv",
      "forex",
      "tradingview",
      "mock",
    ]);
  });

  it("returns account info and a health summary without requiring broker credentials", async () => {
    const service = createConnectorsService({ mode: "simulation" });

    await service.connect("forex");

    const account = await service.getAccountInfo("forex");
    const summary = await service.healthSummary();

    expect(account.connectorId).toBe("forex");
    expect(account.isSimulated).toBe(true);
    expect(account.runtimeMode).toBe("MOCK");
    expect(summary.total).toBe(5);
    expect(summary.runtimeModes.MOCK).toBe(5);
    expect(summary.delayed).toBeGreaterThanOrEqual(1);
  });

  it("masks connector secrets and does not expose raw tokens in health", async () => {
    const previousToken = process.env.DERIV_API_TOKEN;
    const previousAppId = process.env.DERIV_APP_ID;
    const previousEnabled = process.env.DERIV_ENABLED;

    process.env.DERIV_ENABLED = "true";
    process.env.DERIV_APP_ID = "123456";
    process.env.DERIV_API_TOKEN = "super-secret-token";

    try {
      const service = createConnectorsService({ mode: "paper" });
      const health = await service.testConnection("deriv");

      const serializedHealth = JSON.stringify(health);

      expect(health.runtimeMode).toBe("DEMO");
      expect(serializedHealth).not.toContain("super-secret-token");
      expect(serializedHealth).toContain("su****en");
    } finally {
      restoreEnv("DERIV_API_TOKEN", previousToken);
      restoreEnv("DERIV_APP_ID", previousAppId);
      restoreEnv("DERIV_ENABLED", previousEnabled);
    }
  });

  it("supports Deriv Demo as read-only WebSocket market data with backend-only token", async () => {
    const snapshot = {
      DERIV_ENABLED: process.env.DERIV_ENABLED,
      DERIV_APP_ID: process.env.DERIV_APP_ID,
      DERIV_API_TOKEN: process.env.DERIV_API_TOKEN,
      DERIV_ACCOUNT_TYPE: process.env.DERIV_ACCOUNT_TYPE,
      DERIV_ALLOW_ORDER_PLACEMENT: process.env.DERIV_ALLOW_ORDER_PLACEMENT,
    };

    process.env.DERIV_ENABLED = "true";
    process.env.DERIV_APP_ID = "123456";
    process.env.DERIV_API_TOKEN = "demo-token-secret";
    process.env.DERIV_ACCOUNT_TYPE = "demo";
    process.env.DERIV_ALLOW_ORDER_PLACEMENT = "false";

    try {
      const service = createConnectorsService({ mode: "paper" });
      const health = await service.connect("deriv");
      const tick = await service.getTick({ connectorId: "deriv", symbol: "R_75" });
      const order = await service.placeOrder("deriv", {
        symbol: "R_75",
        side: "BUY",
        volume: 0.1,
        clientRequestId: "deriv-demo-order",
      });
      const serializedHealth = JSON.stringify(health);

      expect(health.name).toBe("Deriv Demo");
      expect(health.runtimeMode).toBe("DEMO");
      expect(health.accessMode).toBe("DEMO");
      expect(health.safetyStatus).toBe("CONNECTED_DEMO");
      expect(health.readonlyByDefault).toBe(true);
      expect(health.liveTradingAllowed).toBe(false);
      expect(tick.symbol).toBe("R_75");
      expect(order.status).toBe("BLOCKED");
      expect(order.safetyStatus).toBe("LIVE_BLOCKED");
      expect(serializedHealth).not.toContain("demo-token-secret");
      expect(serializedHealth).toContain("de****et");
    } finally {
      restoreEnvSet(snapshot);
    }
  });

  it("supports Deriv Real as REAL_DATA read-only while keeping LIVE trading blocked", async () => {
    const snapshot = {
      DERIV_ENABLED: process.env.DERIV_ENABLED,
      DERIV_APP_ID: process.env.DERIV_APP_ID,
      DERIV_API_TOKEN: process.env.DERIV_API_TOKEN,
      DERIV_ACCOUNT_TYPE: process.env.DERIV_ACCOUNT_TYPE,
      DERIV_ALLOW_ORDER_PLACEMENT: process.env.DERIV_ALLOW_ORDER_PLACEMENT,
    };

    process.env.DERIV_ENABLED = "true";
    process.env.DERIV_APP_ID = "789012";
    process.env.DERIV_API_TOKEN = "real-deriv-token";
    process.env.DERIV_ACCOUNT_TYPE = "live";
    process.env.DERIV_ALLOW_ORDER_PLACEMENT = "false";

    try {
      const service = createConnectorsService({ mode: "live" });
      const health = await service.connect("deriv");
      const candles = await service.getCandles({
        connectorId: "deriv",
        symbol: "R_100",
        timeframe: "M1",
        limit: 5,
      });
      const order = await service.placeOrder("deriv", {
        symbol: "R_100",
        side: "SELL",
        volume: 0.1,
      });

      expect(health.name).toBe("Deriv Real");
      expect(health.runtimeMode).toBe("LIVE");
      expect(health.accessMode).toBe("REAL");
      expect(health.safetyStatus).toBe("CONNECTED_REAL_READONLY");
      expect(health.liveTradingAllowed).toBe(false);
      expect(candles).toHaveLength(5);
      expect(order.status).toBe("BLOCKED");
      expect(order.safetyStatus).toBe("LIVE_BLOCKED");
    } finally {
      restoreEnvSet(snapshot);
    }
  });

  it("supports MT5 Real Bridge as local EA read-only architecture with backend-only secrets", async () => {
    const snapshot = {
      MT5_ENABLED: process.env.MT5_ENABLED,
      MT5_LOGIN: process.env.MT5_LOGIN,
      MT5_PASSWORD: process.env.MT5_PASSWORD,
      MT5_SERVER: process.env.MT5_SERVER,
      MT5_MODE: process.env.MT5_MODE,
      MT5_BRIDGE_HOST: process.env.MT5_BRIDGE_HOST,
      MT5_BRIDGE_PORT: process.env.MT5_BRIDGE_PORT,
      MT5_ALLOW_ORDER_PLACEMENT: process.env.MT5_ALLOW_ORDER_PLACEMENT,
    };

    process.env.MT5_ENABLED = "true";
    process.env.MT5_LOGIN = "12345678";
    process.env.MT5_PASSWORD = "mt5-password-secret";
    process.env.MT5_SERVER = "Broker-Real";
    process.env.MT5_MODE = "live";
    process.env.MT5_BRIDGE_HOST = "127.0.0.1";
    process.env.MT5_BRIDGE_PORT = "8788";
    process.env.MT5_ALLOW_ORDER_PLACEMENT = "false";

    try {
      const service = createConnectorsService({ mode: "live" });
      const health = await service.connect("mt5");
      const account = await service.getAccountInfo("mt5");
      const order = await service.placeOrder("mt5", {
        symbol: "XAUUSD",
        side: "BUY",
        volume: 0.1,
      });
      const serializedHealth = JSON.stringify(health);

      expect(health.name).toBe("MT5 Real Bridge");
      expect(health.runtimeMode).toBe("LIVE");
      expect(health.accessMode).toBe("REAL");
      expect(health.safetyStatus).toBe("CONNECTED_REAL_READONLY");
      expect(health.liveTradingAllowed).toBe(false);
      expect(account.runtimeMode).toBe("LIVE");
      expect(order.status).toBe("BLOCKED");
      expect(order.safetyStatus).toBe("LIVE_BLOCKED");
      expect(serializedHealth).not.toContain("mt5-password-secret");
      expect(serializedHealth).toContain("mt****et");
    } finally {
      restoreEnvSet(snapshot);
    }
  });

  it("prepares close and modify order functions but keeps execution blocked", async () => {
    const service = createConnectorsService({ mode: "simulation" });

    const closeResult = await service.closeOrder("mt5", {
      orderId: "order-1",
      reason: "test only",
    });
    const modifyResult = await service.modifyOrder("mt5", {
      orderId: "order-1",
      stop_loss: 1.07,
      take_profit: 1.09,
    });

    expect(closeResult.status).toBe("BLOCKED");
    expect(modifyResult.status).toBe("BLOCKED");
  });
});
