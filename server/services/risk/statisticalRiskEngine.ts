import type { NormalizedCandle } from "../market/marketProvider";
import type { RazonSignalDecision } from "../../types/razon";

export type SharpeStatus = "POOR" | "ACCEPTABLE" | "GOOD" | "EXCELLENT";
export type CalibrationStatus = "UNCALIBRATED" | "CALIBRATED" | "DEGRADED";
export type VolatilityRegime = "TREND" | "RANGE" | "CHAOS" | "SPIKE";

export interface DrawdownMetrics {
  currentDrawdown: number;
  maxDrawdown: number;
  dailyDrawdown: number;
  sessionDrawdown: number;
  riskLock: boolean;
}

export interface ProbabilityCalibration {
  announcedConfidence: number;
  calibratedConfidence: number;
  observedWinRate: number | null;
  calibrationError: number | null;
  brierScore: number | null;
  status: CalibrationStatus;
}

export interface VolatilityRisk {
  recentVolatility: number;
  volatilitySpike: boolean;
  spikeRatio: number;
  regime: VolatilityRegime;
  tpMultiplier: number;
  slMultiplier: number;
}

export interface StatisticalRiskOutput {
  action: RazonSignalDecision;
  direction: "UP" | "DOWN" | "WAIT";
  confidence: number;
  calibratedConfidence: number;
  expectedValue: number;
  sharpeRatio: number;
  sharpeStatus: SharpeStatus;
  drawdown: DrawdownMetrics;
  kellyFraction: number;
  recommendedStake: number;
  riskReward: number;
  volatilityRegime: VolatilityRegime;
  volatility: VolatilityRisk;
  calibration: ProbabilityCalibration;
  entryZone: readonly [number, number] | null;
  stopLoss: number | null;
  takeProfit: number | null;
  invalidation: number | null;
  expiry: string | null;
  noTradeReason: string | null;
  sampleSize: number;
  liveExecutionAllowed: false;
}

export interface StatisticalRiskInput {
  decision: RazonSignalDecision;
  confidence: number;
  probability?: number | null;
  entry: number | null;
  entryZone?: readonly [number, number] | null;
  sl: number | null;
  tp: number | null;
  invalidation: number | null;
  expiry?: string | null;
  candles: readonly NormalizedCandle[];
  accountBalance?: number;
  maxStakePercent?: number;
  maxDrawdownPercent?: number;
}

interface SimulatedTrade {
  win: boolean;
  returnR: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function isDirectional(decision: RazonSignalDecision) {
  return decision === "BUY" || decision === "SELL";
}

function directionFor(decision: RazonSignalDecision): "UP" | "DOWN" | "WAIT" {
  if (decision === "BUY") return "UP";
  if (decision === "SELL") return "DOWN";
  return "WAIT";
}

function riskReward(decision: RazonSignalDecision, entry: number | null, tp: number | null, sl: number | null) {
  if (!isDirectional(decision) || entry === null || tp === null || sl === null) return 0;

  const averageGain = Math.abs(tp - entry);
  const averageLoss = Math.abs(entry - sl);
  if (averageLoss <= 0) return 0;

  return averageGain / averageLoss;
}

function calculateSharpe(returns: readonly number[]) {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((total, value) => total + value, 0) / returns.length;
  const variance = returns.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return mean > 0 ? 3 : 0;
  return clamp(mean / stdDev, -5, 5);
}

export function classifySharpe(sharpeRatio: number): SharpeStatus {
  if (sharpeRatio > 2) return "EXCELLENT";
  if (sharpeRatio > 1.5) return "GOOD";
  if (sharpeRatio >= 1) return "ACCEPTABLE";
  return "POOR";
}

export function calculateKellyFraction(p: number, b: number) {
  if (b <= 0) return 0;
  const q = 1 - p;
  return clamp((b * p - q) / b, 0, 1);
}

export function calculateExpectedValue(p: number, averageGain: number, averageLoss: number) {
  return p * averageGain - (1 - p) * averageLoss;
}

export function calculateDrawdownMetrics(returns: readonly number[], maxDrawdownPercent = 12): DrawdownMetrics {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;

  for (const value of returns) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : (peak - equity) / peak);
  }

  const currentDrawdown = peak === 0 ? 0 : (peak - equity) / peak;
  const dailyReturns = returns.slice(-24);
  const sessionReturns = returns.slice(-12);
  const dailyDrawdown = Math.max(0, -dailyReturns.reduce((total, value) => total + value, 0));
  const sessionDrawdown = Math.max(0, -sessionReturns.reduce((total, value) => total + value, 0));

  return {
    currentDrawdown: round(currentDrawdown * 100, 2),
    maxDrawdown: round(maxDrawdown * 100, 2),
    dailyDrawdown: round(dailyDrawdown * 100, 2),
    sessionDrawdown: round(sessionDrawdown * 100, 2),
    riskLock: maxDrawdown * 100 > maxDrawdownPercent,
  };
}

function simulateTrade(
  decision: RazonSignalDecision,
  entry: number,
  gainDistance: number,
  lossDistance: number,
  candles: readonly NormalizedCandle[]
): SimulatedTrade {
  for (const candle of candles) {
    if (decision === "BUY") {
      if (candle.low <= entry - lossDistance) return { win: false, returnR: -1 };
      if (candle.high >= entry + gainDistance) return { win: true, returnR: gainDistance / lossDistance };
    }

    if (decision === "SELL") {
      if (candle.high >= entry + lossDistance) return { win: false, returnR: -1 };
      if (candle.low <= entry - gainDistance) return { win: true, returnR: gainDistance / lossDistance };
    }
  }

  const last = candles.at(-1);
  if (!last) return { win: false, returnR: 0 };

  const rawMove = decision === "BUY" ? last.close - entry : entry - last.close;
  const returnR = clamp(rawMove / lossDistance, -1, gainDistance / lossDistance);
  return { win: returnR > 0, returnR };
}

function simulateTrades(input: StatisticalRiskInput): readonly SimulatedTrade[] {
  if (!isDirectional(input.decision) || input.entry === null || input.tp === null || input.sl === null) return [];

  const gainDistance = Math.abs(input.tp - input.entry);
  const lossDistance = Math.abs(input.entry - input.sl);
  if (gainDistance <= 0 || lossDistance <= 0) return [];

  const maxSamples = 100;
  const forwardWindow = 8;
  const maxStart = Math.max(0, input.candles.length - forwardWindow - 1);
  const indexes = Array.from({ length: maxStart }, (_, index) => index).slice(-maxSamples);

  return indexes.map(index => {
    const entry = input.candles[index]?.close ?? input.entry!;
    return simulateTrade(input.decision, entry, gainDistance, lossDistance, input.candles.slice(index + 1, index + 1 + forwardWindow));
  });
}

function calculateCalibration(confidence: number, trades: readonly SimulatedTrade[]): ProbabilityCalibration {
  const cappedConfidence = clamp(confidence, 0, 95);
  const announced = cappedConfidence / 100;

  if (trades.length < 30) {
    return {
      announcedConfidence: confidence,
      calibratedConfidence: Math.min(cappedConfidence, 75),
      observedWinRate: null,
      calibrationError: null,
      brierScore: null,
      status: "UNCALIBRATED",
    };
  }

  const wins = trades.filter(trade => trade.win).length;
  const observedWinRate = wins / trades.length;
  const calibrationError = Math.abs(announced - observedWinRate);
  const brierScore = trades.reduce((total, trade) => total + Math.pow(announced - (trade.win ? 1 : 0), 2), 0) / trades.length;
  const penalty = calibrationError > 0.2 ? 15 : calibrationError > 0.1 ? 8 : 0;

  return {
    announcedConfidence: confidence,
    calibratedConfidence: clamp(Math.round(cappedConfidence - penalty), 0, 95),
    observedWinRate: round(observedWinRate, 4),
    calibrationError: round(calibrationError, 4),
    brierScore: round(brierScore, 4),
    status: calibrationError > 0.2 ? "DEGRADED" : "CALIBRATED",
  };
}

function candleReturns(candles: readonly NormalizedCandle[]) {
  return candles.slice(1).map((candle, index) => {
    const previous = candles[index];
    if (!previous || previous.close === 0) return 0;
    return (candle.close - previous.close) / previous.close;
  });
}

function calculateVolatility(candles: readonly NormalizedCandle[]): VolatilityRisk {
  const returns = candleReturns(candles).slice(-60);
  const recent = returns.slice(-20);
  const previous = returns.slice(-40, -20);
  const std = (values: readonly number[]) => {
    if (values.length < 2) return 0;
    const mean = values.reduce((total, value) => total + value, 0) / values.length;
    return Math.sqrt(values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / (values.length - 1));
  };
  const recentVolatility = std(recent);
  const previousVolatility = std(previous);
  const spikeRatio = previousVolatility > 0 ? recentVolatility / previousVolatility : 1;
  const volatilitySpike = spikeRatio >= 2.5;
  const netMove = Math.abs((candles.at(-1)?.close ?? 0) - (candles.at(-21)?.close ?? candles.at(0)?.close ?? 0));
  const averagePrice = candles.at(-1)?.close ?? 1;
  const normalizedMove = averagePrice === 0 ? 0 : netMove / averagePrice;
  const regime: VolatilityRegime = volatilitySpike
    ? "SPIKE"
    : recentVolatility > 0.01
      ? "CHAOS"
      : normalizedMove > recentVolatility * 3
        ? "TREND"
        : "RANGE";

  return {
    recentVolatility: round(recentVolatility, 6),
    volatilitySpike,
    spikeRatio: round(spikeRatio, 4),
    regime,
    tpMultiplier: regime === "TREND" ? 1.15 : regime === "RANGE" ? 0.9 : 0.75,
    slMultiplier: regime === "SPIKE" || regime === "CHAOS" ? 1.25 : 1,
  };
}

export function evaluateStatisticalRisk(input: StatisticalRiskInput): StatisticalRiskOutput {
  const trades = simulateTrades(input);
  const returns = trades.map(trade => trade.returnR * 0.01);
  const rr = riskReward(input.decision, input.entry, input.tp, input.sl);
  const calibration = calculateCalibration(input.confidence, trades);
  const p = calibration.observedWinRate ?? clamp((input.probability ?? calibration.calibratedConfidence) / 100, 0, 0.95);
  const averageGain = trades.filter(trade => trade.returnR > 0).reduce((total, trade) => total + trade.returnR, 0) / Math.max(trades.filter(trade => trade.returnR > 0).length, 1);
  const averageLoss = Math.abs(trades.filter(trade => trade.returnR < 0).reduce((total, trade) => total + trade.returnR, 0) / Math.max(trades.filter(trade => trade.returnR < 0).length, 1)) || 1;
  const expectedValue = calculateExpectedValue(p, averageGain || rr, averageLoss);
  const sharpeRatio = calculateSharpe(returns);
  const drawdown = calculateDrawdownMetrics(returns, input.maxDrawdownPercent);
  const kellyRaw = calculateKellyFraction(p, rr);
  const kellyFraction = clamp(kellyRaw * 0.25, 0, 0.25);
  const balance = input.accountBalance ?? 10_000;
  const maxStake = balance * (input.maxStakePercent ?? 0.02);
  const recommendedStake = Math.min(maxStake, balance * kellyFraction);
  const volatility = calculateVolatility(input.candles);
  const reasons: string[] = [];
  let confidence = calibration.calibratedConfidence;

  if (expectedValue <= 0) reasons.push("EXPECTED_VALUE_NON_POSITIVE");
  if (drawdown.dailyDrawdown > 5) confidence = Math.max(0, confidence - 12);
  if (drawdown.dailyDrawdown > 8) reasons.push("DAILY_DRAWDOWN_LIMIT");
  if (drawdown.riskLock) reasons.push("RISK_LOCK_MAX_DRAWDOWN");
  if (sharpeRatio < 1) confidence = Math.max(0, confidence - 10);
  if (sharpeRatio < 0.5) reasons.push("SHARPE_TOO_LOW");
  if (kellyFraction <= 0 && isDirectional(input.decision)) reasons.push("KELLY_NON_POSITIVE");
  if (volatility.regime === "SPIKE") reasons.push("VOLATILITY_SPIKE");
  if (volatility.regime === "CHAOS") confidence = Math.max(0, confidence - 15);

  const blocked = reasons.length > 0 || !isDirectional(input.decision);

  return {
    action: blocked ? "NO_TRADE" : input.decision,
    direction: blocked ? "WAIT" : directionFor(input.decision),
    confidence: clamp(Math.round(confidence), 0, 95),
    calibratedConfidence: calibration.calibratedConfidence,
    expectedValue: round(expectedValue, 4),
    sharpeRatio: round(sharpeRatio, 4),
    sharpeStatus: classifySharpe(sharpeRatio),
    drawdown,
    kellyFraction: round(kellyFraction, 4),
    recommendedStake: round(recommendedStake, 2),
    riskReward: round(rr, 4),
    volatilityRegime: volatility.regime,
    volatility,
    calibration,
    entryZone: input.entryZone ?? null,
    stopLoss: input.sl,
    takeProfit: input.tp,
    invalidation: input.invalidation,
    expiry: input.expiry ?? null,
    noTradeReason: reasons.length > 0 ? reasons.join(" + ") : null,
    sampleSize: trades.length,
    liveExecutionAllowed: false,
  };
}
