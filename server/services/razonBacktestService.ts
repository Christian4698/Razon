import type { RazonBacktestState } from "../types/razon";
import {
  createSyntheticDerivCandles,
  runBacktestMonteCarlo,
  type BacktestMonteCarloReport,
} from "./backtest/backtestMonteCarloEngine";
import { getProductionConfidenceSummary } from "./validation/outOfSampleValidation";

let cachedReport: BacktestMonteCarloReport | null = null;

export function getBacktestMonteCarloReport() {
  cachedReport ??= runBacktestMonteCarlo({
    market: "Boom 500",
    timeframe: "M1",
    candles: createSyntheticDerivCandles(),
    simulations: 1000,
    tradeCount: 1000,
    seed: 20260619,
    optimized: true,
  });

  return cachedReport;
}

export function getBacktestMonteCarloSummary() {
  const report = getBacktestMonteCarloReport();

  return {
    backtestScore: report.robustnessScore,
    monteCarloScore: report.monteCarlo.monteCarloScore,
    riskOfRuin: report.monteCarlo.probabilityOfRuin,
    recommendedMode: report.recommendedMode,
    recommendedHorizon: report.recommendedHorizon,
    realReadiness: report.realReadiness,
    realReadinessLabel: report.realReadiness === "READY" ? "REAL READY" : "REAL NOT READY",
    reasons: report.realReadinessReasons,
    totalSignals: report.totalSignals,
    sharpe: report.sharpe,
    maxDrawdown: report.maxDrawdown,
    productionConfidence: getProductionConfidenceSummary(),
  };
}

export const razonBacktestService = {
  getState(): RazonBacktestState {
    const report = getBacktestMonteCarloReport();

    return {
      mode: "backtest",
      status: "validated_simulation",
      verifiedPerformance: false,
      performanceMessage: "No verified performance yet",
      results: report,
      message:
        "Backtest and Monte Carlo validation are available as simulation only. No live execution is enabled.",
    };
  },
};
