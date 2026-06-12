import type { KalosBias, KalosCandle } from "./kalos.types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, decimals = 5) {
  return Number(value.toFixed(decimals));
}

export function average(values: readonly number[]) {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function latestPrice(candles: readonly KalosCandle[], currentPrice?: number) {
  return typeof currentPrice === "number" ? currentPrice : candles.at(-1)?.close ?? null;
}

export function candleRange(candle: KalosCandle) {
  return Math.max(candle.high - candle.low, 0);
}

export function calculateAtr(candles: readonly KalosCandle[], period = 14) {
  if (candles.length < 2) return null;

  const sample = candles.slice(-period - 1);
  const ranges = sample.slice(1).map((candle, index) => {
    const previousClose = sample[index]?.close ?? candle.close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });

  return average(ranges);
}

export function biasDirectionValue(bias: KalosBias) {
  if (bias === "BULLISH") return 1;
  if (bias === "BEARISH") return -1;
  return 0;
}

export function oppositeBias(bias: KalosBias): KalosBias {
  if (bias === "BULLISH") return "BEARISH";
  if (bias === "BEARISH") return "BULLISH";
  return "NEUTRAL";
}
