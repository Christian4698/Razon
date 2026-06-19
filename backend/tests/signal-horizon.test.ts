import { describe, expect, it } from "vitest";
import { buildSignalHorizon } from "../../server/services/kalos/signalHorizon";
import type { NormalizedCandle } from "../../server/services/market/marketProvider";

function candles(count: number): NormalizedCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const base = 100 + index * 0.18;
    const pullback = index % 7 === 0 ? -0.22 : 0;
    const open = base + pullback;
    const close = open + 0.12;

    return {
      symbol: "Boom 500",
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      open,
      high: Math.max(open, close) + 0.2,
      low: Math.min(open, close) - 0.12,
      close,
      volume: 1000 + index,
      source: "test",
    };
  });
}

describe("signal horizon validation", () => {
  it("validates 100 historical signal windows across scalping, short and long horizons", () => {
    const series = candles(150);
    const generatedAt = series.at(-1)?.timestamp ?? new Date().toISOString();
    const horizon = buildSignalHorizon({
      decision: "BUY",
      generatedAt,
      timeframe: "5m",
      currentPrice: 126.82,
      entryZone: [126.7, 127],
      tp: 128.4,
      sl: 125.7,
      invalidationLevel: 125.55,
      candles: series,
      nowMs: Date.parse(generatedAt) + 45_000,
    });

    expect(horizon.selected).toBe("SHORT");
    expect(horizon.status).toBe("ACTIVE");
    expect(horizon.remainingSeconds).toBeGreaterThan(0);
    expect(horizon.validation.sampleSize).toBe(100);
    expect(horizon.validation.horizons.SCALPING.sampleSize).toBe(100);
    expect(horizon.validation.horizons.SHORT.sampleSize).toBe(100);
    expect(horizon.validation.horizons.LONG.sampleSize).toBe(100);
    expect(horizon.validation.horizons.SCALPING.score).toBeGreaterThanOrEqual(0);
    expect(horizon.validation.horizons.SHORT.score).toBeGreaterThanOrEqual(0);
    expect(horizon.validation.horizons.LONG.score).toBeGreaterThanOrEqual(0);
    expect(["SCALPING", "SHORT", "LONG"]).toContain(horizon.validation.bestHorizon);
    expect(["SCALPING", "SHORT", "LONG"]).toContain(horizon.validation.worstHorizon);
  });
});
