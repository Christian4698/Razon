import { average, latestPrice } from "../../kalos.utils";
import type { FeatureVote, KalosLayerInput } from "../../kalos.types";

export function analyzeTrend(input: KalosLayerInput): FeatureVote {
  const candles = input.candles;
  const price = latestPrice(candles, input.currentPrice);
  const shortAverage = average(candles.slice(-12).map(candle => candle.close));
  const longAverage = average(candles.slice(-34).map(candle => candle.close));

  if (typeof price !== "number" || shortAverage === null || longAverage === null) {
    return {
      feature: "trend",
      layer: input.layer,
      bias: "NEUTRAL",
      score: 0,
      confidenceImpact: -8,
      riskImpact: 12,
      reasons: ["Trend cannot be validated without enough closes."],
    };
  }

  if (price > shortAverage && shortAverage > longAverage) {
    return {
      feature: "trend",
      layer: input.layer,
      bias: "BULLISH",
      score: 78,
      confidenceImpact: 12,
      riskImpact: -5,
      reasons: ["Price is above short and long averages."],
    };
  }

  if (price < shortAverage && shortAverage < longAverage) {
    return {
      feature: "trend",
      layer: input.layer,
      bias: "BEARISH",
      score: 78,
      confidenceImpact: 12,
      riskImpact: -5,
      reasons: ["Price is below short and long averages."],
    };
  }

  return {
    feature: "trend",
    layer: input.layer,
    bias: "NEUTRAL",
    score: 44,
    confidenceImpact: -3,
    riskImpact: 7,
    reasons: ["Trend averages are not aligned."],
  };
}
