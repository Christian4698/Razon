import type { NormalizedCandle } from "../market/marketProvider";

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
  trend: "bullish" | "bearish" | "sideways" | "unavailable";
  marketStrength: number;
  volatility: "low" | "normal" | "high" | "unavailable";
}

export interface IndicatorSeries {
  ema20: IndicatorSeriesPoint[];
  ema50: IndicatorSeriesPoint[];
  ema200: IndicatorSeriesPoint[];
}

function round(value: number, decimals = 5): number {
  return Number(value.toFixed(decimals));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function emaSeries(values: number[], period: number): Array<number | null> {
  if (values.length < period) {
    return values.map(() => null);
  }

  const multiplier = 2 / (period + 1);
  const output: Array<number | null> = values.map(() => null);
  let previous = average(values.slice(0, period));

  if (previous === null) return output;

  output[period - 1] = previous;

  for (let index = period; index < values.length; index++) {
    previous = values[index] * multiplier + previous * (1 - multiplier);
    output[index] = previous;
  }

  return output;
}

function latest(values: Array<number | null>) {
  for (let index = values.length - 1; index >= 0; index--) {
    if (typeof values[index] === "number") return values[index];
  }

  return null;
}

function calculateRsi(closes: number[], period = 14) {
  if (closes.length <= period) return null;

  const changes = closes.slice(1).map((close, index) => close - closes[index]);
  const recent = changes.slice(-period);
  const gains = recent.map(value => (value > 0 ? value : 0));
  const losses = recent.map(value => (value < 0 ? Math.abs(value) : 0));
  const averageGain = average(gains) ?? 0;
  const averageLoss = average(losses) ?? 0;

  if (averageLoss === 0) return 100;

  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

function calculateAtr(candles: NormalizedCandle[], period = 14) {
  if (candles.length <= period) return null;

  const trueRanges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });

  return average(trueRanges.slice(-period));
}

function standardDeviation(values: number[]) {
  const mean = average(values);
  if (mean === null) return null;

  const variance =
    values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

function calculateMacd(closes: number[]) {
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdSeries = closes.map((_, index) => {
    const fast = ema12[index];
    const slow = ema26[index];
    return typeof fast === "number" && typeof slow === "number" ? fast - slow : null;
  });
  const compactMacd = macdSeries.filter((value): value is number => typeof value === "number");
  const signalSeries = emaSeries(compactMacd, 9);
  const value = latest(macdSeries);
  const signal = latest(signalSeries);

  return {
    value,
    signal,
    histogram: typeof value === "number" && typeof signal === "number" ? value - signal : null,
  };
}

function detectPatterns(candles: NormalizedCandle[]) {
  const last = candles.at(-1);
  const previous = candles.at(-2);

  if (!last || !previous) return [];

  const patterns: string[] = [];
  const body = Math.abs(last.close - last.open);
  const range = last.high - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;

  if (range > 0 && body / range < 0.18) patterns.push("Doji");
  if (lowerWick > body * 2 && upperWick < body) patterns.push("Hammer");
  if (upperWick > body * 2 && lowerWick < body) patterns.push("Shooting Star");
  if (last.close > last.open && previous.close < previous.open && last.close > previous.open) {
    patterns.push("Bullish Engulfing");
  }
  if (last.close < last.open && previous.close > previous.open && last.close < previous.open) {
    patterns.push("Bearish Engulfing");
  }

  return patterns;
}

function detectStructure(candles: NormalizedCandle[]): Pick<IndicatorSnapshot, "bos" | "choch"> {
  if (candles.length < 12) {
    return {
      bos: "none" as const,
      choch: "none" as const,
    };
  }

  const previous = candles.slice(-12, -6);
  const recent = candles.slice(-6);
  const previousHigh = Math.max(...previous.map(candle => candle.high));
  const previousLow = Math.min(...previous.map(candle => candle.low));
  const recentHigh = Math.max(...recent.map(candle => candle.high));
  const recentLow = Math.min(...recent.map(candle => candle.low));
  const firstRecentClose = recent[0].close;
  const lastClose = recent.at(-1)?.close ?? firstRecentClose;

  const bos: IndicatorSnapshot["bos"] =
    recentHigh > previousHigh && lastClose > previousHigh
      ? "bullish"
      : recentLow < previousLow && lastClose < previousLow
        ? "bearish"
        : "none";
  const choch: IndicatorSnapshot["choch"] =
    firstRecentClose < previousHigh && lastClose > previousHigh
      ? "bullish"
      : firstRecentClose > previousLow && lastClose < previousLow
        ? "bearish"
        : "none";

  return { bos, choch };
}

export function calculateIndicators(candles: NormalizedCandle[]): {
  snapshot: IndicatorSnapshot;
  series: IndicatorSeries;
} {
  const emptySeries: IndicatorSeries = { ema20: [], ema50: [], ema200: [] };
  const emptySnapshot: IndicatorSnapshot = {
    ema20: null,
    ema50: null,
    ema200: null,
    rsi: null,
    macd: { value: null, signal: null, histogram: null },
    atr: null,
    volume: { current: null, average: null, relative: null },
    bollingerBands: { upper: null, middle: null, lower: null },
    fibonacci: [],
    supportResistance: { support: null, resistance: null },
    bos: "none",
    choch: "none",
    supplyDemand: { supply: null, demand: null },
    liquidityZones: [],
    candlestickPatterns: [],
    momentum: null,
    trend: "unavailable",
    marketStrength: 0,
    volatility: "unavailable",
  };

  if (candles.length === 0) {
    return { snapshot: emptySnapshot, series: emptySeries };
  }

  const closes = candles.map(candle => candle.close);
  const highs = candles.map(candle => candle.high);
  const lows = candles.map(candle => candle.low);
  const volumes = candles
    .map(candle => candle.volume)
    .filter((value): value is number => typeof value === "number");
  const lastClose = closes.at(-1) ?? null;
  const ema20Raw = emaSeries(closes, 20);
  const ema50Raw = emaSeries(closes, 50);
  const ema200Raw = emaSeries(closes, 200);
  const ema20 = latest(ema20Raw);
  const ema50 = latest(ema50Raw);
  const ema200 = latest(ema200Raw);
  const rsi = calculateRsi(closes);
  const atr = calculateAtr(candles);
  const macd = calculateMacd(closes);
  const bollingerWindow = closes.slice(-20);
  const bollingerMiddle = average(bollingerWindow);
  const bollingerDeviation = standardDeviation(bollingerWindow);
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const range = high - low;
  const support = Math.min(...lows.slice(-30));
  const resistance = Math.max(...highs.slice(-30));
  const currentVolume = volumes.at(-1) ?? null;
  const averageVolume = average(volumes.slice(-20));
  const relativeVolume =
    typeof currentVolume === "number" && typeof averageVolume === "number" && averageVolume > 0
      ? currentVolume / averageVolume
      : null;
  const momentum =
    closes.length >= 10 && lastClose !== null ? ((lastClose - closes[closes.length - 10]) / closes[closes.length - 10]) * 100 : null;
  const structure = detectStructure(candles);
  const trend =
    typeof lastClose === "number" && typeof ema20 === "number" && typeof ema50 === "number"
      ? lastClose > ema20 && ema20 > ema50
        ? "bullish"
        : lastClose < ema20 && ema20 < ema50
          ? "bearish"
          : "sideways"
      : "unavailable";
  const atrPercent = typeof atr === "number" && typeof lastClose === "number" && lastClose > 0 ? (atr / lastClose) * 100 : null;
  const volatility =
    atrPercent === null
      ? "unavailable"
      : atrPercent > 2.2
        ? "high"
        : atrPercent < 0.6
          ? "low"
          : "normal";
  const marketStrength = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (trend === "bullish" || trend === "bearish" ? 35 : 10) +
          (typeof rsi === "number" ? Math.abs(rsi - 50) : 0) +
          (typeof relativeVolume === "number" ? Math.min(relativeVolume * 15, 25) : 0) +
          (typeof momentum === "number" ? Math.min(Math.abs(momentum) * 2, 20) : 0)
      )
    )
  );

  return {
    snapshot: {
      ema20: ema20 === null ? null : round(ema20),
      ema50: ema50 === null ? null : round(ema50),
      ema200: ema200 === null ? null : round(ema200),
      rsi: rsi === null ? null : round(rsi, 2),
      macd: {
        value: macd.value === null ? null : round(macd.value),
        signal: macd.signal === null ? null : round(macd.signal),
        histogram: macd.histogram === null ? null : round(macd.histogram),
      },
      atr: atr === null ? null : round(atr),
      volume: {
        current: currentVolume,
        average: averageVolume === null ? null : round(averageVolume, 0),
        relative: relativeVolume === null ? null : round(relativeVolume, 2),
      },
      bollingerBands: {
        upper:
          bollingerMiddle === null || bollingerDeviation === null
            ? null
            : round(bollingerMiddle + bollingerDeviation * 2),
        middle: bollingerMiddle === null ? null : round(bollingerMiddle),
        lower:
          bollingerMiddle === null || bollingerDeviation === null
            ? null
            : round(bollingerMiddle - bollingerDeviation * 2),
      },
      fibonacci:
        range <= 0
          ? []
          : [
              { label: "0.236", value: round(high - range * 0.236) },
              { label: "0.382", value: round(high - range * 0.382) },
              { label: "0.500", value: round(high - range * 0.5) },
              { label: "0.618", value: round(high - range * 0.618) },
              { label: "0.786", value: round(high - range * 0.786) },
            ],
      supportResistance: {
        support: Number.isFinite(support) ? round(support) : null,
        resistance: Number.isFinite(resistance) ? round(resistance) : null,
      },
      bos: structure.bos,
      choch: structure.choch,
      supplyDemand: {
        supply: range > 0 ? [round(resistance - range * 0.08), round(resistance)] : null,
        demand: range > 0 ? [round(support), round(support + range * 0.08)] : null,
      },
      liquidityZones: [
        ...(Number.isFinite(resistance) ? [{ side: "buy-side" as const, level: round(resistance) }] : []),
        ...(Number.isFinite(support) ? [{ side: "sell-side" as const, level: round(support) }] : []),
      ],
      candlestickPatterns: detectPatterns(candles),
      momentum: momentum === null ? null : round(momentum, 2),
      trend,
      marketStrength,
      volatility,
    },
    series: {
      ema20: candles.map((candle, index) => ({
        timestamp: candle.timestamp,
        value: ema20Raw[index] === null ? null : round(ema20Raw[index] as number),
      })),
      ema50: candles.map((candle, index) => ({
        timestamp: candle.timestamp,
        value: ema50Raw[index] === null ? null : round(ema50Raw[index] as number),
      })),
      ema200: candles.map((candle, index) => ({
        timestamp: candle.timestamp,
        value: ema200Raw[index] === null ? null : round(ema200Raw[index] as number),
      })),
    },
  };
}
