import type { Timeframe } from "../../../core/types/timeframe.types";
import type { ConnectorCandle, ConnectorTick, MarketConnectorMode, MarketConnectorOptions, SecretRef } from "../connectors.types";
import { maskSecret, modeToRuntimeMode } from "../connectors.types";
import type { ForexConnectorConfig, ForexRawCandle, ForexRawQuote } from "./forex.types";

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

export function getForexConfig(): ForexConnectorConfig {
  return {
    enabled: boolEnv("FOREX_API_ENABLED"),
    provider: env("FOREX_API_PROVIDER") ?? null,
    baseUrl: env("FOREX_API_BASE_URL") ?? null,
    apiKeyConfigured: Boolean(env("FOREX_API_KEY")),
    apiSecretConfigured: Boolean(env("FOREX_API_SECRET")),
  };
}

export function mapForexOptions(mode: MarketConnectorMode): MarketConnectorOptions {
  const config = getForexConfig();
  const ready = config.enabled && Boolean(config.baseUrl) && config.apiKeyConfigured;

  return {
    id: "forex",
    name: "Forex API",
    mode,
    runtimeMode: ready ? modeToRuntimeMode(mode) : "MOCK",
    simulatedLatencyMs: mode === "live" ? 55 : 24,
    delayedData: !ready,
    secrets: {
      refs: [secretRef("FOREX_API_KEY"), secretRef("FOREX_API_SECRET")],
    },
  };
}

export function mapForexQuote(raw: ForexRawQuote): ConnectorTick {
  return {
    symbol: raw.symbol,
    timestamp: raw.timestamp,
    bid: raw.bid,
    ask: raw.ask,
    last: (raw.bid + raw.ask) / 2,
    spread: raw.ask - raw.bid,
  };
}

export function mapForexCandle(symbol: string, timeframe: Timeframe, candle: ForexRawCandle): ConnectorCandle {
  return {
    symbol,
    timeframe,
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}
