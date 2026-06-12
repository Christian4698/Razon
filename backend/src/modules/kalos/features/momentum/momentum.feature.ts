import { clamp } from "../../kalos.utils";
import type { FeatureVote, KalosLayerInput } from "../../kalos.types";

export function analyzeMomentum(input: KalosLayerInput): FeatureVote {
  const closes = input.candles.map(candle => candle.close);

  if (closes.length < 8) {
    return {
      feature: "momentum",
      layer: input.layer,
      bias: "NEUTRAL",
      score: 0,
      confidenceImpact: -6,
      riskImpact: 10,
      reasons: ["Momentum has insufficient closes."],
    };
  }

  const first = closes.at(-8);
  const last = closes.at(-1);
  if (typeof first !== "number" || typeof last !== "number" || first === 0) {
    return {
      feature: "momentum",
      layer: input.layer,
      bias: "NEUTRAL",
      score: 0,
      confidenceImpact: -6,
      riskImpact: 10,
      reasons: ["Momentum input is invalid."],
    };
  }

  const changePercent = ((last - first) / first) * 100;
  const score = clamp(Math.round(Math.abs(changePercent) * 28), 20, 82);

  if (changePercent > 0.08) {
    return {
      feature: "momentum",
      layer: input.layer,
      bias: "BULLISH",
      score,
      confidenceImpact: 7,
      riskImpact: -1,
      reasons: ["Recent closes show bullish momentum."],
    };
  }

  if (changePercent < -0.08) {
    return {
      feature: "momentum",
      layer: input.layer,
      bias: "BEARISH",
      score,
      confidenceImpact: 7,
      riskImpact: -1,
      reasons: ["Recent closes show bearish momentum."],
    };
  }

  return {
    feature: "momentum",
    layer: input.layer,
    bias: "NEUTRAL",
    score: 36,
    confidenceImpact: -3,
    riskImpact: 4,
    reasons: ["Momentum is too flat for directional conviction."],
  };
}
