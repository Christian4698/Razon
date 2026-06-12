import type { Timeframe } from "../../../core/types/timeframe.types";
import type { ConnectorCandle, ConnectorTick, MarketConnectorMode, MarketConnectorOptions, SecretRef } from "../connectors.types";
import { maskSecret } from "../connectors.types";
import type { DerivConnectorConfig, DerivRawCandle, DerivRawTick } from "./deriv.types";

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

export function getDerivConfig(): DerivConnectorConfig {
  const accountType = env("DERIV_ACCOUNT_TYPE") === "live" ? "live" : "demo";

  return {
    enabled: boolEnv("DERIV_ENABLED"),
    appId: env("DERIV_APP_ID") ?? null,
    apiTokenConfigured: Boolean(env("DERIV_API_TOKEN")),
    endpoint: env("DERIV_ENDPOINT") ?? "wss://ws.derivws.com/websockets/v3",
    accountType,
    allowOrderPlacement: boolEnv("DERIV_ALLOW_ORDER_PLACEMENT"),
  };
}

export function mapDerivOptions(mode: MarketConnectorMode): MarketConnectorOptions {
  const config = getDerivConfig();
  const ready = config.enabled && Boolean(config.appId) && config.apiTokenConfigured;
  const realReadOnly = ready && mode === "live" && config.accountType === "live";

  return {
    id: "deriv",
    name: realReadOnly ? "Deriv Real" : "Deriv Demo",
    mode,
    runtimeMode: !ready ? "MOCK" : realReadOnly ? "LIVE" : "DEMO",
    accessMode: realReadOnly ? "REAL" : "DEMO",
    simulatedLatencyMs: mode === "live" ? 60 : 22,
    delayedData: false,
    secrets: {
      refs: [secretRef("DERIV_APP_ID"), secretRef("DERIV_API_TOKEN")],
    },
  };
}

export function mapDerivTick(raw: DerivRawTick): ConnectorTick {
  return {
    symbol: raw.symbol,
    timestamp: new Date(raw.epoch * 1000).toISOString(),
    bid: raw.quote,
    ask: raw.quote,
    last: raw.quote,
    spread: 0,
  };
}

export function mapDerivCandle(symbol: string, timeframe: Timeframe, candle: DerivRawCandle): ConnectorCandle {
  return {
    symbol,
    timeframe,
    timestamp: new Date(candle.epoch * 1000).toISOString(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}
