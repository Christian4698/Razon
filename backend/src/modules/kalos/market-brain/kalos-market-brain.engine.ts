import { KALOS_MAX_CONFIDENCE, KALOS_MIN_ACCEPTED_CONFIDENCE } from "../kalos.constants";
import { calculateAtr, clamp, latestPrice, oppositeBias, round } from "../kalos.utils";
import type { KalosBias, KalosCandle, KalosMarketStructureType, KalosSignal } from "../kalos.types";
import {
  KALOS_MARKET_BRAIN_NAME,
  type KalosLiquidityInterpretation,
  type KalosMarketBrainExpectedPath,
  type KalosMarketBrainInput,
  type KalosMarketBrainIntention,
  type KalosMarketBrainOutput,
  type KalosMarketBrainScenario,
} from "./kalos-market-brain.types";

const REQUIRED_CANDLES = 20;

function inferStructure(candles: readonly KalosCandle[], fallback?: KalosBias): KalosBias {
  if (candles.length < REQUIRED_CANDLES) return fallback ?? "NEUTRAL";

  const recent = candles.slice(-10);
  const previous = candles.slice(-20, -10);
  const recentHigh = Math.max(...recent.map(candle => candle.high));
  const recentLow = Math.min(...recent.map(candle => candle.low));
  const previousHigh = Math.max(...previous.map(candle => candle.high));
  const previousLow = Math.min(...previous.map(candle => candle.low));

  if (recentHigh > previousHigh && recentLow > previousLow) return "BULLISH";
  if (recentHigh < previousHigh && recentLow < previousLow) return "BEARISH";
  return fallback ?? "NEUTRAL";
}

function inferVolatility(candles: readonly KalosCandle[], fallback?: KalosMarketBrainInput["volatilityLevel"]) {
  if (fallback) return fallback;

  const price = latestPrice(candles);
  const atr = calculateAtr(candles);
  if (typeof price !== "number" || typeof atr !== "number" || price <= 0) return "EXTREME";

  const atrPercent = (atr / price) * 100;
  if (atrPercent >= 2.4) return "EXTREME";
  if (atrPercent >= 1.4) return "HIGH";
  if (atrPercent >= 0.35) return "NORMAL";
  return "LOW";
}

function inferImpulseScore(candles: readonly KalosCandle[], fallback?: number) {
  if (typeof fallback === "number") return clamp(fallback, 0, 100);

  const last = candles.at(-1);
  const previous = candles.at(-2);
  const atr = calculateAtr(candles);
  if (!last || !previous || typeof atr !== "number" || atr <= 0) return 0;

  const body = Math.abs(last.close - last.open);
  const continuation = Math.abs(last.close - previous.close);
  return clamp(Math.round(((body + continuation) / atr) * 52), 0, 100);
}

function hasStructure(input: KalosMarketBrainInput, type: KalosMarketStructureType) {
  return input.structureDetections?.some(item => item.type === type) ?? false;
}

function readLiquidity(input: KalosMarketBrainInput, volatility: ReturnType<typeof inferVolatility>): KalosLiquidityInterpretation {
  const smartMoneyTypes = new Set(input.smartMoneyDetections?.map(item => item.type) ?? []);
  const buySideLiquidity = smartMoneyTypes.has("Buy Side Liquidity");
  const sellSideLiquidity = smartMoneyTypes.has("Sell Side Liquidity");
  const sweep = smartMoneyTypes.has("Liquidity Sweep");
  const grab = sweep && (buySideLiquidity || sellSideLiquidity);
  const fakeBreakout = volatility === "HIGH" && sweep && hasStructure(input, "Breakout") && !hasStructure(input, "Retest");

  return {
    buySideLiquidity,
    sellSideLiquidity,
    sweep,
    grab,
    fakeBreakout,
    explanation: sweep
      ? "Liquidite lue comme hypothese de sweep/grab avant validation."
      : "Aucun sweep propre; liquidite surveillee comme hypothese ouverte.",
  };
}

function detectIntention(
  structure: KalosBias,
  liquidity: KalosLiquidityInterpretation,
  impulseScore: number,
  volatility: ReturnType<typeof inferVolatility>
): KalosMarketBrainIntention {
  if (volatility === "EXTREME") return "CONSOLIDATION";
  if (liquidity.fakeBreakout || (liquidity.sweep && impulseScore >= 62)) return "MANIPULATION";
  if (impulseScore >= 58 && structure !== "NEUTRAL") return "EXPANSION";
  if (structure === "BULLISH") return "ACCUMULATION";
  if (structure === "BEARISH") return "DISTRIBUTION";
  return "CONSOLIDATION";
}

function chooseScenario(
  input: KalosMarketBrainInput,
  structure: KalosBias,
  intention: KalosMarketBrainIntention,
  liquidity: KalosLiquidityInterpretation,
  volatility: ReturnType<typeof inferVolatility>,
  impulseScore: number
): KalosMarketBrainScenario {
  if (input.dataFresh === false || input.candles.length < REQUIRED_CANDLES || volatility === "EXTREME") return "CANCEL";
  if (structure === "NEUTRAL" || intention === "CONSOLIDATION" || liquidity.fakeBreakout) return "WAIT";
  if (hasStructure(input, "CHoCH") && liquidity.sweep) return "REVERSE";
  if (hasStructure(input, "BOS") && impulseScore >= 50) return "CONTINUE";
  if (intention === "EXPANSION" && impulseScore >= 62) return "CONTINUE";
  if (intention === "MANIPULATION") return "REVERSE";
  return "WAIT";
}

function signalFromScenario(scenario: KalosMarketBrainScenario, structure: KalosBias): KalosSignal {
  if (scenario === "CANCEL") return "NO_TRADE";
  if (scenario === "WAIT") return "WAIT";

  const scenarioBias = scenario === "REVERSE" ? oppositeBias(structure) : structure;
  if (scenarioBias === "BULLISH") return "BUY";
  if (scenarioBias === "BEARISH") return "SELL";
  return "WAIT";
}

function calculateRiskScore(
  input: KalosMarketBrainInput,
  volatility: ReturnType<typeof inferVolatility>,
  liquidity: KalosLiquidityInterpretation,
  impulseScore: number
) {
  const base = input.riskScoreHint ?? 28;
  const volatilityRisk = volatility === "EXTREME" ? 42 : volatility === "HIGH" ? 26 : volatility === "LOW" ? 4 : 12;
  const liquidityRisk = liquidity.fakeBreakout ? 24 : liquidity.sweep ? 8 : 12;
  const staleRisk = input.dataFresh === false ? 35 : 0;
  const impulseRisk = impulseScore > 82 ? 12 : impulseScore < 25 ? 8 : 0;

  return clamp(Math.round(base * 0.45 + volatilityRisk + liquidityRisk + staleRisk + impulseRisk), 0, 100);
}

function calculateConfidence(
  input: KalosMarketBrainInput,
  structure: KalosBias,
  scenario: KalosMarketBrainScenario,
  liquidity: KalosLiquidityInterpretation,
  impulseScore: number,
  riskScore: number
) {
  const hint = input.confidenceHint ?? 58;
  const structureLift = structure === "NEUTRAL" ? -8 : 9;
  const scenarioLift = scenario === "CONTINUE" ? 10 : scenario === "REVERSE" ? 7 : scenario === "WAIT" ? -8 : -18;
  const liquidityLift = liquidity.sweep ? 5 : -2;
  const raw = hint * 0.52 + structureLift + scenarioLift + liquidityLift + impulseScore * 0.16 - riskScore * 0.18 + 34;

  return clamp(Math.round(raw), 0, KALOS_MAX_CONFIDENCE);
}

function buildRejectedReasons(
  input: KalosMarketBrainInput,
  signal: KalosSignal,
  confidence: number,
  riskScore: number,
  volatility: ReturnType<typeof inferVolatility>
) {
  const reasons: string[] = [];

  if (input.candles.length < REQUIRED_CANDLES) reasons.push("Market Brain blocks: insufficient candle context.");
  if (input.dataFresh === false) reasons.push("Market Brain blocks: data is not fresh.");
  if (volatility === "EXTREME") reasons.push("Market Brain blocks: market is too chaotic.");
  if ((signal === "BUY" || signal === "SELL") && confidence < KALOS_MIN_ACCEPTED_CONFIDENCE) {
    reasons.push("Market Brain blocks: confidence below 80 keeps the hypothesis in WAIT.");
  }
  if ((signal === "BUY" || signal === "SELL") && input.sl == null) {
    reasons.push("Market Brain blocks: SL is mandatory.");
  }
  if ((signal === "BUY" || signal === "SELL") && input.tp == null) {
    reasons.push("Market Brain blocks: TP is mandatory.");
  }
  if (riskScore >= 76) reasons.push("Market Brain blocks: risk score is too high.");

  return reasons;
}

function enforceSignal(signal: KalosSignal, rejectedReasons: readonly string[]) {
  if (signal !== "BUY" && signal !== "SELL") return signal;
  return rejectedReasons.length > 0 ? "WAIT" : signal;
}

function buildInvalidation(input: KalosMarketBrainInput, signal: KalosSignal, structure: KalosBias) {
  if (input.invalidation != null) return input.invalidation;

  const recent = input.candles.slice(-8);
  if (recent.length === 0) return null;

  const decimals = latestPrice(input.candles) && (latestPrice(input.candles) ?? 0) >= 100 ? 2 : 5;
  if (signal === "BUY" || structure === "BULLISH") return round(Math.min(...recent.map(candle => candle.low)), decimals);
  if (signal === "SELL" || structure === "BEARISH") return round(Math.max(...recent.map(candle => candle.high)), decimals);
  return null;
}

function buildExpectedPath(
  scenario: KalosMarketBrainScenario,
  confidence: number,
  invalidation: number | null,
  tp?: number | null
): readonly KalosMarketBrainExpectedPath[] {
  const firstProbability = clamp(confidence - 6, 0, KALOS_MAX_CONFIDENCE);
  const secondProbability = clamp(confidence - 14, 0, KALOS_MAX_CONFIDENCE);

  if (scenario === "CONTINUE") {
    return [
      { step: "RETEST", hypothesis: "Hypothese: retest controle avant continuation.", probability: firstProbability },
      { step: "EXPANSION", hypothesis: "Probabilite de continuation surveillee, sans certitude.", probability: secondProbability, price: tp ?? undefined },
    ];
  }

  if (scenario === "REVERSE") {
    return [
      { step: "LIQUIDITY_TEST", hypothesis: "Hypothese: sweep confirme avant retournement.", probability: firstProbability },
      { step: "REVERSAL_CHECK", hypothesis: "Probabilite de retournement conditionnee par CHoCH.", probability: secondProbability },
    ];
  }

  if (scenario === "CANCEL") {
    return [
      { step: "INVALIDATION", hypothesis: "Hypothese annulee; attendre des donnees lisibles.", probability: confidence, price: invalidation ?? undefined },
    ];
  }

  return [
    { step: "WAIT_CONFIRMATION", hypothesis: "Hypothese en attente; la confiance reste insuffisante.", probability: confidence },
  ];
}

function buildExplanation(
  structure: KalosBias,
  intention: KalosMarketBrainIntention,
  scenario: KalosMarketBrainScenario,
  confidence: number
) {
  return [
    `KALOS Market Brain lit une structure ${structure} avec intention ${intention}.`,
    `Scenario ${scenario}: hypothese probabiliste avec confiance ${confidence}%, sans execution.`,
  ].join(" ");
}

export function interpretKalosMarketBrain(input: KalosMarketBrainInput): KalosMarketBrainOutput {
  const structure = inferStructure(input.candles, input.trend);
  const volatility = inferVolatility(input.candles, input.volatilityLevel);
  const impulseScore = inferImpulseScore(input.candles, input.impulseScore);
  const liquidity = readLiquidity(input, volatility);
  const intention = detectIntention(structure, liquidity, impulseScore, volatility);
  const scenario = chooseScenario(input, structure, intention, liquidity, volatility, impulseScore);
  const preliminarySignal = signalFromScenario(scenario, structure);
  const riskScore = calculateRiskScore(input, volatility, liquidity, impulseScore);
  const confidence = calculateConfidence(input, structure, scenario, liquidity, impulseScore, riskScore);
  const rejectedReasons = buildRejectedReasons(input, preliminarySignal, confidence, riskScore, volatility);
  const signal = enforceSignal(preliminarySignal, rejectedReasons);
  const finalScenario = signal === "WAIT" && scenario !== "CANCEL" && preliminarySignal !== "WAIT" ? "WAIT" : scenario;
  const invalidation = buildInvalidation(input, signal, structure);

  return {
    module: KALOS_MARKET_BRAIN_NAME,
    signal,
    confidence,
    scenario: finalScenario,
    explanation: buildExplanation(structure, intention, finalScenario, confidence),
    invalidation,
    expectedPath: buildExpectedPath(finalScenario, confidence, invalidation, input.tp),
    timingScore: clamp(Math.round(impulseScore * 0.55 + confidence * 0.35 - riskScore * 0.2), 0, 100),
    riskScore,
    structure,
    intention,
    volatility,
    liquidity,
    pipeline: ["READ_MARKET", "BUILD_STRUCTURE", "DETECT_INTENTION", "VERIFY_LIQUIDITY", "GENERATE_SCENARIO"],
    rejectedReasons,
    liveExecutionAllowed: false,
    disclaimer: "Probabilistic hypothesis only. No real execution.",
  };
}
