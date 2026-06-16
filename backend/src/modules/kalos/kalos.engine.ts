import { calibrateHistorically } from "./calibration/historical-calibration";
import {
  KALOS_MAX_CONFIDENCE,
  KALOS_MIN_ACCEPTED_CONFIDENCE,
  KALOS_MIN_DIRECTIONAL_CONFIDENCE,
  KALOS_MIN_ENTRY_SCORE,
} from "./kalos.constants";
import { analyzeLiquidity } from "./features/liquidity/liquidity.feature";
import { analyzeMarketStructure } from "./features/market_structure/market-structure.feature";
import { analyzeMomentum } from "./features/momentum/momentum.feature";
import { evaluateGlobalNoTrade, evaluateNoTradeLayer } from "./features/no_trade/no-trade.feature";
import { calculateEntryScore } from "./features/entry_score/entry-score.feature";
import { buildKalosReasons } from "./features/explanations/explanations.feature";
import { analyzeTrend } from "./features/trend/trend.feature";
import { analyzeVolatility } from "./features/volatility/volatility.feature";
import {
  buildKalosOverlayObjects,
  buildRejectedReasons,
  detectMarketStructure,
  detectSmartMoney,
  determineKalosTrend,
} from "./features/visual_market_intelligence/visual-market-intelligence.feature";
import { biasDirectionValue, calculateAtr, clamp, latestPrice, round } from "./kalos.utils";
import { buildFuturePathEngine } from "./future-path-engine";
import { interpretKalosMarketBrain } from "./market-brain";
import { buildMarketReplay } from "./market-replay";
import type {
  KalosAnalysisLayer,
  KalosInput,
  KalosLayerAnalysis,
  KalosLayerInput,
  KalosMode,
  KalosOutput,
  KalosSignal,
  VolatilityReading,
} from "./kalos.types";

const layerWeightsByMode: Record<KalosMode, Record<KalosAnalysisLayer, number>> = {
  SCALPING: {
    HTF: 0.15,
    MTF: 0.3,
    LTF: 0.55,
  },
  SHORT_TERM: {
    HTF: 0.25,
    MTF: 0.35,
    LTF: 0.4,
  },
  LONG_TERM: {
    HTF: 0.5,
    MTF: 0.3,
    LTF: 0.2,
  },
};

function now() {
  return new Date().toISOString();
}

function analyzeLayer(input: KalosLayerInput): KalosLayerAnalysis {
  const structureDetections = detectMarketStructure(input);
  const smartMoneyDetections = detectSmartMoney(input);
  const marketStructure = analyzeMarketStructure(input);
  const liquidity = analyzeLiquidity(input);
  const trend = analyzeTrend(input);
  const momentum = analyzeMomentum(input);
  const volatility = analyzeVolatility(input);
  const votes = [marketStructure, liquidity, trend, momentum];
  const entryScore = calculateEntryScore(votes);
  const noTrade = evaluateNoTradeLayer(input, entryScore.score);

  return {
    layer: input.layer,
    timeframe: input.timeframe,
    price: latestPrice(input.candles, input.currentPrice),
    structureDetections,
    smartMoneyDetections,
    marketStructure,
    liquidity,
    trend,
    momentum,
    volatility,
    entryScore,
    noTrade,
  };
}

function combineVolatility(analysis: readonly KalosLayerAnalysis[]): VolatilityReading {
  const sorted = [...analysis]
    .map(item => item.volatility)
    .sort((a, b) => b.riskImpact - a.riskImpact);
  const highestRisk = sorted[0];

  if (!highestRisk) {
    return {
      level: "EXTREME",
      atr: null,
      atrPercent: null,
      riskImpact: 35,
      reasons: ["No volatility layer is available."],
    };
  }

  return highestRisk;
}

function chooseSignal(
  mode: KalosMode,
  analysis: readonly KalosLayerAnalysis[],
  noTradeBlocked: boolean
): KalosSignal {
  if (noTradeBlocked) return "NO_TRADE";

  const weights = layerWeightsByMode[mode];
  const directionalEdge = analysis.reduce((total, item) => {
    const weight = weights[item.layer];
    return total + biasDirectionValue(item.entryScore.bias) * item.entryScore.score * weight;
  }, 0);
  const weakestEntry = Math.min(...analysis.map(item => item.entryScore.score));

  if (weakestEntry < KALOS_MIN_ENTRY_SCORE || Math.abs(directionalEdge) < 28) {
    return "WAIT";
  }

  return directionalEdge > 0 ? "BUY" : "SELL";
}

function calculateRiskScore(analysis: readonly KalosLayerAnalysis[], globalRiskImpact: number) {
  const volatilityRisk = analysis.reduce((total, item) => total + item.volatility.riskImpact, 0);
  const layerRisk = analysis.reduce((total, item) => total + item.noTrade.riskImpact, 0);
  const biasSet = new Set(analysis.map(item => item.entryScore.bias).filter(bias => bias !== "NEUTRAL"));
  const conflictRisk = biasSet.size > 1 ? 18 : 0;

  return clamp(Math.round(10 + volatilityRisk / 3 + layerRisk / 4 + globalRiskImpact / 3 + conflictRisk), 0, 100);
}

function calculateRawConfidence(
  signal: KalosSignal,
  mode: KalosMode,
  analysis: readonly KalosLayerAnalysis[],
  riskScore: number
) {
  const weights = layerWeightsByMode[mode];
  const directionalEdge = Math.abs(
    analysis.reduce((total, item) => {
      const weight = weights[item.layer];
      return total + biasDirectionValue(item.entryScore.bias) * item.entryScore.score * weight;
    }, 0)
  );
  const averageEntry =
    analysis.reduce((total, item) => total + item.entryScore.score, 0) / Math.max(analysis.length, 1);
  const confidenceImpact = analysis.reduce(
    (total, item) =>
      total +
      item.marketStructure.confidenceImpact +
      item.liquidity.confidenceImpact +
      item.trend.confidenceImpact +
      item.momentum.confidenceImpact,
    0
  );

  if (signal === "NO_TRADE") {
    return clamp(68 + riskScore * 0.25, 40, KALOS_MAX_CONFIDENCE);
  }

  if (signal === "WAIT") {
    return clamp(45 + averageEntry * 0.22 - riskScore * 0.16, 20, 79);
  }

  return clamp(
    42 + directionalEdge * 0.45 + averageEntry * 0.22 + confidenceImpact * 0.08 - riskScore * 0.18,
    KALOS_MIN_DIRECTIONAL_CONFIDENCE,
    KALOS_MAX_CONFIDENCE
  );
}

function pricePrecision(price: number) {
  if (price >= 1000) return 2;
  if (price >= 100) return 3;
  if (price >= 1) return 5;
  return 6;
}

function buildAnalysisLevels(
  signal: KalosSignal,
  input: KalosInput,
  analysis: readonly KalosLayerAnalysis[],
  volatility: VolatilityReading
): Pick<KalosOutput, "tp" | "sl" | "invalidation"> {
  const ltf = analysis.find(item => item.layer === "LTF");
  const fallback = analysis.at(-1);
  const price = ltf?.price ?? fallback?.price ?? null;
  const atr =
    volatility.atr ??
    calculateAtr(input.layers.find(layer => layer.layer === "LTF")?.candles ?? []) ??
    calculateAtr(input.layers.at(-1)?.candles ?? []);

  if ((signal !== "BUY" && signal !== "SELL") || typeof price !== "number" || typeof atr !== "number" || atr <= 0) {
    return {
      tp: null,
      sl: null,
      invalidation: null,
    };
  }

  const decimals = pricePrecision(price);
  const stopDistance = input.mode === "LONG_TERM" ? atr * 2.2 : atr * 1.6;
  const targetDistance = stopDistance * 2;

  if (signal === "BUY") {
    return {
      sl: round(price - stopDistance, decimals),
      tp: round(price + targetDistance, decimals),
      invalidation: round(price - stopDistance * 1.05, decimals),
    };
  }

  return {
    sl: round(price + stopDistance, decimals),
    tp: round(price - targetDistance, decimals),
    invalidation: round(price + stopDistance * 1.05, decimals),
  };
}

function capConfidence(value: number) {
  return clamp(Math.round(value), 0, KALOS_MAX_CONFIDENCE);
}

function evaluateFreshness(input: KalosInput): readonly string[] {
  if (!input.dataFreshness?.enforce) return [];

  const checkedAt = Date.parse(input.dataFreshness.checkedAt);
  if (!Number.isFinite(checkedAt) || input.dataFreshness.maxAgeMs <= 0) {
    return ["Data freshness policy is invalid; KALOS blocks execution."];
  }

  const newestTimestamp = Math.max(
    ...input.layers.flatMap(layer => layer.candles.map(candle => Date.parse(candle.timestamp))).filter(Number.isFinite)
  );

  if (!Number.isFinite(newestTimestamp)) {
    return ["Fresh market data timestamp is missing; KALOS blocks execution."];
  }

  return checkedAt - newestTimestamp > input.dataFreshness.maxAgeMs
    ? ["Market data is not fresh enough; KALOS blocks execution."]
    : [];
}

function enforceKalosBlocks(
  signal: KalosSignal,
  confidence: number,
  levels: Pick<KalosOutput, "tp" | "sl" | "invalidation">,
  volatility: VolatilityReading,
  staleReasons: readonly string[]
): KalosSignal {
  if (signal !== "BUY" && signal !== "SELL") return signal;
  if (confidence < KALOS_MIN_ACCEPTED_CONFIDENCE) return "NO_TRADE";
  if (levels.sl === null || levels.tp === null) return "NO_TRADE";
  if (volatility.level === "EXTREME") return "NO_TRADE";
  if (staleReasons.length > 0) return "NO_TRADE";
  return signal;
}

export class KalosEngine {
  evaluate(input: KalosInput): KalosOutput {
    const analysis = input.layers.map(analyzeLayer);
    const freshnessReasons = evaluateFreshness(input);
    const baseGlobalNoTrade = evaluateGlobalNoTrade(input.layers, analysis);
    const globalNoTrade = {
      ...baseGlobalNoTrade,
      blocked: baseGlobalNoTrade.blocked || freshnessReasons.length > 0,
      reasons: [...baseGlobalNoTrade.reasons, ...freshnessReasons],
      riskImpact: baseGlobalNoTrade.riskImpact + freshnessReasons.length * 25,
    };
    const preliminarySignal = chooseSignal(input.mode, analysis, globalNoTrade.blocked);
    const riskScore = calculateRiskScore(analysis, globalNoTrade.riskImpact);
    const calibration = calibrateHistorically(input.historicalSamples, preliminarySignal, input.mode);
    const rawConfidence = calculateRawConfidence(preliminarySignal, input.mode, analysis, riskScore);
    const confidence = capConfidence(rawConfidence + calibration.confidenceAdjustment);
    const signal: KalosSignal =
      preliminarySignal === "BUY" || preliminarySignal === "SELL"
        ? confidence >= KALOS_MIN_DIRECTIONAL_CONFIDENCE
          ? preliminarySignal
          : "WAIT"
        : preliminarySignal;
    const volatility = combineVolatility(analysis);
    const preliminaryLevels = buildAnalysisLevels(signal, input, analysis, volatility);
    const finalSignal = enforceKalosBlocks(signal, confidence, preliminaryLevels, volatility, freshnessReasons);
    const levels =
      finalSignal === signal
        ? preliminaryLevels
        : buildAnalysisLevels(finalSignal, input, analysis, volatility);
    const reasons = buildKalosReasons(finalSignal, analysis, globalNoTrade, calibration);
    const rejectedReasons = buildRejectedReasons(finalSignal, confidence, levels, volatility.level, globalNoTrade, freshnessReasons);
    const trend = determineKalosTrend(input.mode, analysis);
    const marketStructureDetections = analysis.flatMap(item => item.structureDetections);
    const smartMoneyDetections = analysis.flatMap(item => item.smartMoneyDetections);
    const overlayObjects = buildKalosOverlayObjects(finalSignal, confidence, levels, analysis);
    const ltfLayer = input.layers.find(layer => layer.layer === "LTF") ?? input.layers.at(-1);
    const marketBrain = interpretKalosMarketBrain({
      symbol: input.symbol,
      candles: ltfLayer?.candles ?? input.layers.flatMap(layer => layer.candles),
      trend,
      volatilityLevel: volatility.level,
      confidenceHint: capConfidence(confidence),
      riskScoreHint: riskScore,
      dataFresh: freshnessReasons.length === 0,
      sl: levels.sl,
      tp: levels.tp,
      invalidation: levels.invalidation,
      structureDetections: marketStructureDetections,
      smartMoneyDetections,
    });
    const directionalBiases = new Set(analysis.map(item => item.entryScore.bias).filter(bias => bias !== "NEUTRAL"));
    const dataQuality =
      freshnessReasons.length > 0 || input.layers.some(layer => layer.candles.length < 20) ? "LOW" : "OK";
    const futurePath = buildFuturePathEngine({
      signal: finalSignal,
      confidence: capConfidence(confidence),
      scenario: marketBrain.scenario,
      target: levels.tp,
      invalidation: levels.invalidation,
      volatility: volatility.level,
      riskScore,
      conflict: directionalBiases.size > 1,
      dataQuality,
    });
    const replayCandles = ltfLayer?.candles ?? input.layers.flatMap(layer => layer.candles);
    const marketReplay = buildMarketReplay({
      symbol: input.symbol,
      timeframe: ltfLayer?.timeframe ?? input.layers.at(-1)?.timeframe ?? "M1",
      candles: replayCandles,
      prediction: finalSignal,
      confidence: capConfidence(confidence),
      trend,
      volatility: volatility.level,
      tp: levels.tp,
      sl: levels.sl,
      invalidation: levels.invalidation,
      reasons,
      riskScore,
    });

    return {
      symbol: input.symbol,
      mode: input.mode,
      controlMode: input.controlMode ?? "MANUAL",
      signal: finalSignal,
      decision: finalSignal,
      confidence: capConfidence(confidence),
      reasons,
      rejectedReasons,
      ...levels,
      trend,
      volatility,
      risk_score: riskScore,
      riskScore,
      overlayObjects,
      marketBrain,
      futurePath,
      marketReplay,
      marketStructureDetections,
      smartMoneyDetections,
      analysis,
      calibration,
      generatedAt: now(),
      disclaimer: "Probability-based analysis only. No real execution.",
    };
  }
}

export function createKalosEngine() {
  return new KalosEngine();
}
