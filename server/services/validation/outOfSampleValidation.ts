import {
  createSyntheticDerivCandles,
  runBacktestMonteCarlo,
  type BacktestMonteCarloReport,
} from "../backtest/backtestMonteCarloEngine";
import type { NormalizedCandle } from "../market/marketProvider";

export type OverfitRisk = "LOW" | "MEDIUM" | "HIGH" | "OVERFIT";
export type ProductionConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface OutOfSampleSliceMetrics {
  name: "TRAIN" | "VALIDATION" | "TEST";
  totalSignals: number;
  score: number;
  sharpe: number;
  drawdown: number;
  winrate: number;
  expectedValue: number;
  calibrationError: number;
  kelly: number;
  noTradeRate: number;
}

export interface DriftAnalysis {
  performanceDecay: number;
  confidenceDrift: number;
  marketDrift: number;
}

export interface StressScenarioMetrics {
  scenario: "HIGH_VOLATILITY" | "LOW_VOLATILITY" | "BOOM" | "CRASH" | "VOLATILITY" | "STEP" | "JUMP";
  score: number;
  sharpe: number;
  drawdown: number;
  winrate: number;
  noTradeRate: number;
}

export interface OutOfSampleValidationReport {
  generatedAt: string;
  split: {
    train: "60%";
    validation: "20%";
    test: "20%";
    temporalLeakagePrevented: true;
    recalibratedOnTest: false;
  };
  train: OutOfSampleSliceMetrics;
  validation: OutOfSampleSliceMetrics;
  test: OutOfSampleSliceMetrics;
  stress: readonly StressScenarioMetrics[];
  drift: DriftAnalysis;
  trainScore: number;
  validationScore: number;
  testScore: number;
  generalizationGap: number;
  overfitRisk: OverfitRisk;
  productionConfidence: ProductionConfidence;
  realReadiness: "NOT_READY";
  liveExecutionAllowed: false;
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function score(report: BacktestMonteCarloReport) {
  const sharpeScore = clamp((report.sharpe / 1.5) * 35, 0, 35);
  const drawdownScore = clamp((1 - report.maxDrawdown / 8) * 25, 0, 25);
  const evScore = clamp(report.expectedValue * 12, 0, 18);
  const calScore = clamp((1 - report.calibrationError) * 12, 0, 12);
  const disciplineScore = clamp(report.noTradeRate / 55, 0, 1) * 10;
  return Math.round(sharpeScore + drawdownScore + evScore + calScore + disciplineScore);
}

function kellyProxy(report: BacktestMonteCarloReport) {
  const p = report.winrate / 100;
  const b = Math.max(report.averagePnl, 0.01);
  return round(Math.max(0, (b * p - (1 - p)) / b) * 0.25, 4);
}

function metrics(name: OutOfSampleSliceMetrics["name"], report: BacktestMonteCarloReport): OutOfSampleSliceMetrics {
  return {
    name,
    totalSignals: report.totalSignals,
    score: score(report),
    sharpe: report.sharpe,
    drawdown: report.maxDrawdown,
    winrate: report.winrate,
    expectedValue: report.expectedValue,
    calibrationError: report.calibrationError,
    kelly: kellyProxy(report),
    noTradeRate: report.noTradeRate,
  };
}

function sliceCandles(candles: readonly NormalizedCandle[], startRatio: number, endRatio: number) {
  const start = Math.floor(candles.length * startRatio);
  const end = Math.floor(candles.length * endRatio);
  return candles.slice(start, end);
}

function scenarioCandles(scenario: StressScenarioMetrics["scenario"], count = 1800): NormalizedCandle[] {
  const base = createSyntheticDerivCandles(count);
  return base.map((candle, index) => {
    const amp =
      scenario === "HIGH_VOLATILITY" || scenario === "JUMP"
        ? 4
        : scenario === "LOW_VOLATILITY"
          ? 0.35
          : scenario === "CRASH"
            ? -1.4
            : scenario === "STEP"
              ? index % 90 === 0 ? 8 : 0.6
              : scenario === "VOLATILITY"
                ? 1.8
                : 1;
    const drift = scenario === "CRASH" ? -index * 0.08 : scenario === "BOOM" ? index * 0.08 : 0;
    const shock = scenario === "JUMP" && index % 75 === 0 ? 14 : 0;
    const open = candle.open + Math.sin(index / 6) * amp + drift + shock;
    const close = candle.close + Math.cos(index / 8) * amp + drift + shock;
    return {
      ...candle,
      symbol: scenario,
      open,
      close,
      high: Math.max(open, close) + Math.abs(amp),
      low: Math.min(open, close) - Math.abs(amp),
    };
  });
}

function stressMetrics(scenario: StressScenarioMetrics["scenario"]): StressScenarioMetrics {
  const report = runBacktestMonteCarlo({
    market: scenario,
    timeframe: "M1",
    candles: scenarioCandles(scenario),
    simulations: 1000,
    tradeCount: 1000,
    seed: 20260619,
    optimized: true,
  });

  return {
    scenario,
    score: score(report),
    sharpe: report.sharpe,
    drawdown: report.maxDrawdown,
    winrate: report.winrate,
    noTradeRate: report.noTradeRate,
  };
}

export function runOutOfSampleValidation(): OutOfSampleValidationReport {
  const candles = createSyntheticDerivCandles(7200);
  const trainReport = runBacktestMonteCarlo({
    market: "Boom 500 TRAIN",
    timeframe: "M1",
    candles: sliceCandles(candles, 0, 0.6),
    simulations: 1000,
    tradeCount: 1000,
    seed: 1001,
    optimized: true,
  });
  const validationReport = runBacktestMonteCarlo({
    market: "Boom 500 VALIDATION",
    timeframe: "M1",
    candles: sliceCandles(candles, 0.6, 0.8),
    simulations: 1000,
    tradeCount: 1000,
    seed: 2002,
    optimized: true,
  });
  const testReport = runBacktestMonteCarlo({
    market: "Boom 500 TEST",
    timeframe: "M1",
    candles: sliceCandles(candles, 0.8, 1),
    simulations: 1000,
    tradeCount: 1000,
    seed: 3003,
    optimized: true,
  });

  const train = metrics("TRAIN", trainReport);
  const validation = metrics("VALIDATION", validationReport);
  const test = metrics("TEST", testReport);
  const trainScore = train.score;
  const validationScore = validation.score;
  const testScore = test.score;
  const generalizationGap = round(Math.abs(trainScore - testScore), 2);
  const overfitRisk: OverfitRisk =
    generalizationGap > 20 ? "OVERFIT" : generalizationGap > 15 ? "HIGH" : generalizationGap > 10 ? "MEDIUM" : "LOW";
  const stress = (["HIGH_VOLATILITY", "LOW_VOLATILITY", "BOOM", "CRASH", "VOLATILITY", "STEP", "JUMP"] as const).map(stressMetrics);
  const stressAverage = stress.reduce((total, item) => total + item.score, 0) / stress.length;
  const productionConfidence: ProductionConfidence =
    overfitRisk === "LOW" && testScore >= 80 && stressAverage >= 70
      ? "HIGH"
      : overfitRisk === "OVERFIT" || testScore < 55
        ? "LOW"
        : "MEDIUM";

  return {
    generatedAt: new Date().toISOString(),
    split: {
      train: "60%",
      validation: "20%",
      test: "20%",
      temporalLeakagePrevented: true,
      recalibratedOnTest: false,
    },
    train,
    validation,
    test,
    stress,
    drift: {
      performanceDecay: round(trainScore - testScore, 2),
      confidenceDrift: round(train.winrate - test.winrate, 2),
      marketDrift: round(Math.abs(train.expectedValue - test.expectedValue), 4),
    },
    trainScore,
    validationScore,
    testScore,
    generalizationGap,
    overfitRisk,
    productionConfidence,
    realReadiness: "NOT_READY",
    liveExecutionAllowed: false,
  };
}

let cachedOutOfSampleReport: OutOfSampleValidationReport | null = null;

export function getOutOfSampleValidationReport() {
  cachedOutOfSampleReport ??= runOutOfSampleValidation();
  return cachedOutOfSampleReport;
}

export function getProductionConfidenceSummary() {
  const report = getOutOfSampleValidationReport();
  return {
    productionConfidence: report.productionConfidence,
    overfitRisk: report.overfitRisk,
    generalizationGap: report.generalizationGap,
    trainScore: report.trainScore,
    validationScore: report.validationScore,
    testScore: report.testScore,
    realReadiness: report.realReadiness,
  };
}
