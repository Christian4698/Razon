import type {
  MarketDataStatus,
  MarketTimeframe,
  NormalizedCandle,
  NormalizedTicker,
} from "./marketProvider";

export type MarketDataSourceMode = "MOCK" | "DEMO" | "REAL_DATA";

export type MarketDataSourceStatus =
  | "CONNECTED"
  | "DELAYED"
  | "MOCK"
  | "DISCONNECTED"
  | "UNKNOWN";

export type MarketDataSyncStatus =
  | "IN_SYNC"
  | "LAGGING"
  | "OUT_OF_SYNC"
  | "UNKNOWN";

export type SpreadQuality = "NORMAL" | "WIDE" | "ABNORMAL" | "UNKNOWN";

export type MarketDataQualityState =
  | "HEALTHY"
  | "DEGRADED"
  | "STALE"
  | "INVALID"
  | "DISCONNECTED";

export type DataQualityRuleCode =
  | "SOURCE_DISCONNECTED"
  | "SOURCE_UNKNOWN"
  | "DATA_STALE"
  | "MISSING_CANDLES"
  | "SPREAD_WIDE"
  | "SPREAD_ABNORMAL"
  | "LOW_TICK_RATE"
  | "OUT_OF_SYNC"
  | "MALFORMED_DATA";

export type KalosDataGuardAction =
  | "ALLOW_ANALYSIS"
  | "WAIT"
  | "NO_TRADE"
  | "DATA_LOW"
  | "INVALID";

export interface DataQualityRuleResult {
  readonly code: DataQualityRuleCode;
  readonly state: MarketDataQualityState;
  readonly severity: "info" | "warning" | "critical";
  readonly explanation: string;
  readonly recommendedAction: string;
}

export interface MarketDataHealthModel {
  readonly symbol: string;
  readonly timeframe: string;
  readonly source: MarketDataSourceMode;
  readonly sourceLabel: string;
  readonly sourceStatus: MarketDataSourceStatus;
  readonly latencyMs: number | null;
  readonly freshnessSeconds: number | null;
  readonly missingCandles: number;
  readonly spreadQuality: SpreadQuality;
  readonly tickRate: number | null;
  readonly syncStatus: MarketDataSyncStatus;
  readonly dataQuality: MarketDataQualityState;
  readonly qualityState: MarketDataQualityState;
  readonly lastTickAt: string | null;
  readonly lastCandleAt: string | null;
  readonly generatedAt: string;
  readonly rules: readonly DataQualityRuleResult[];
  readonly reasons: readonly string[];
}

export interface KalosDataGuardOutput {
  readonly action: KalosDataGuardAction;
  readonly dataQuality: MarketDataQualityState;
  readonly decisionOverride: "WAIT" | "NO_TRADE" | "DATA_LOW" | "INVALID" | null;
  readonly dashboardBadge:
    | "DATA_OK"
    | "DATA_WARNING"
    | "DATA_LOW"
    | "DATA_STALE"
    | "DATA_INVALID"
    | "DATA_DISCONNECTED";
  readonly journalCode: DataQualityRuleCode | null;
  readonly reasons: readonly string[];
  readonly rejectedReasons: readonly string[];
}

const expectedCandles = 120;

const timeframeSeconds: Record<MarketTimeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "1d": 86400,
};

function nowIso() {
  return new Date().toISOString();
}

function secondsSince(timestamp: string | null, generatedAt = Date.now()) {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.round((generatedAt - parsed) / 1000));
}

export function marketStatusToSourceStatus(status: MarketDataStatus, source: string): MarketDataSourceStatus {
  if (source === "MOCK_DATA") return "MOCK";
  if (status === "live") return "CONNECTED";
  if (status === "delayed") return "DELAYED";
  if (status === "unavailable" || status === "not_configured") return "DISCONNECTED";
  return "UNKNOWN";
}

function sourceModeFromTicker(ticker: NormalizedTicker): MarketDataSourceMode {
  if (ticker.source === "MOCK_DATA") return "MOCK";
  if (ticker.source.toLowerCase().includes("deriv")) return "DEMO";
  return ticker.status === "live" ? "REAL_DATA" : "MOCK";
}

function spreadQuality(spread: number | null | undefined): SpreadQuality {
  if (spread === null || spread === undefined) return "UNKNOWN";
  if (!Number.isFinite(spread) || spread < 0) return "ABNORMAL";
  if (spread === 0) return "NORMAL";
  if (spread > 10) return "WIDE";
  return "NORMAL";
}

function syncStatus(lastTickAt: string | null, lastCandleAt: string | null, timeframe: MarketTimeframe): MarketDataSyncStatus {
  if (!lastTickAt || !lastCandleAt) return "UNKNOWN";
  const tick = Date.parse(lastTickAt);
  const candle = Date.parse(lastCandleAt);
  if (Number.isNaN(tick) || Number.isNaN(candle)) return "UNKNOWN";
  const differenceSeconds = Math.abs(tick - candle) / 1000;
  if (differenceSeconds <= timeframeSeconds[timeframe] * 2) return "IN_SYNC";
  if (differenceSeconds <= timeframeSeconds[timeframe] * 5) return "LAGGING";
  return "OUT_OF_SYNC";
}

function staleLimitSeconds(timeframe: MarketTimeframe) {
  return Math.max(timeframeSeconds[timeframe] * 3, 180);
}

function deriveRules(input: {
  readonly sourceStatus: MarketDataSourceStatus;
  readonly freshnessSeconds: number | null;
  readonly missingCandles: number;
  readonly spreadQuality: SpreadQuality;
  readonly syncStatus: MarketDataSyncStatus;
  readonly tickRate: number | null;
  readonly timeframe: MarketTimeframe;
  readonly hasValidPrice: boolean;
}): DataQualityRuleResult[] {
  const rules: DataQualityRuleResult[] = [];

  if (input.sourceStatus === "DISCONNECTED") {
    rules.push({
      code: "SOURCE_DISCONNECTED",
      state: "DISCONNECTED",
      severity: "critical",
      explanation: "Market source is disconnected or unavailable.",
      recommendedAction: "Keep analysis read-only and use MOCK fallback only in DEMO_DATA.",
    });
  }

  if (input.sourceStatus === "UNKNOWN") {
    rules.push({
      code: "SOURCE_UNKNOWN",
      state: "INVALID",
      severity: "critical",
      explanation: "Market source identity is unknown.",
      recommendedAction: "Reject provider-backed analysis until the source is identified.",
    });
  }

  if (!input.hasValidPrice) {
    rules.push({
      code: "MALFORMED_DATA",
      state: "INVALID",
      severity: "critical",
      explanation: "Ticker price is missing or malformed.",
      recommendedAction: "Reject directional analysis.",
    });
  }

  if (input.freshnessSeconds === null || input.freshnessSeconds > staleLimitSeconds(input.timeframe)) {
    rules.push({
      code: "DATA_STALE",
      state: "STALE",
      severity: "critical",
      explanation: "Latest tick or candle is older than the freshness policy.",
      recommendedAction: "Force NO_TRADE until fresh data arrives.",
    });
  }

  if (input.missingCandles > 0) {
    rules.push({
      code: "MISSING_CANDLES",
      state: input.missingCandles > expectedCandles / 2 ? "INVALID" : "DEGRADED",
      severity: input.missingCandles > expectedCandles / 2 ? "critical" : "warning",
      explanation: `${input.missingCandles} expected candles are missing.`,
      recommendedAction: "Display DATA_LOW and wait for complete history.",
    });
  }

  if (input.spreadQuality === "WIDE") {
    rules.push({
      code: "SPREAD_WIDE",
      state: "DEGRADED",
      severity: "warning",
      explanation: "Spread is wider than the safe analysis baseline.",
      recommendedAction: "Keep KALOS cautious and avoid executable interpretation.",
    });
  }

  if (input.spreadQuality === "ABNORMAL") {
    rules.push({
      code: "SPREAD_ABNORMAL",
      state: "INVALID",
      severity: "critical",
      explanation: "Spread is abnormal or mathematically invalid.",
      recommendedAction: "Force WAIT until spread returns to normal.",
    });
  }

  if (input.tickRate !== null && input.tickRate <= 0) {
    rules.push({
      code: "LOW_TICK_RATE",
      state: "DEGRADED",
      severity: "warning",
      explanation: "No tick activity was observed for the snapshot window.",
      recommendedAction: "Treat data as delayed or low confidence.",
    });
  }

  if (input.syncStatus === "OUT_OF_SYNC") {
    rules.push({
      code: "OUT_OF_SYNC",
      state: "INVALID",
      severity: "critical",
      explanation: "Tick and candle data are out of sync.",
      recommendedAction: "Block directional analysis until feed sync is restored.",
    });
  } else if (input.syncStatus === "LAGGING" || input.syncStatus === "UNKNOWN") {
    rules.push({
      code: "OUT_OF_SYNC",
      state: "DEGRADED",
      severity: "warning",
      explanation: "Tick and candle sync is lagging or unknown.",
      recommendedAction: "Display data quality warning.",
    });
  }

  return rules;
}

function worstState(rules: readonly DataQualityRuleResult[]): MarketDataQualityState {
  if (rules.some(rule => rule.state === "DISCONNECTED")) return "DISCONNECTED";
  if (rules.some(rule => rule.state === "INVALID")) return "INVALID";
  if (rules.some(rule => rule.state === "STALE")) return "STALE";
  if (rules.some(rule => rule.state === "DEGRADED")) return "DEGRADED";
  return "HEALTHY";
}

export function buildMarketDataHealth(input: {
  readonly ticker: NormalizedTicker;
  readonly candles: readonly NormalizedCandle[];
  readonly timeframe: MarketTimeframe;
  readonly latencyMs: number | null;
  readonly spread?: number | null;
  readonly tickRate?: number | null;
  readonly expectedCandleCount?: number;
}): MarketDataHealthModel {
  const generatedAtMs = Date.now();
  const generatedAt = new Date(generatedAtMs).toISOString();
  const lastTickAt = input.ticker.updatedAt ?? null;
  const lastCandleAt = input.candles.at(-1)?.timestamp ?? null;
  const freshnessSeconds = secondsSince(lastTickAt ?? lastCandleAt, generatedAtMs);
  const sourceStatus = marketStatusToSourceStatus(input.ticker.status, input.ticker.source);
  const expected = input.expectedCandleCount ?? expectedCandles;
  const missingCandles = Math.max(0, expected - input.candles.length);
  const qualitySpread = spreadQuality(input.spread);
  const currentSyncStatus = syncStatus(lastTickAt, lastCandleAt, input.timeframe);
  const hasValidPrice = typeof input.ticker.price === "number" && Number.isFinite(input.ticker.price);
  const rules = deriveRules({
    sourceStatus,
    freshnessSeconds,
    missingCandles,
    spreadQuality: qualitySpread,
    syncStatus: currentSyncStatus,
    tickRate: input.tickRate ?? null,
    timeframe: input.timeframe,
    hasValidPrice,
  });
  const dataQuality = worstState(rules);

  return {
    symbol: input.ticker.symbol,
    timeframe: input.timeframe,
    source: sourceModeFromTicker(input.ticker),
    sourceLabel: input.ticker.source,
    sourceStatus,
    latencyMs: input.latencyMs,
    freshnessSeconds,
    missingCandles,
    spreadQuality: qualitySpread,
    tickRate: input.tickRate ?? null,
    syncStatus: currentSyncStatus,
    dataQuality,
    qualityState: dataQuality,
    lastTickAt,
    lastCandleAt,
    generatedAt,
    rules,
    reasons: rules.length > 0 ? rules.map(rule => rule.explanation) : ["Market data is healthy."],
  };
}

export function applyKalosDataGuard(health: MarketDataHealthModel): KalosDataGuardOutput {
  const firstRule = health.rules[0] ?? null;

  if (health.spreadQuality === "ABNORMAL") {
    return {
      action: "WAIT",
      dataQuality: health.dataQuality,
      decisionOverride: "WAIT",
      dashboardBadge: "DATA_WARNING",
      journalCode: "SPREAD_ABNORMAL",
      reasons: ["KALOS Data Guard forced WAIT because spread is abnormal."],
      rejectedReasons: health.reasons,
    };
  }

  if (health.sourceStatus === "UNKNOWN" || health.dataQuality === "INVALID") {
    return {
      action: "INVALID",
      dataQuality: health.dataQuality,
      decisionOverride: "INVALID",
      dashboardBadge: "DATA_INVALID",
      journalCode: firstRule?.code ?? "SOURCE_UNKNOWN",
      reasons: ["KALOS Data Guard rejected the source as invalid."],
      rejectedReasons: health.reasons,
    };
  }

  if (health.dataQuality === "DISCONNECTED") {
    return {
      action: "INVALID",
      dataQuality: health.dataQuality,
      decisionOverride: "INVALID",
      dashboardBadge: "DATA_DISCONNECTED",
      journalCode: firstRule?.code ?? "SOURCE_DISCONNECTED",
      reasons: ["KALOS Data Guard cannot analyze a disconnected source."],
      rejectedReasons: health.reasons,
    };
  }

  if (health.dataQuality === "STALE") {
    return {
      action: "NO_TRADE",
      dataQuality: health.dataQuality,
      decisionOverride: "NO_TRADE",
      dashboardBadge: "DATA_STALE",
      journalCode: firstRule?.code ?? "DATA_STALE",
      reasons: ["KALOS Data Guard forced NO_TRADE because market data is stale."],
      rejectedReasons: health.reasons,
    };
  }

  if (health.missingCandles > 0 || health.dataQuality === "DEGRADED") {
    return {
      action: "DATA_LOW",
      dataQuality: health.dataQuality,
      decisionOverride: "DATA_LOW",
      dashboardBadge: "DATA_LOW",
      journalCode: firstRule?.code ?? "MISSING_CANDLES",
      reasons: ["KALOS Data Guard marked this snapshot as DATA_LOW."],
      rejectedReasons: health.reasons,
    };
  }

  return {
    action: "ALLOW_ANALYSIS",
    dataQuality: health.dataQuality,
    decisionOverride: null,
    dashboardBadge: "DATA_OK",
    journalCode: null,
    reasons: ["KALOS Data Guard allows analysis."],
    rejectedReasons: [],
  };
}

export function createMockUpdatedAt() {
  return nowIso();
}
