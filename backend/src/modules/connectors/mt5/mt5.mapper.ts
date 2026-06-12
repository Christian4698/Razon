import type { Timeframe } from "../../../core/types/timeframe.types";
import type { ConnectorAccountInfo, ConnectorCandle, MarketConnectorMode, MarketConnectorOptions, SecretRef } from "../connectors.types";
import { maskSecret } from "../connectors.types";
import type { Mt5ConnectorConfig, Mt5RawAccountInfo, Mt5RawCandle } from "./mt5.types";

function env(key: string) {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env?.[key];
}

function boolEnv(key: string) {
  return env(key) === "true";
}

function secretRef(key: string): SecretRef {
  const value = env(key);
  return {
    key,
    configured: Boolean(value),
    maskedValue: maskSecret(value),
  };
}

export function getMt5Config(): Mt5ConnectorConfig {
  const bridgePort = Number(env("MT5_BRIDGE_PORT") ?? env("MT5_PORT") ?? 0);

  return {
    enabled: boolEnv("MT5_ENABLED"),
    login: env("MT5_LOGIN") ?? env("MT5_ACCOUNT_ID") ?? null,
    passwordConfigured: Boolean(env("MT5_PASSWORD")),
    server: env("MT5_SERVER") ?? null,
    accountType: env("MT5_ACCOUNT_TYPE") === "live" || env("MT5_MODE") === "live" ? "live" : "demo",
    bridgeHost: env("MT5_BRIDGE_HOST") ?? env("MT5_HOST") ?? "127.0.0.1",
    bridgePort: Number.isFinite(bridgePort) && bridgePort > 0 ? bridgePort : 8788,
    terminalPath: env("MT5_PATH") ?? null,
    allowOrderPlacement: boolEnv("MT5_ALLOW_ORDER_PLACEMENT"),
  };
}

export function mapMt5Options(mode: MarketConnectorMode): MarketConnectorOptions {
  const config = getMt5Config();
  const ready = config.enabled && Boolean(config.login) && config.passwordConfigured && Boolean(config.server);
  const realReadOnly = ready && mode === "live" && config.accountType === "live";

  return {
    id: "mt5",
    name: realReadOnly ? "MT5 Real Bridge" : "MT5 Demo Bridge",
    mode,
    runtimeMode: !ready ? "MOCK" : realReadOnly ? "LIVE" : "DEMO",
    accessMode: realReadOnly ? "REAL" : "DEMO",
    simulatedLatencyMs: mode === "live" ? 45 : 18,
    delayedData: false,
    secrets: {
      refs: [
        secretRef("MT5_LOGIN"),
        secretRef("MT5_PASSWORD"),
        secretRef("MT5_SERVER"),
        secretRef("MT5_BRIDGE_HOST"),
        secretRef("MT5_BRIDGE_PORT"),
        secretRef("MT5_PATH"),
      ],
    },
  };
}

export function mapMt5AccountInfo(raw: Mt5RawAccountInfo | null): ConnectorAccountInfo {
  return {
    connectorId: "mt5",
    runtimeMode: raw ? "DEMO" : "MOCK",
    accountId: raw?.login ?? null,
    currency: raw?.currency ?? "USD",
    balance: raw?.balance ?? 10000,
    equity: raw?.equity ?? raw?.balance ?? 10000,
    margin: raw?.margin ?? 0,
    freeMargin: raw?.freeMargin ?? raw?.equity ?? raw?.balance ?? 10000,
    isSimulated: !raw,
    updatedAt: new Date().toISOString(),
  };
}

export function mapMt5Candle(symbol: string, timeframe: Timeframe, candle: Mt5RawCandle): ConnectorCandle {
  return {
    symbol,
    timeframe,
    timestamp: typeof candle.time === "number" ? new Date(candle.time * 1000).toISOString() : candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.tick_volume,
    spread: candle.spread,
  };
}
