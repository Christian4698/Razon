import { describe, expect, it } from "vitest";
import { KALOS_MAX_CONFIDENCE, createKalosEngine, type KalosCandle } from "../src/modules/kalos";

function candles(count: number, direction: "up" | "down", start = 1.1): KalosCandle[] {
  const step = direction === "up" ? 0.0012 : -0.0012;

  return Array.from({ length: count }, (_, index) => {
    const open = start + index * step;
    const close = open + step * 0.7;
    const high = Math.max(open, close) + 0.0004;
    const low = Math.min(open, close) - 0.0004;

    return {
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      open,
      high,
      low,
      close,
      volume: 1000 + index * 10,
    };
  });
}

const winningHistory = Array.from({ length: 120 }, (_, index) => ({
  signal: "BUY" as const,
  confidence: 95,
  outcome: "WIN" as const,
  mode: "SHORT_TERM" as const,
  createdAt: new Date(Date.UTC(2025, 0, 1, 0, index)).toISOString(),
}));

describe("KalosEngine", () => {
  it("returns BUY with capped confidence and analytical levels only", () => {
    const engine = createKalosEngine();

    const result = engine.evaluate({
      symbol: "EURUSD",
      mode: "SHORT_TERM",
      historicalSamples: winningHistory,
      layers: [
        { layer: "HTF", timeframe: "H1", candles: candles(60, "up") },
        { layer: "MTF", timeframe: "M15", candles: candles(60, "up") },
        { layer: "LTF", timeframe: "M5", candles: candles(60, "up") },
      ],
    });

    expect(result.signal).toBe("BUY");
    expect(result.confidence).toBeLessThanOrEqual(KALOS_MAX_CONFIDENCE);
    expect(result.confidence).toBe(95);
    expect(result.decision).toBe(result.signal);
    expect(result.riskScore).toBe(result.risk_score);
    expect(result.tp).toBeGreaterThan(result.sl ?? 0);
    expect(result.trend).toBe("BULLISH");
    expect(result.overlayObjects.some(item => item.label === "KALOS Signal Ball")).toBe(true);
    expect(result.futurePath.module).toBe("future-path-engine");
    expect(result.futurePath.paths).toHaveLength(3);
    expect(result.futurePath.paths.every(path => path.probability < 100)).toBe(true);
    expect(result.marketReplay.module).toBe("market-replay");
    expect(result.marketReplay.controls).toContain("PLAY");
    expect(result.marketReplay.liveExecutionAllowed).toBe(false);
    expect(result.marketStructureDetections.some(item => item.type === "HH")).toBe(true);
    expect(result.smartMoneyDetections.some(item => item.type === "Buy Side Liquidity")).toBe(true);
    expect(result.disclaimer).toBe("Probability-based analysis only. No real execution.");
    expect("placeOrder" in engine).toBe(false);
  });

  it("returns SELL when HTF, MTF, and LTF align bearish", () => {
    const engine = createKalosEngine();

    const result = engine.evaluate({
      symbol: "EURUSD",
      mode: "LONG_TERM",
      layers: [
        { layer: "HTF", timeframe: "D1", candles: candles(60, "down") },
        { layer: "MTF", timeframe: "H4", candles: candles(60, "down") },
        { layer: "LTF", timeframe: "H1", candles: candles(60, "down") },
      ],
    });

    expect(result.signal).toBe("SELL");
    expect(result.confidence).toBeLessThanOrEqual(KALOS_MAX_CONFIDENCE);
    expect(result.sl).toBeGreaterThan(result.tp ?? 0);
  });

  it("returns WAIT when layers are individually readable but direction conflicts", () => {
    const engine = createKalosEngine();

    const result = engine.evaluate({
      symbol: "EURUSD",
      mode: "SHORT_TERM",
      layers: [
        { layer: "HTF", timeframe: "H1", candles: candles(60, "up") },
        { layer: "MTF", timeframe: "M15", candles: candles(60, "down") },
        { layer: "LTF", timeframe: "M5", candles: candles(60, "up") },
      ],
    });

    expect(result.signal).toBe("WAIT");
    expect(result.tp).toBeNull();
    expect(result.sl).toBeNull();
  });

  it("returns NO_TRADE when a required analysis layer is missing", () => {
    const engine = createKalosEngine();

    const result = engine.evaluate({
      symbol: "EURUSD",
      mode: "SHORT_TERM",
      layers: [
        { layer: "HTF", timeframe: "H1", candles: candles(60, "up") },
        { layer: "MTF", timeframe: "M15", candles: candles(60, "up") },
      ],
    });

    expect(result.signal).toBe("NO_TRADE");
    expect(result.reasons.some(reason => reason.includes("Missing required LTF"))).toBe(true);
    expect(result.rejectedReasons.some(reason => reason.includes("Missing required LTF"))).toBe(true);
    expect(result.confidence).toBeLessThanOrEqual(KALOS_MAX_CONFIDENCE);
  });

  it("blocks executable analysis when fresh data policy is violated", () => {
    const engine = createKalosEngine();

    const result = engine.evaluate({
      symbol: "EURUSD",
      mode: "SCALPING",
      controlMode: "AUTO",
      dataFreshness: {
        checkedAt: new Date(Date.UTC(2026, 0, 2, 0, 0)).toISOString(),
        maxAgeMs: 1_000,
        enforce: true,
      },
      layers: [
        { layer: "HTF", timeframe: "M15", candles: candles(60, "up") },
        { layer: "MTF", timeframe: "M5", candles: candles(60, "up") },
        { layer: "LTF", timeframe: "M1", candles: candles(60, "up") },
      ],
    });

    expect(result.signal).toBe("NO_TRADE");
    expect(result.controlMode).toBe("AUTO");
    expect(result.rejectedReasons.some(reason => reason.includes("not fresh enough"))).toBe(true);
    expect(result.confidence).toBeLessThanOrEqual(KALOS_MAX_CONFIDENCE);
  });
});
