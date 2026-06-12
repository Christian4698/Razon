import { calculateAtr } from "../../kalos.utils";
import type { KalosLayerInput, VolatilityReading } from "../../kalos.types";

export function analyzeVolatility(input: KalosLayerInput): VolatilityReading {
  const candles = input.candles;
  const atr = calculateAtr(candles);
  const price = input.currentPrice ?? candles.at(-1)?.close ?? null;

  if (atr === null || typeof price !== "number" || price <= 0) {
    return {
      level: "EXTREME",
      atr: null,
      atrPercent: null,
      riskImpact: 30,
      reasons: ["Volatility cannot be measured with the available data."],
    };
  }

  const atrPercent = (atr / price) * 100;

  if (atrPercent >= 2.5) {
    return {
      level: "EXTREME",
      atr,
      atrPercent,
      riskImpact: 35,
      reasons: ["ATR is extreme relative to current price."],
    };
  }

  if (atrPercent >= 1.2) {
    return {
      level: "HIGH",
      atr,
      atrPercent,
      riskImpact: 22,
      reasons: ["ATR is elevated relative to current price."],
    };
  }

  if (atrPercent <= 0.08) {
    return {
      level: "LOW",
      atr,
      atrPercent,
      riskImpact: 8,
      reasons: ["ATR is low; movement may be compressed."],
    };
  }

  return {
    level: "NORMAL",
    atr,
    atrPercent,
    riskImpact: 4,
    reasons: ["Volatility is within a usable analysis range."],
  };
}
