export type RazonMode = "demo" | "backtest" | "live";
export type RazonSignalDecision = "BUY" | "SELL" | "WAIT" | "NO_TRADE" | "DATA_LOW" | "INVALID";
export type MarketCategory =
  | "forex"
  | "metals"
  | "indices"
  | "crypto"
  | "derivSynthetic"
  | "stocks";
export type MarketTrend = "bullish" | "bearish" | "sideways" | "unavailable";
export type MarketDataStatus = "live" | "delayed" | "unavailable" | "not_configured";
export type MarketTimeframe = "1m" | "5m" | "15m" | "1h" | "1d";
export type MarketScannerState = "HOT" | "NORMAL" | "AVOID";
export type KalosRisk = "low" | "medium" | "high";

export interface NormalizedSymbol {
  symbol: string;
  displayName: string;
  category: MarketCategory;
  provider: string;
  providerSymbol: string;
  quoteAsset?: string;
}

export interface NormalizedTicker {
  symbol: string;
  category: MarketCategory;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  trend: MarketTrend;
  status: MarketDataStatus;
  source: string;
  updatedAt: string;
  providerMessage?: string;
}

export interface NormalizedCandle {
  symbol: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  source: string;
}

export interface NormalizedOrderBookLevel {
  price: number;
  size: number;
}

export interface NormalizedOrderBook {
  symbol: string;
  bids: NormalizedOrderBookLevel[];
  asks: NormalizedOrderBookLevel[];
  status: MarketDataStatus;
  source: string;
  updatedAt: string;
  providerMessage?: string;
}

export interface NormalizedVolume {
  symbol: string;
  volume: number | null;
  status: MarketDataStatus;
  source: string;
  updatedAt: string;
  providerMessage?: string;
}

export interface IndicatorSeriesPoint {
  timestamp: string;
  value: number | null;
}

export interface IndicatorSnapshot {
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  macd: {
    value: number | null;
    signal: number | null;
    histogram: number | null;
  };
  atr: number | null;
  volume: {
    current: number | null;
    average: number | null;
    relative: number | null;
  };
  bollingerBands: {
    upper: number | null;
    middle: number | null;
    lower: number | null;
  };
  fibonacci: Array<{ label: string; value: number }>;
  supportResistance: {
    support: number | null;
    resistance: number | null;
  };
  bos: "bullish" | "bearish" | "none";
  choch: "bullish" | "bearish" | "none";
  supplyDemand: {
    supply: [number, number] | null;
    demand: [number, number] | null;
  };
  liquidityZones: Array<{ side: "buy-side" | "sell-side"; level: number }>;
  candlestickPatterns: string[];
  momentum: number | null;
  trend: MarketTrend;
  marketStrength: number;
  volatility: "low" | "normal" | "high" | "unavailable";
}

export interface IndicatorSeries {
  ema20: IndicatorSeriesPoint[];
  ema50: IndicatorSeriesPoint[];
  ema200: IndicatorSeriesPoint[];
}

export interface MarketSnapshot {
  symbol: string;
  timeframe: MarketTimeframe;
  ticker: NormalizedTicker;
  candles: NormalizedCandle[];
  indicators: IndicatorSnapshot;
  indicatorSeries: IndicatorSeries;
  orderBook: NormalizedOrderBook;
  volume: NormalizedVolume;
  observability: {
    source: "MOCK" | "DEMO" | "REAL_DATA";
    sourceLabel: string;
    sourceStatus: "CONNECTED" | "DELAYED" | "MOCK" | "DISCONNECTED" | "UNKNOWN";
    latencyMs: number | null;
    freshnessSeconds: number | null;
    missingCandles: number;
    spreadQuality: "NORMAL" | "WIDE" | "ABNORMAL" | "UNKNOWN";
    tickRate: number | null;
    syncStatus: "IN_SYNC" | "LAGGING" | "OUT_OF_SYNC" | "UNKNOWN";
    dataQuality: "HEALTHY" | "DEGRADED" | "STALE" | "INVALID" | "DISCONNECTED";
    qualityState: "HEALTHY" | "DEGRADED" | "STALE" | "INVALID" | "DISCONNECTED";
    lastTickAt: string | null;
    lastCandleAt: string | null;
    generatedAt: string;
    reasons: string[];
  };
  dataGuard: {
    action: "ALLOW_ANALYSIS" | "WAIT" | "NO_TRADE" | "DATA_LOW" | "INVALID";
    dataQuality: "HEALTHY" | "DEGRADED" | "STALE" | "INVALID" | "DISCONNECTED";
    decisionOverride: "WAIT" | "NO_TRADE" | "DATA_LOW" | "INVALID" | null;
    dashboardBadge: string;
    journalCode: string | null;
    reasons: string[];
    rejectedReasons: string[];
  };
  fallback: "NONE" | "MOCK_DATA";
  generatedAt: string;
}

export interface MarketHubCategory {
  id: MarketCategory;
  label: string;
  symbols: NormalizedSymbol[];
  tickers: NormalizedTicker[];
}

export interface MarketHubResponse {
  generatedAt: string;
  categories: MarketHubCategory[];
  symbols: NormalizedSymbol[];
  providers: Array<{ id: string; label: string }>;
  disclaimer: string;
}

export interface MarketScanResult {
  symbol: string;
  category: MarketCategory;
  state: MarketScannerState;
  heatScore: number;
  trend: MarketTrend;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  status: MarketDataStatus;
  source: string;
  updatedAt: string;
  reason: string;
}

export interface MarketScannerResponse {
  generatedAt: string;
  results: MarketScanResult[];
}

export interface MarketOpportunity {
  symbol: string;
  category: MarketCategory;
  score: number;
  confidence: number;
  probability: number;
  trend: MarketTrend;
  risk: KalosRisk;
  decision: RazonSignalDecision;
  price: number | null;
  status: MarketDataStatus;
  generatedAt: string;
}

export interface RazonMarketInput {
  symbol?: string;
  price: number | null;
  volume: number | null;
  rsi: number | null;
  ema: number | null;
  atr: number | null;
  momentum?: number | null;
  trend?: string;
  marketStrength?: number;
  volatility?: string;
}

export interface RazonMarketCandle {
  timestamp: string;
  price: number;
  volume: number;
}

export interface RazonStatus {
  app: "RAZON";
  tagline: "AI Trading Analysis Platform";
  state: "connected" | "disconnected";
  mode: RazonMode;
  api: "online";
  automaticTradingAllowed: false;
  mt5Connected: false;
  liveExecutionEnabled: false;
  verifiedPerformance: false;
  performanceMessage: "No verified performance yet";
  timestamp: string;
}

export interface RazonMarketSnapshot {
  mode: RazonMode;
  source: "simulated-v1" | "provider-backed";
  instrument: string;
  generatedAt: string;
  input: RazonMarketInput;
  candles: RazonMarketCandle[];
  snapshot: MarketSnapshot;
  verifiedPerformance: false;
  performanceMessage: "No verified performance yet";
}

export interface RazonSignalOutput {
  signal: RazonSignalDecision;
  decision: RazonSignalDecision;
  confidence: number;
  probability: number;
  risk: KalosRisk;
  entry: number | null;
  entryZone: [number, number] | null;
  sl: number | null;
  tp: number | null;
  invalidationLevel: number | null;
  reasons: string[];
  whyBuy: string[];
  whySell: string[];
  whyWait: string[];
}

export interface KalosOutput {
  symbol: string;
  decision: RazonSignalDecision;
  confidence: number;
  probability: number;
  risk: KalosRisk;
  explanation: string;
  whyBuy: string[];
  whySell: string[];
  whyWait: string[];
  entryZone: [number, number] | null;
  sl: number | null;
  tp: number | null;
  invalidationLevel: number | null;
  technicalReasons: string[];
  indicators: IndicatorSnapshot;
  indicatorSeries: IndicatorSeries;
  status: MarketDataStatus;
  disclaimer: string;
  generatedAt: string;
}

export interface RazonSignalsResponse {
  mode: RazonMode;
  source: "simulated-v1" | "provider-backed";
  input: RazonMarketInput;
  signal: RazonSignalOutput;
  topOpportunities: MarketOpportunity[];
  bestMarket: MarketOpportunity | null;
  journalEntryId: string;
  automaticTradingAllowed: false;
  mt5Connected: false;
  liveExecutionEnabled: false;
  disclaimer: string;
  generatedAt: string;
}

export interface RazonJournalEntry {
  id: string;
  timestamp: string;
  input: RazonMarketInput;
  decision: RazonSignalDecision;
  confidence: number;
  reasons: string[];
}

export interface RazonJournalDecisionSummary {
  title: "Why BUY" | "Why SELL" | "Why WAIT";
  decision: RazonSignalDecision;
  entries: RazonJournalEntry[];
}

export interface RazonJournalResponse {
  mode: RazonMode;
  entries: RazonJournalEntry[];
  decisionSummary: RazonJournalDecisionSummary[];
}

export interface RazonRiskState {
  mode: RazonMode;
  automaticTradingAllowed: false;
  mt5Connected: false;
  liveExecutionEnabled: false;
  positions: [];
  rules: Array<{
    id: string;
    label: string;
    status: "enforced" | "not_configured";
    description: string;
  }>;
  verifiedPerformance: false;
  performanceMessage: "No verified performance yet";
}

export interface RazonBacktestState {
  mode: "backtest";
  status: "ready_no_dataset";
  verifiedPerformance: false;
  performanceMessage: "No verified performance yet";
  results: null;
  message: string;
}

/**
 * API base URL for the RAZON backend.
 * - In production (Hostinger), VITE_API_BASE_URL = https://razon-api.onrender.com
 * - API_BASE_URL is kept as a deployment alias, but Vite exposes VITE_* to the client.
 * - In development, .env.local points to http://localhost:10000.
 *   Set VITE_API_BASE_URL=http://localhost:10000 in .env.local if needed.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  ((import.meta.env as ImportMetaEnv & { API_BASE_URL?: string }).API_BASE_URL as string | undefined) ||
  "";

export async function razonApi<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`RAZON API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}
