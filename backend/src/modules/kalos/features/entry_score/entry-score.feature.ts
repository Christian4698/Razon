import { biasDirectionValue, clamp } from "../../kalos.utils";
import type { EntryScoreReading, FeatureVote, KalosBias } from "../../kalos.types";

export function calculateEntryScore(votes: readonly FeatureVote[]): EntryScoreReading {
  const directional = votes.filter(vote => vote.bias !== "NEUTRAL");
  if (directional.length === 0) {
    return {
      score: 0,
      bias: "NEUTRAL",
      reasons: ["No directional feature supports an entry."],
    };
  }

  const directionSum = directional.reduce(
    (total, vote) => total + biasDirectionValue(vote.bias) * vote.score,
    0
  );
  const bullishScore = directional
    .filter(vote => vote.bias === "BULLISH")
    .reduce((total, vote) => total + vote.score, 0);
  const bearishScore = directional
    .filter(vote => vote.bias === "BEARISH")
    .reduce((total, vote) => total + vote.score, 0);
  const dominant: KalosBias =
    Math.abs(directionSum) < 35 ? "NEUTRAL" : directionSum > 0 ? "BULLISH" : "BEARISH";
  const alignment = Math.abs(bullishScore - bearishScore) / Math.max(bullishScore + bearishScore, 1);
  const score = clamp(Math.round(45 + alignment * 45), 0, 90);

  return {
    score: dominant === "NEUTRAL" ? Math.min(score, 48) : score,
    bias: dominant,
    reasons:
      dominant === "NEUTRAL"
        ? ["Feature alignment is not directional enough for an entry."]
        : [`Entry score favors ${dominant}.`],
  };
}
