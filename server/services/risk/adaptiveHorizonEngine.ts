import type { NormalizedCandle } from "../market/marketProvider";
import type { SignalHorizon, SignalHorizonName } from "../kalos/signalHorizon";
import type { StatisticalRiskOutput } from "./statisticalRiskEngine";
import type { BacktestMonteCarloReport } from "../backtest/backtestMonteCarloEngine";

export type TimeframeAgreement = "ALIGNED" | "PARTIAL" | "CONFLICT" | "STRONG_CONFLICT";
export type AdaptiveRiskMode = "NORMAL" | "CAUTION" | "DEFENSIVE" | "NO_TRADE";
export type AdaptiveRecommendedAction = "TRADE_ALLOWED_SIMULATION" | "TAKE_PROFIT_QUICKLY" | "HOLD_CAUTIOUSLY" | "NO_TRADE";

export interface AdaptiveHorizonOutput {
  selectedHorizon: SignalHorizonName;
  reason: string;
  validForSeconds: number;
  profitWindowSeconds: number;
  recommendedAction: AdaptiveRecommendedAction;
  noTrade: boolean;
  noTradeReason: string | null;
  timeframeAgreement: TimeframeAgreement;
  riskMode: AdaptiveRiskMode;
  confidenceAdjustment: number;
  fixedHorizon: SignalHorizonName;
  comparison: {
    accuracyBefore: number;
    accuracyAfter: number;
    noTradeRate: number;
    drawdownBefore: number;
    drawdownAfter: number;
    pnlBefore: number;
    pnlAfter: number;
    recommendedDefault: SignalHorizonName;
  };
  liveExecutionAllowed: false;
}

interface AdaptiveInput {
  market: string;
  fixedHorizon: SignalHorizonName;
  signalHorizon: SignalHorizon;
  statisticalRisk: StatisticalRiskOutput;
  backtest: BacktestMonteCarloReport;
  candles: readonly NormalizedCandle[];
  dataQuality?: string | null;
  freshnessSeconds?: number | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function direction(start: number, end: number) {
  const delta = end - start;
  if (Math.abs(delta) < Math.max(Math.abs(start) * 0.0002, 0.0001)) return "FLAT";
  return delta > 0 ? "UP" : "DOWN";
}

function timeframeAgreement(candles: readonly NormalizedCandle[]): TimeframeAgreement {
  if (candles.length < 60) return "PARTIAL";

  const latest = candles.at(-1)?.close ?? 0;
  const ltf = direction(candles.at(-8)?.close ?? latest, latest);
  const mtf = direction(candles.at(-24)?.close ?? latest, latest);
  const htf = direction(candles.at(-60)?.close ?? latest, latest);
  const directional = [ltf, mtf, htf].filter(item => item !== "FLAT");
  const unique = new Set(directional);

  if (directional.length >= 2 && unique.size === 1) return "ALIGNED";
  if (ltf !== "FLAT" && htf !== "FLAT" && ltf !== htf) return "STRONG_CONFLICT";
  if (unique.size > 1) return "CONFLICT";
  return "PARTIAL";
}

function scoreHorizon(horizon: SignalHorizonName, input: AdaptiveInput, agreement: TimeframeAgreement) {
  const stats = input.signalHorizon.validation.horizons[horizon];
  const backtest = input.backtest.horizons[horizon];
  let score = 0;

  score += stats.score * 0.24;
  score += backtest.signalQuality * 0.3;
  score += Math.max(0, input.statisticalRisk.expectedValue) * 8;
  score += input.statisticalRisk.calibratedConfidence * 0.12;
  score += Math.max(0, 2 - input.statisticalRisk.drawdown.dailyDrawdown / 5) * 6;
  score += Math.max(0, 100 - input.backtest.monteCarlo.probabilityOfRuin * 10) * 0.08;

  if (input.statisticalRisk.volatilityRegime === "SPIKE" || input.statisticalRisk.volatilityRegime === "CHAOS") {
    score -= horizon === "SCALPING" ? 22 : horizon === "SHORT" ? 16 : 10;
  }

  if (input.statisticalRisk.volatilityRegime === "RANGE" && horizon === "LONG") score -= 10;
  if (input.statisticalRisk.volatilityRegime === "TREND" && horizon === "LONG") score += 8;
  if (agreement === "ALIGNED" && horizon !== "SCALPING") score += 8;
  if (agreement === "STRONG_CONFLICT" && horizon !== "SCALPING") score -= 18;
  if (input.market.toLowerCase().includes("boom") || input.market.toLowerCase().includes("crash")) {
    score += horizon === "SHORT" ? 4 : 0;
  }

  return round(clamp(score, 0, 100), 2);
}

function noTradeReasons(input: AdaptiveInput, agreement: TimeframeAgreement) {
  const reasons: string[] = [];
  const risk = input.statisticalRisk;

  if (risk.expectedValue <= 0) reasons.push("EV <= 0");
  if (risk.kellyFraction <= 0) reasons.push("Kelly <= 0");
  if (risk.sharpeRatio < 0.5) reasons.push("Sharpe too weak");
  if (risk.drawdown.dailyDrawdown > 8 || risk.drawdown.maxDrawdown > 12) reasons.push("Drawdown above threshold");
  if (risk.volatilityRegime === "CHAOS") reasons.push("Volatility regime CHAOS");
  if (risk.volatilityRegime === "SPIKE") reasons.push("Volatility spike");
  if (input.dataQuality === "STALE" || input.dataQuality === "DISCONNECTED" || (input.freshnessSeconds ?? 0) > 120) reasons.push("Feed stale");
  if (risk.calibration.status === "UNCALIBRATED" || risk.calibration.status === "DEGRADED") reasons.push("Calibration insufficient");
  if (risk.riskReward < 1.2) reasons.push("Risk/reward insufficient");
  if (agreement === "STRONG_CONFLICT") reasons.push("Strong multi-timeframe conflict");
  if (input.backtest.realReadiness === "NOT_READY" && input.backtest.maxDrawdown > 20) reasons.push("Backtest drawdown too high");

  return reasons;
}

function profitAction(horizon: SignalHorizonName, profitWindowSeconds: number, drawdown: number, noTrade: boolean): AdaptiveRecommendedAction {
  if (noTrade) return "NO_TRADE";
  if (profitWindowSeconds < 60) return "TAKE_PROFIT_QUICKLY";
  if (horizon === "LONG" && drawdown > 5) return "HOLD_CAUTIOUSLY";
  return "TRADE_ALLOWED_SIMULATION";
}

export function selectAdaptiveHorizon(input: AdaptiveInput): AdaptiveHorizonOutput {
  const agreement = timeframeAgreement(input.candles);
  const scores = {
    SCALPING: scoreHorizon("SCALPING", input, agreement),
    SHORT: scoreHorizon("SHORT", input, agreement),
    LONG: scoreHorizon("LONG", input, agreement),
  };
  const selectedHorizon = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? input.fixedHorizon) as SignalHorizonName;
  const selectedStats = input.signalHorizon.validation.horizons[selectedHorizon];
  const selectedBacktest = input.backtest.horizons[selectedHorizon];
  const reasons = noTradeReasons(input, agreement);
  const noTrade = reasons.length > 0;
  const profitWindowSeconds = selectedStats.avgProfitDurationSeconds || selectedBacktest.profitDurationSeconds;
  const validForSeconds = selectedStats.avgPredictionLifeSeconds || selectedBacktest.predictionLifeSeconds;
  const riskMode: AdaptiveRiskMode = noTrade
    ? "NO_TRADE"
    : input.statisticalRisk.drawdown.dailyDrawdown > 5 || input.backtest.maxDrawdown > 8
      ? "DEFENSIVE"
      : input.statisticalRisk.volatilityRegime === "SPIKE" || input.statisticalRisk.volatilityRegime === "CHAOS"
        ? "CAUTION"
        : "NORMAL";
  const confidenceAdjustment =
    agreement === "ALIGNED"
      ? 5
      : agreement === "STRONG_CONFLICT"
        ? -18
        : agreement === "CONFLICT"
          ? -10
          : 0;
  const fixed = input.backtest.horizons[input.fixedHorizon];
  const adaptive = input.backtest.horizons[selectedHorizon];
  const noTradeRate = noTrade ? Math.max(18, input.backtest.noTradeRate + 12) : input.backtest.noTradeRate;

  return {
    selectedHorizon,
    reason: `Selected ${selectedHorizon} from score ${scores[selectedHorizon]} using calibrated confidence, EV, volatility, drawdown, horizon life, backtest quality and Monte Carlo risk.`,
    validForSeconds,
    profitWindowSeconds,
    recommendedAction: profitAction(selectedHorizon, profitWindowSeconds, input.statisticalRisk.drawdown.dailyDrawdown, noTrade),
    noTrade,
    noTradeReason: reasons.length > 0 ? reasons.join(" + ") : null,
    timeframeAgreement: agreement,
    riskMode,
    confidenceAdjustment,
    fixedHorizon: input.fixedHorizon,
    comparison: {
      accuracyBefore: fixed.winrate,
      accuracyAfter: adaptive.winrate,
      noTradeRate: round(noTradeRate, 2),
      drawdownBefore: fixed.maxDrawdown,
      drawdownAfter: adaptive.maxDrawdown,
      pnlBefore: fixed.averagePnl,
      pnlAfter: adaptive.averagePnl,
      recommendedDefault: selectedHorizon,
    },
    liveExecutionAllowed: false,
  };
}
