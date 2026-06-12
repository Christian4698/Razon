import { describe, expect, it } from "vitest";
import { buildMarketReplay, KALOS_MARKET_REPLAY_NAME, type KalosCandle } from "../src/modules/kalos";

function candles(): KalosCandle[] {
  return Array.from({ length: 8 }, (_, index) => {
    const open = 1.1 + index * 0.001;
    const close = open + (index % 3 === 1 ? -0.0006 : 0.0008);

    return {
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      open,
      high: Math.max(open, close) + 0.0002,
      low: Math.min(open, close) - 0.0002,
      close,
      volume: 1000 + index,
    };
  });
}

describe("market-replay", () => {
  it("builds replay controls, frame comparison and simulation metrics without execution", () => {
    const replay = buildMarketReplay({
      symbol: "EURUSD",
      timeframe: "M5",
      candles: candles(),
      prediction: "BUY",
      confidence: 84,
      trend: "BULLISH",
      volatility: "NORMAL",
      tp: 1.12,
      sl: 1.09,
      invalidation: 1.088,
      reasons: ["Mock market replay reason."],
      riskScore: 31,
    });

    expect(replay.module).toBe(KALOS_MARKET_REPLAY_NAME);
    expect(replay.controls).toEqual(["PLAY", "REWIND", "FAST_FORWARD", "PAUSE"]);
    expect(replay.frames.length).toBeGreaterThan(0);
    expect(replay.frames[0]?.prediction.signal).toBe("BUY");
    expect(replay.frames[0]?.actualResult.outcome).toMatch(/SIMULATION/);
    expect(replay.frames[0]?.difference.expectedDirection).toBe("UP");
    expect(replay.metrics.winSimulation + replay.metrics.lossSimulation).toBeGreaterThan(0);
    expect(replay.metrics.precision).toBeGreaterThanOrEqual(0);
    expect(replay.metrics.precision).toBeLessThanOrEqual(100);
    expect(replay.liveExecutionAllowed).toBe(false);
    expect(replay.disclaimer).toBe("Replay simulation only. No real execution.");
  });
});
