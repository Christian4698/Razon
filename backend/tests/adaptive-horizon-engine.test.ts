import { describe, expect, it } from "vitest";
import { runBacktestMonteCarlo, createSyntheticDerivCandles } from "../../server/services/backtest/backtestMonteCarloEngine";
import { buildSignalHorizon } from "../../server/services/kalos/signalHorizon";
import { evaluateStatisticalRisk } from "../../server/services/risk/statisticalRiskEngine";
import { selectAdaptiveHorizon } from "../../server/services/risk/adaptiveHorizonEngine";
import type { NormalizedCandle } from "../../server/services/market/marketProvider";

function candles(count = 160): NormalizedCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const open = 100 + index * 0.18 + Math.sin(index / 8) * 0.4;
    const close = open + 0.09;
    return {
      symbol: "Boom 500",
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      open,
      high: Math.max(open, close) + 0.2,
      low: Math.min(open, close) - 0.2,
      close,
      volume: 1000 + index,
      source: "test",
    };
  });
}

describe("adaptive horizon engine", () => {
  it("selects a horizon and returns fixed versus adaptive comparison", () => {
    const series = candles();
    const entry = series.at(-1)?.close ?? 128;
    const signalHorizon = buildSignalHorizon({
      decision: "BUY",
      generatedAt: series.at(-1)?.timestamp ?? new Date().toISOString(),
      timeframe: "5m",
      currentPrice: entry,
      entryZone: [entry - 0.1, entry + 0.1],
      tp: entry + 1.6,
      sl: entry - 1,
      invalidationLevel: entry - 1.2,
      candles: series,
    });
    const statisticalRisk = evaluateStatisticalRisk({
      decision: "BUY",
      confidence: 84,
      probability: 78,
      entry,
      entryZone: [entry - 0.1, entry + 0.1],
      tp: entry + 1.6,
      sl: entry - 1,
      invalidation: entry - 1.2,
      candles: series,
    });
    const backtest = runBacktestMonteCarlo({
      market: "Boom 500",
      timeframe: "M1",
      candles: createSyntheticDerivCandles(),
      simulations: 1000,
      tradeCount: 1000,
      seed: 20260619,
    });
    const output = selectAdaptiveHorizon({
      market: "Boom 500",
      fixedHorizon: signalHorizon.selected,
      signalHorizon,
      statisticalRisk,
      backtest,
      candles: series,
      dataQuality: "HEALTHY",
      freshnessSeconds: 2,
    });

    expect(["SCALPING", "SHORT", "LONG"]).toContain(output.selectedHorizon);
    expect(output.reason).toContain("Selected");
    expect(output.validForSeconds).toBeGreaterThanOrEqual(0);
    expect(output.profitWindowSeconds).toBeGreaterThanOrEqual(0);
    expect(output.comparison.accuracyBefore).toBeGreaterThanOrEqual(0);
    expect(output.comparison.accuracyAfter).toBeGreaterThanOrEqual(0);
    expect(output.liveExecutionAllowed).toBe(false);
  });

  it("forces no-trade for stale feed and poor statistical edge", () => {
    const series = candles();
    const entry = series.at(-1)?.close ?? 128;
    const signalHorizon = buildSignalHorizon({
      decision: "SELL",
      generatedAt: series.at(-1)?.timestamp ?? new Date().toISOString(),
      timeframe: "5m",
      currentPrice: entry,
      entryZone: [entry - 0.1, entry + 0.1],
      tp: entry - 0.3,
      sl: entry + 1,
      invalidationLevel: entry + 1.2,
      candles: series,
    });
    const statisticalRisk = evaluateStatisticalRisk({
      decision: "SELL",
      confidence: 60,
      probability: 50,
      entry,
      entryZone: [entry - 0.1, entry + 0.1],
      tp: entry - 0.3,
      sl: entry + 1,
      invalidation: entry + 1.2,
      candles: series,
    });
    const backtest = runBacktestMonteCarlo({
      market: "Boom 500",
      timeframe: "M1",
      candles: createSyntheticDerivCandles(),
      simulations: 1000,
      tradeCount: 1000,
      seed: 20260619,
    });
    const output = selectAdaptiveHorizon({
      market: "Boom 500",
      fixedHorizon: signalHorizon.selected,
      signalHorizon,
      statisticalRisk,
      backtest,
      candles: series,
      dataQuality: "STALE",
      freshnessSeconds: 240,
    });

    expect(output.noTrade).toBe(true);
    expect(output.recommendedAction).toBe("NO_TRADE");
    expect(output.noTradeReason).toContain("Feed stale");
  });
});
