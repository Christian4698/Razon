import { KALOS_MIN_ENTRY_SCORE, KALOS_REQUIRED_LAYERS } from "../../kalos.constants";
import type { KalosLayerAnalysis, KalosLayerInput, NoTradeReading } from "../../kalos.types";

export function evaluateNoTradeLayer(input: KalosLayerInput, entryScore: number): NoTradeReading {
  const reasons: string[] = [];
  let riskImpact = 0;

  if (input.candles.length < 30) {
    reasons.push(`${input.layer} has fewer than 30 candles.`);
    riskImpact += 20;
  }

  if (entryScore < KALOS_MIN_ENTRY_SCORE) {
    reasons.push(`${input.layer} entry score is below the minimum threshold.`);
    riskImpact += 12;
  }

  return {
    blocked: reasons.length > 0,
    reasons,
    riskImpact,
  };
}

export function evaluateGlobalNoTrade(
  layers: readonly KalosLayerInput[],
  analysis: readonly KalosLayerAnalysis[]
): NoTradeReading {
  const layerNames = new Set(layers.map(layer => layer.layer));
  const reasons: string[] = [];
  let riskImpact = 0;

  for (const required of KALOS_REQUIRED_LAYERS) {
    if (!layerNames.has(required)) {
      reasons.push(`Missing required ${required} analysis layer.`);
      riskImpact += 30;
    }
  }

  for (const item of analysis) {
    if (item.volatility.level === "EXTREME") {
      reasons.push(`${item.layer} volatility is extreme.`);
      riskImpact += 25;
    }

    if (item.noTrade.blocked) {
      reasons.push(...item.noTrade.reasons);
      riskImpact += item.noTrade.riskImpact;
    }
  }

  return {
    blocked: reasons.length > 0,
    reasons,
    riskImpact,
  };
}
