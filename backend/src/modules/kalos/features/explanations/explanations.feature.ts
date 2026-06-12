import type {
  KalosLayerAnalysis,
  KalosSignal,
  HistoricalCalibration,
  NoTradeReading,
} from "../../kalos.types";

export function buildKalosReasons(
  signal: KalosSignal,
  analysis: readonly KalosLayerAnalysis[],
  noTrade: NoTradeReading,
  calibration: HistoricalCalibration
): readonly string[] {
  const reasons: string[] = [];

  if (noTrade.blocked) {
    reasons.push(...noTrade.reasons);
  }

  for (const item of analysis) {
    reasons.push(
      `${item.layer}/${item.timeframe}: structure ${item.marketStructure.bias}, trend ${item.trend.bias}, momentum ${item.momentum.bias}.`
    );
    reasons.push(...item.entryScore.reasons);
    reasons.push(...item.volatility.reasons.map(reason => `${item.layer}: ${reason}`));
  }

  reasons.push(...calibration.reasons);

  if (signal === "WAIT") {
    reasons.push("Directional edge is not strong enough; WAIT is preferred.");
  }

  if (signal === "NO_TRADE") {
    reasons.push("Risk or data quality blocks the setup; NO_TRADE is valid.");
  }

  if (signal === "BUY" || signal === "SELL") {
    reasons.push(`KALOS favors ${signal}, but this is probability-based analysis only.`);
  }

  return reasons;
}
