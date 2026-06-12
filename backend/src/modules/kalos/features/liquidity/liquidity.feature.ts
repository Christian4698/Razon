import type { FeatureVote, KalosLayerInput } from "../../kalos.types";

export function analyzeLiquidity(input: KalosLayerInput): FeatureVote {
  const candles = input.candles;
  const last = candles.at(-1);
  const previous = candles.slice(-16, -1);

  if (!last || previous.length < 8) {
    return {
      feature: "liquidity",
      layer: input.layer,
      bias: "NEUTRAL",
      score: 0,
      confidenceImpact: -6,
      riskImpact: 10,
      reasons: ["Liquidity read has insufficient candles."],
    };
  }

  const previousHigh = Math.max(...previous.map(candle => candle.high));
  const previousLow = Math.min(...previous.map(candle => candle.low));
  const sweptHigh = last.high > previousHigh && last.close < previousHigh;
  const sweptLow = last.low < previousLow && last.close > previousLow;

  if (sweptLow) {
    return {
      feature: "liquidity",
      layer: input.layer,
      bias: "BULLISH",
      score: 72,
      confidenceImpact: 8,
      riskImpact: -2,
      reasons: ["Liquidity sweep below recent lows recovered into the range."],
    };
  }

  if (sweptHigh) {
    return {
      feature: "liquidity",
      layer: input.layer,
      bias: "BEARISH",
      score: 72,
      confidenceImpact: 8,
      riskImpact: -2,
      reasons: ["Liquidity sweep above recent highs rejected back into the range."],
    };
  }

  return {
    feature: "liquidity",
    layer: input.layer,
    bias: "NEUTRAL",
    score: 45,
    confidenceImpact: -2,
    riskImpact: 4,
    reasons: ["No clean liquidity sweep is visible."],
  };
}
