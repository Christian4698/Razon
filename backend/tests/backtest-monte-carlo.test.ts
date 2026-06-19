import { describe, expect, it } from "vitest";
import {
  createSyntheticDerivCandles,
  runBacktestMonteCarlo,
} from "../../server/services/backtest/backtestMonteCarloEngine";

describe("backtest and Monte Carlo validation", () => {
  it("runs at least 1000 trades and 1000 Monte Carlo simulations with risk-of-ruin metrics", () => {
    const report = runBacktestMonteCarlo({
      market: "Boom 500",
      timeframe: "M1",
      candles: createSyntheticDerivCandles(),
      simulations: 1000,
      tradeCount: 1000,
      seed: 1234,
    });

    expect(report.totalSignals).toBeGreaterThanOrEqual(1000);
    expect(report.monteCarlo.simulations).toBe(1000);
    expect(report.winrate).toBeGreaterThanOrEqual(0);
    expect(report.winrate).toBeLessThanOrEqual(100);
    expect(report.monteCarlo.probabilityOfRuin).toBeGreaterThanOrEqual(0);
    expect(report.monteCarlo.probabilityOfRuin).toBeLessThanOrEqual(100);
    expect(report.monteCarlo.averageEquityCurve.length).toBeGreaterThan(5);
    expect(report.robustnessScore).toBeGreaterThanOrEqual(0);
    expect(report.robustnessScore).toBeLessThanOrEqual(100);
    expect(report.liveExecutionAllowed).toBe(false);
  });

  it("marks real readiness not ready when validation thresholds are not met", () => {
    const report = runBacktestMonteCarlo({
      market: "Boom 500",
      timeframe: "M1",
      candles: createSyntheticDerivCandles(700),
      simulations: 1000,
      tradeCount: 1000,
      seed: 5678,
    });

    expect(report.realReadiness).toBe("NOT_READY");
    expect(report.realReadinessReasons.length).toBeGreaterThan(0);
  });

  it("compares scalping, short and long horizons", () => {
    const report = runBacktestMonteCarlo({
      market: "Boom 500",
      timeframe: "M1",
      candles: createSyntheticDerivCandles(),
      simulations: 1000,
      tradeCount: 1000,
      seed: 9012,
    });

    expect(report.horizons.SCALPING.totalSignals).toBeGreaterThan(0);
    expect(report.horizons.SHORT.totalSignals).toBeGreaterThan(0);
    expect(report.horizons.LONG.totalSignals).toBeGreaterThan(0);
    expect(["SCALPING", "SHORT", "LONG"]).toContain(report.recommendedHorizon);
  });

  it("improves drawdown and Sharpe in optimized demo-stable mode while keeping real locked", () => {
    const candles = createSyntheticDerivCandles();
    const before = runBacktestMonteCarlo({
      market: "Boom 500",
      timeframe: "M1",
      candles,
      simulations: 1000,
      tradeCount: 1000,
      seed: 20260619,
      optimized: false,
    });
    const after = runBacktestMonteCarlo({
      market: "Boom 500",
      timeframe: "M1",
      candles,
      simulations: 1000,
      tradeCount: 1000,
      seed: 20260619,
      optimized: true,
    });

    expect(after.sharpe).toBeGreaterThanOrEqual(1.5);
    expect(after.maxDrawdown).toBeLessThanOrEqual(8);
    expect(after.robustnessScore).toBeGreaterThanOrEqual(80);
    expect(after.noTradeRate).toBeGreaterThan(before.noTradeRate);
    expect(after.realReadiness).toBe("NOT_READY");
    expect(after.optimization?.riskFilterVersion).toBe("v2");
  });
});
