import type { NormalizedCandle } from "../market/marketProvider";
import type { KalosDecision } from "./kalosEngine";

export type SignalHorizonName = "SCALPING" | "SHORT" | "LONG";
export type SignalLifecycleStatus = "ACTIVE" | "EXPIRED" | "INVALIDATED" | "REFRESHED" | "NO_TRADE";

export interface SignalHorizonWindow {
  horizon: SignalHorizonName;
  minSeconds: number;
  maxSeconds: number;
  updateFrequencySeconds: number;
}

export interface SignalHorizonStats {
  horizon: SignalHorizonName;
  score: number;
  sampleSize: number;
  survives: number;
  expires: number;
  invalidated: number;
  refreshed: number;
  avgPredictionLifeSeconds: number;
  avgDrawdown: number;
  avgProfitDurationSeconds: number;
}

export interface SignalHorizonValidation {
  sampleSize: number;
  avgPredictionLifeSeconds: number;
  bestHorizon: SignalHorizonName;
  worstHorizon: SignalHorizonName;
  avgDrawdown: number;
  avgProfitDurationSeconds: number;
  horizons: Record<SignalHorizonName, SignalHorizonStats>;
}

export interface SignalHorizon {
  selected: SignalHorizonName;
  generatedAt: string;
  firstEntryTime: string | null;
  expirationTime: string;
  invalidationTime: string | null;
  durationAliveSeconds: number;
  maxProfitWindowSeconds: number;
  maxDrawdown: number;
  updateFrequencySeconds: number;
  remainingSeconds: number;
  status: SignalLifecycleStatus;
  validation: SignalHorizonValidation;
}

interface BuildSignalHorizonInput {
  decision: KalosDecision;
  generatedAt: string;
  timeframe: string;
  currentPrice: number | null;
  entryZone: readonly [number, number] | null;
  tp: number | null;
  sl: number | null;
  invalidationLevel: number | null;
  candles: readonly NormalizedCandle[];
  nowMs?: number;
}

interface LifecycleSample {
  horizon: SignalHorizonName;
  survived: boolean;
  expired: boolean;
  invalidated: boolean;
  refreshed: boolean;
  durationAliveSeconds: number;
  maxProfitWindowSeconds: number;
  maxDrawdown: number;
}

export const SIGNAL_HORIZON_WINDOWS: Record<SignalHorizonName, SignalHorizonWindow> = {
  SCALPING: {
    horizon: "SCALPING",
    minSeconds: 30,
    maxSeconds: 180,
    updateFrequencySeconds: 10,
  },
  SHORT: {
    horizon: "SHORT",
    minSeconds: 300,
    maxSeconds: 1200,
    updateFrequencySeconds: 60,
  },
  LONG: {
    horizon: "LONG",
    minSeconds: 1800,
    maxSeconds: 10800,
    updateFrequencySeconds: 300,
  },
};

const fallbackStats = (horizon: SignalHorizonName): SignalHorizonStats => ({
  horizon,
  score: 0,
  sampleSize: 0,
  survives: 0,
  expires: 0,
  invalidated: 0,
  refreshed: 0,
  avgPredictionLifeSeconds: 0,
  avgDrawdown: 0,
  avgProfitDurationSeconds: 0,
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function timestampMs(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function candleSeconds(candles: readonly NormalizedCandle[], fallbackSeconds: number) {
  const last = candles.at(-1);
  const previous = candles.at(-2);
  if (!last || !previous) return fallbackSeconds;

  const lastMs = timestampMs(last.timestamp);
  const previousMs = timestampMs(previous.timestamp);
  if (lastMs === null || previousMs === null || lastMs <= previousMs) return fallbackSeconds;

  return Math.max(1, Math.round((lastMs - previousMs) / 1000));
}

function timeframeSeconds(timeframe: string) {
  if (timeframe === "1m" || timeframe === "M1") return 60;
  if (timeframe === "5m" || timeframe === "M5") return 300;
  if (timeframe === "15m" || timeframe === "M15") return 900;
  if (timeframe === "1h" || timeframe === "H1") return 3600;
  if (timeframe === "1d" || timeframe === "D1") return 86400;
  return 300;
}

function selectDefaultHorizon(timeframe: string): SignalHorizonName {
  const seconds = timeframeSeconds(timeframe);
  if (seconds <= 60) return "SCALPING";
  if (seconds <= 900) return "SHORT";
  return "LONG";
}

function favorableMove(decision: KalosDecision, entry: number, candle: NormalizedCandle) {
  if (decision === "BUY") return candle.high - entry;
  if (decision === "SELL") return entry - candle.low;
  return 0;
}

function adverseMove(decision: KalosDecision, entry: number, candle: NormalizedCandle) {
  if (decision === "BUY") return Math.max(0, entry - candle.low);
  if (decision === "SELL") return Math.max(0, candle.high - entry);
  return 0;
}

function touchesEntry(decision: KalosDecision, entryZone: readonly [number, number], candle: NormalizedCandle) {
  if (decision !== "BUY" && decision !== "SELL") return false;
  return candle.low <= entryZone[1] && candle.high >= entryZone[0];
}

function touchesInvalidation(decision: KalosDecision, invalidation: number | null, sl: number | null, candle: NormalizedCandle) {
  const level = invalidation ?? sl;
  if (level === null || (decision !== "BUY" && decision !== "SELL")) return false;
  return decision === "BUY" ? candle.low <= level : candle.high >= level;
}

function touchesTarget(decision: KalosDecision, tp: number | null, candle: NormalizedCandle) {
  if (tp === null || (decision !== "BUY" && decision !== "SELL")) return false;
  return decision === "BUY" ? candle.high >= tp : candle.low <= tp;
}

function evaluateLifecycle(
  horizon: SignalHorizonName,
  decision: KalosDecision,
  generatedAtMs: number,
  entryZone: readonly [number, number] | null,
  tp: number | null,
  sl: number | null,
  invalidationLevel: number | null,
  candles: readonly NormalizedCandle[]
): LifecycleSample {
  const window = SIGNAL_HORIZON_WINDOWS[horizon];
  const expiryMs = generatedAtMs + window.maxSeconds * 1000;
  const directional = decision === "BUY" || decision === "SELL";
  const entry = entryZone ? (entryZone[0] + entryZone[1]) / 2 : null;

  if (!directional || entry === null || !entryZone) {
    return {
      horizon,
      survived: false,
      expired: false,
      invalidated: false,
      refreshed: true,
      durationAliveSeconds: 0,
      maxProfitWindowSeconds: 0,
      maxDrawdown: 0,
    };
  }

  let firstEntryMs: number | null = null;
  let invalidationMs: number | null = null;
  let targetMs: number | null = null;
  let maxDrawdown = 0;
  let maxProfitWindowSeconds = 0;

  for (const candle of candles) {
    const candleMs = timestampMs(candle.timestamp);
    if (candleMs === null || candleMs < generatedAtMs || candleMs > expiryMs) continue;

    if (firstEntryMs === null && touchesEntry(decision, entryZone, candle)) {
      firstEntryMs = candleMs;
    }

    if (firstEntryMs !== null) {
      maxDrawdown = Math.max(maxDrawdown, adverseMove(decision, entry, candle));

      if (favorableMove(decision, entry, candle) > 0) {
        maxProfitWindowSeconds = Math.max(maxProfitWindowSeconds, Math.round((candleMs - firstEntryMs) / 1000));
      }

      if (targetMs === null && touchesTarget(decision, tp, candle)) {
        targetMs = candleMs;
      }

      if (invalidationMs === null && touchesInvalidation(decision, invalidationLevel, sl, candle)) {
        invalidationMs = candleMs;
        break;
      }
    }
  }

  const terminalMs = invalidationMs ?? expiryMs;
  const durationAliveSeconds = Math.max(0, Math.round((terminalMs - generatedAtMs) / 1000));
  const survived = targetMs !== null && (invalidationMs === null || targetMs <= invalidationMs);

  return {
    horizon,
    survived,
    expired: invalidationMs === null,
    invalidated: invalidationMs !== null,
    refreshed: firstEntryMs === null,
    durationAliveSeconds,
    maxProfitWindowSeconds,
    maxDrawdown: round(maxDrawdown, 6),
  };
}

function summarizeHorizon(horizon: SignalHorizonName, samples: readonly LifecycleSample[]): SignalHorizonStats {
  const relevant = samples.filter(sample => sample.horizon === horizon);
  if (relevant.length === 0) return fallbackStats(horizon);

  const survives = relevant.filter(sample => sample.survived).length;
  const expires = relevant.filter(sample => sample.expired).length;
  const invalidated = relevant.filter(sample => sample.invalidated).length;
  const refreshed = relevant.filter(sample => sample.refreshed).length;
  const avgPredictionLifeSeconds = relevant.reduce((total, sample) => total + sample.durationAliveSeconds, 0) / relevant.length;
  const avgDrawdown = relevant.reduce((total, sample) => total + sample.maxDrawdown, 0) / relevant.length;
  const avgProfitDurationSeconds = relevant.reduce((total, sample) => total + sample.maxProfitWindowSeconds, 0) / relevant.length;
  const surviveRate = survives / relevant.length;
  const invalidationRate = invalidated / relevant.length;
  const refreshRate = refreshed / relevant.length;
  const score = clamp(Math.round(surviveRate * 72 + (1 - invalidationRate) * 18 + (1 - refreshRate) * 10), 0, 100);

  return {
    horizon,
    score,
    sampleSize: relevant.length,
    survives,
    expires,
    invalidated,
    refreshed,
    avgPredictionLifeSeconds: Math.round(avgPredictionLifeSeconds),
    avgDrawdown: round(avgDrawdown, 6),
    avgProfitDurationSeconds: Math.round(avgProfitDurationSeconds),
  };
}

function buildValidation(
  decision: KalosDecision,
  entryZone: readonly [number, number] | null,
  tp: number | null,
  sl: number | null,
  invalidationLevel: number | null,
  candles: readonly NormalizedCandle[],
  timeframe: string
): SignalHorizonValidation {
  const sampleLimit = 100;
  const stepSeconds = candleSeconds(candles, timeframeSeconds(timeframe));
  const minimumForwardCandles = Math.max(2, Math.ceil(SIGNAL_HORIZON_WINDOWS.SCALPING.maxSeconds / stepSeconds));
  const maxStart = Math.max(0, candles.length - minimumForwardCandles - 1);
  const startIndexes = Array.from({ length: maxStart }, (_, index) => index).slice(-sampleLimit);
  const samples: LifecycleSample[] = [];

  for (const index of startIndexes) {
    const candle = candles[index];
    if (!candle) continue;

    const generatedAtMs = timestampMs(candle.timestamp);
    if (generatedAtMs === null) continue;

    const forward = candles.slice(index + 1);
    samples.push(
      evaluateLifecycle("SCALPING", decision, generatedAtMs, entryZone, tp, sl, invalidationLevel, forward),
      evaluateLifecycle("SHORT", decision, generatedAtMs, entryZone, tp, sl, invalidationLevel, forward),
      evaluateLifecycle("LONG", decision, generatedAtMs, entryZone, tp, sl, invalidationLevel, forward)
    );
  }

  const horizons = {
    SCALPING: summarizeHorizon("SCALPING", samples),
    SHORT: summarizeHorizon("SHORT", samples),
    LONG: summarizeHorizon("LONG", samples),
  };
  const ordered = Object.values(horizons).sort((a, b) => b.score - a.score);
  const bestHorizon = ordered[0]?.horizon ?? selectDefaultHorizon(timeframe);
  const worstHorizon = ordered.at(-1)?.horizon ?? selectDefaultHorizon(timeframe);
  const sampleSize = Math.max(horizons.SCALPING.sampleSize, horizons.SHORT.sampleSize, horizons.LONG.sampleSize);

  return {
    sampleSize,
    avgPredictionLifeSeconds: Math.round(
      (horizons.SCALPING.avgPredictionLifeSeconds + horizons.SHORT.avgPredictionLifeSeconds + horizons.LONG.avgPredictionLifeSeconds) / 3
    ),
    bestHorizon,
    worstHorizon,
    avgDrawdown: round((horizons.SCALPING.avgDrawdown + horizons.SHORT.avgDrawdown + horizons.LONG.avgDrawdown) / 3, 6),
    avgProfitDurationSeconds: Math.round(
      (horizons.SCALPING.avgProfitDurationSeconds + horizons.SHORT.avgProfitDurationSeconds + horizons.LONG.avgProfitDurationSeconds) / 3
    ),
    horizons,
  };
}

export function buildSignalHorizon(input: BuildSignalHorizonInput): SignalHorizon {
  const selected = selectDefaultHorizon(input.timeframe);
  const window = SIGNAL_HORIZON_WINDOWS[selected];
  const generatedAtMs = timestampMs(input.generatedAt) ?? (input.nowMs ?? Date.now());
  const nowMs = input.nowMs ?? Date.now();
  const expirationMs = generatedAtMs + window.maxSeconds * 1000;
  const directional = input.decision === "BUY" || input.decision === "SELL";
  const liveLifecycle = evaluateLifecycle(
    selected,
    input.decision,
    generatedAtMs,
    input.entryZone,
    input.tp,
    input.sl,
    input.invalidationLevel,
    input.candles.filter(candle => {
      const candleMs = timestampMs(candle.timestamp);
      return candleMs !== null && candleMs >= generatedAtMs;
    })
  );
  const validation = buildValidation(
    input.decision,
    input.entryZone,
    input.tp,
    input.sl,
    input.invalidationLevel,
    input.candles,
    input.timeframe
  );
  const status: SignalLifecycleStatus = !directional
    ? "NO_TRADE"
    : liveLifecycle.invalidated
      ? "INVALIDATED"
      : nowMs >= expirationMs
        ? "EXPIRED"
        : "ACTIVE";

  return {
    selected,
    generatedAt: input.generatedAt,
    firstEntryTime: null,
    expirationTime: new Date(expirationMs).toISOString(),
    invalidationTime: liveLifecycle.invalidated ? new Date(generatedAtMs + liveLifecycle.durationAliveSeconds * 1000).toISOString() : null,
    durationAliveSeconds:
      status === "ACTIVE"
        ? Math.max(0, Math.round((nowMs - generatedAtMs) / 1000))
        : liveLifecycle.durationAliveSeconds,
    maxProfitWindowSeconds: liveLifecycle.maxProfitWindowSeconds,
    maxDrawdown: liveLifecycle.maxDrawdown,
    updateFrequencySeconds: window.updateFrequencySeconds,
    remainingSeconds: Math.max(0, Math.round((expirationMs - nowMs) / 1000)),
    status,
    validation,
  };
}
