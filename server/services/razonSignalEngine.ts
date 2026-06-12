import type {
  RazonMarketInput,
  RazonSignalDecision,
  RazonSignalOutput,
} from "../types/razon";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function scoreConfidence(input: RazonMarketInput, decision: RazonSignalDecision) {
  if (decision === "WAIT") {
    return 0;
  }

  const price = input.price ?? 0;
  const ema = input.ema ?? price;
  const atr = input.atr ?? 0;
  const rsi = input.rsi ?? 50;
  const volume = input.volume ?? 0;
  const trendDistance = Math.abs(price - ema) / Math.max(atr, 1);
  const trendScore = clamp(trendDistance * 18, 0, 35);
  const rsiScore =
    decision === "BUY"
      ? clamp((rsi - 50) * 2.2, 0, 30)
      : clamp((50 - rsi) * 2.2, 0, 30);
  const volumeScore = volume > 0 ? 15 : 0;
  const volatilityScore = atr > 0 ? 10 : 0;

  return clamp(Math.round(25 + trendScore + rsiScore + volumeScore + volatilityScore), 0, 100);
}

export const razonSignalEngine = {
  evaluate(input: RazonMarketInput): RazonSignalOutput {
    const price = input.price ?? 0;
    const ema = input.ema ?? price;
    const atr = input.atr ?? 0;
    const rsi = input.rsi ?? 50;
    const volume = input.volume ?? 0;
    const priceAboveEma = price > ema;
    const priceBelowEma = price < ema;
    const validAtr = atr > 0;
    const validVolume = volume > 0;

    const reasons: string[] = [];
    let decision: RazonSignalDecision = "WAIT";

    if (priceAboveEma && rsi >= 52 && rsi <= 70 && validAtr && validVolume) {
      decision = "BUY";
      reasons.push("Price is above EMA, showing short-term bullish structure.");
      reasons.push("RSI is constructive without entering an extreme zone.");
      reasons.push("ATR is available for defining analysis-only SL and TP levels.");
    } else if (
      priceBelowEma &&
      rsi <= 48 &&
      rsi >= 30 &&
      validAtr &&
      validVolume
    ) {
      decision = "SELL";
      reasons.push("Price is below EMA, showing short-term bearish structure.");
      reasons.push("RSI confirms downside pressure without an extreme reading.");
      reasons.push("ATR is available for defining analysis-only SL and TP levels.");
    } else {
      reasons.push("Signal rules are not aligned strongly enough for BUY or SELL.");
      if (!validVolume) {
        reasons.push("Volume input is missing or zero.");
      }
      if (!validAtr) {
        reasons.push("ATR input is missing or zero.");
      }
      if (rsi > 70 || rsi < 30) {
        reasons.push("RSI is in an extreme zone, so V1 avoids a directional signal.");
      }
    }

    const confidence = scoreConfidence(input, decision);

    if (decision === "BUY") {
      return {
        signal: decision,
        confidence,
        entry: round(price),
        sl: round(price - atr * 2),
        tp: round(price + atr * 3),
        reasons,
      };
    }

    if (decision === "SELL") {
      return {
        signal: decision,
        confidence,
        entry: round(price),
        sl: round(price + atr * 2),
        tp: round(price - atr * 3),
        reasons,
      };
    }

    return {
      signal: decision,
      confidence,
      entry: null,
      sl: null,
      tp: null,
      reasons,
    };
  },
};
