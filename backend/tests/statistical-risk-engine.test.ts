import { describe, expect, it } from "vitest";
import {
  calculateDrawdownMetrics,
  calculateExpectedValue,
  calculateKellyFraction,
  classifySharpe,
  evaluateStatisticalRisk,
} from "../../server/services/risk/statisticalRiskEngine";
import type { NormalizedCandle } from "../../server/services/market/marketProvider";

function trendingCandles(count: number, direction: "up" | "down", start = 100): NormalizedCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const step = direction === "up" ? 0.42 : -0.42;
    const open = start + index * step;
    const close = open + step * 0.55;

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

describe("statistical risk engine", () => {
  it("calculates expected value, Kelly, Sharpe status and drawdown primitives", () => {
    expect(calculateExpectedValue(0.6, 2, 1)).toBeCloseTo(0.8);
    expect(calculateKellyFraction(0.6, 2)).toBeCloseTo(0.4);
    expect(classifySharpe(2.1)).toBe("EXCELLENT");

    const drawdown = calculateDrawdownMetrics([0.01, 0.01, -0.04, 0.005], 3);
    expect(drawdown.maxDrawdown).toBeGreaterThan(3);
    expect(drawdown.riskLock).toBe(true);
  });

  it("blocks to NO_TRADE when expected value is non-positive", () => {
    const output = evaluateStatisticalRisk({
      decision: "SELL",
      confidence: 80,
      probability: 80,
      entry: 100,
      entryZone: [99.8, 100.2],
      tp: 98,
      sl: 101,
      invalidation: 101.2,
      candles: trendingCandles(140, "up"),
    });

    expect(output.sampleSize).toBe(100);
    expect(output.expectedValue).toBeLessThanOrEqual(0);
    expect(output.action).toBe("NO_TRADE");
    expect(output.noTradeReason).toContain("EXPECTED_VALUE_NON_POSITIVE");
  });

  it("blocks to NO_TRADE when daily drawdown exceeds 8 percent", () => {
    const output = evaluateStatisticalRisk({
      decision: "BUY",
      confidence: 82,
      probability: 82,
      entry: 100,
      entryZone: [99.8, 100.2],
      tp: 102,
      sl: 99,
      invalidation: 98.8,
      candles: trendingCandles(140, "down"),
    });

    expect(output.drawdown.dailyDrawdown).toBeGreaterThan(8);
    expect(output.action).toBe("NO_TRADE");
    expect(output.noTradeReason).toContain("DAILY_DRAWDOWN_LIMIT");
  });

  it("caps confidence at 95 and exposes calibration metrics over 100 simulated signals", () => {
    const output = evaluateStatisticalRisk({
      decision: "BUY",
      confidence: 99,
      probability: 99,
      entry: 100,
      entryZone: [99.8, 100.2],
      tp: 102,
      sl: 99,
      invalidation: 98.8,
      candles: trendingCandles(140, "up"),
    });

    expect(output.sampleSize).toBe(100);
    expect(output.confidence).toBeLessThanOrEqual(95);
    expect(output.calibration.calibratedConfidence).toBeLessThanOrEqual(95);
    expect(output.calibration.calibrationError).not.toBeNull();
    expect(output.calibration.brierScore).not.toBeNull();
    expect(output.kellyFraction).toBeLessThanOrEqual(0.25);
    expect(output.liveExecutionAllowed).toBe(false);
  });
});
