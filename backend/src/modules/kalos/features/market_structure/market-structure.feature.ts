import { clamp } from "../../kalos.utils";
import type { FeatureVote, KalosLayerInput } from "../../kalos.types";

export function analyzeMarketStructure(input: KalosLayerInput): FeatureVote {
  const candles = input.candles;
  const recent = candles.slice(-10);
  const previous = candles.slice(-20, -10);

  if (recent.length < 5 || previous.length < 5) {
    return {
      feature: "market_structure",
      layer: input.layer,
      bias: "NEUTRAL",
      score: 0,
      confidenceImpact: -8,
      riskImpact: 12,
      reasons: ["Market structure has insufficient candles."],
    };
  }

  const recentHigh = Math.max(...recent.map(candle => candle.high));
  const recentLow = Math.min(...recent.map(candle => candle.low));
  const previousHigh = Math.max(...previous.map(candle => candle.high));
  const previousLow = Math.min(...previous.map(candle => candle.low));
  const higherHigh = recentHigh > previousHigh;
  const higherLow = recentLow > previousLow;
  const lowerHigh = recentHigh < previousHigh;
  const lowerLow = recentLow < previousLow;

  if (higherHigh && higherLow) {
    return {
      feature: "market_structure",
      layer: input.layer,
      bias: "BULLISH",
      score: clamp(68 + Number(higherHigh) * 8 + Number(higherLow) * 8, 0, 100),
      confidenceImpact: 10,
      riskImpact: -4,
      reasons: ["Structure shows higher high and higher low behavior."],
    };
  }

  if (lowerHigh && lowerLow) {
    return {
      feature: "market_structure",
      layer: input.layer,
      bias: "BEARISH",
      score: clamp(68 + Number(lowerHigh) * 8 + Number(lowerLow) * 8, 0, 100),
      confidenceImpact: 10,
      riskImpact: -4,
      reasons: ["Structure shows lower high and lower low behavior."],
    };
  }

  return {
    feature: "market_structure",
    layer: input.layer,
    bias: "NEUTRAL",
    score: 42,
    confidenceImpact: -4,
    riskImpact: 8,
    reasons: ["Structure is mixed or ranging."],
  };
}
