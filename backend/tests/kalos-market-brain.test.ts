import { describe, expect, it } from "vitest";
import {
  KALOS_MARKET_BRAIN_NAME,
  interpretKalosMarketBrain,
  type KalosCandle,
  type KalosMarketStructureDetection,
  type KalosSmartMoneyDetection,
} from "../src/modules/kalos";

function candles(count: number, direction: "up" | "down", start = 1.1): KalosCandle[] {
  const step = direction === "up" ? 0.0012 : -0.0012;

  return Array.from({ length: count }, (_, index) => {
    const open = start + index * step;
    const close = open + step * 0.75;
    const high = Math.max(open, close) + 0.00055;
    const low = Math.min(open, close) - 0.00045;

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

const bosDetection: KalosMarketStructureDetection = {
  type: "BOS",
  layer: "LTF",
  timestamp: "2026-01-01T00:59:00.000Z",
  price: 1.172,
  bias: "BULLISH",
  confidence: 88,
  reason: "Mock BOS for market-brain interpretation.",
};

const sweepDetection: KalosSmartMoneyDetection = {
  type: "Liquidity Sweep",
  layer: "LTF",
  timestamp: "2026-01-01T00:58:00.000Z",
  price: 1.166,
  bias: "BULLISH",
  confidence: 82,
  reason: "Mock sweep before continuation.",
};

describe("kalos-market-brain", () => {
  it("generates a probabilistic continuation scenario without enabling execution", () => {
    const output = interpretKalosMarketBrain({
      symbol: "EURUSD",
      candles: candles(60, "up"),
      trend: "BULLISH",
      confidenceHint: 86,
      riskScoreHint: 24,
      sl: 1.164,
      tp: 1.184,
      invalidation: 1.162,
      structureDetections: [bosDetection],
      smartMoneyDetections: [sweepDetection],
    });

    expect(output.module).toBe(KALOS_MARKET_BRAIN_NAME);
    expect(output.scenario).toBe("CONTINUE");
    expect(output.signal).toBe("BUY");
    expect(output.confidence).toBeGreaterThanOrEqual(80);
    expect(output.confidence).toBeLessThanOrEqual(95);
    expect(output.explanation.toLowerCase()).toContain("hypothese");
    expect(output.explanation.toLowerCase()).toContain("confiance");
    expect(output.explanation.toLowerCase()).not.toContain("prix garanti");
    expect(output.liveExecutionAllowed).toBe(false);
    expect(output.expectedPath.length).toBeGreaterThan(0);
  });

  it("cancels interpretation when market data is stale", () => {
    const output = interpretKalosMarketBrain({
      symbol: "EURUSD",
      candles: candles(60, "up"),
      trend: "BULLISH",
      confidenceHint: 90,
      riskScoreHint: 28,
      dataFresh: false,
      sl: 1.164,
      tp: 1.184,
      structureDetections: [bosDetection],
      smartMoneyDetections: [sweepDetection],
    });

    expect(output.scenario).toBe("CANCEL");
    expect(output.signal).toBe("NO_TRADE");
    expect(output.rejectedReasons.some(reason => reason.includes("data is not fresh"))).toBe(true);
    expect(output.confidence).toBeLessThanOrEqual(95);
  });
});
