import { describe, expect, it } from "vitest";
import { createAiService } from "../src/modules/ai/ai.service";
import type { AiAnalysisInput } from "../src/modules/ai/ai.types";

function sampleInput(): AiAnalysisInput {
  return {
    journal: [
      {
        id: "J-1",
        timestamp: "2026-06-05T10:00:00.000Z",
        symbol: "XAUUSD",
        timeframe: "M15",
        mode: "SHORT_TERM",
        decision: "BUY",
        confidence: 84,
        risk_score: 31,
        reasons: ["liquidity sweep", "trend aligned"],
        rr: 2.4,
        pnl: 120,
        outcome: "WIN",
      },
      {
        id: "J-2",
        timestamp: "2026-06-05T10:20:00.000Z",
        symbol: "XAUUSD",
        timeframe: "M15",
        mode: "SHORT_TERM",
        decision: "BUY",
        confidence: 82,
        risk_score: 34,
        reasons: ["liquidity sweep", "entry score recovery"],
        rr: 2.1,
        pnl: 80,
        outcome: "WIN",
      },
      {
        id: "J-3",
        timestamp: "2026-06-05T11:00:00.000Z",
        symbol: "EURUSD",
        timeframe: "M5",
        mode: "SCALPING",
        decision: "BUY",
        confidence: 88,
        risk_score: 61,
        reasons: ["late momentum entry"],
        rr: 1.7,
        pnl: -60,
        outcome: "LOSS",
      },
      {
        id: "J-4",
        timestamp: "2026-06-05T11:30:00.000Z",
        symbol: "EURUSD",
        timeframe: "M5",
        mode: "SCALPING",
        decision: "SELL",
        confidence: 86,
        risk_score: 66,
        reasons: ["late momentum entry"],
        rr: 1.6,
        pnl: -45,
        outcome: "LOSS",
      },
    ],
    backtests: [
      {
        id: "BT-1",
        symbol: "XAUUSD",
        timeframe: "M15",
        mode: "SHORT_TERM",
        totalTrades: 18,
        winRate: 61,
        lossRate: 39,
        profitFactor: 1.6,
        expectancy: 24,
        maxDrawdown: 4.1,
        averageRR: 2.2,
      },
    ],
    tradeResults: [
      {
        id: "T-1",
        symbol: "XAUUSD",
        timeframe: "M15",
        mode: "SHORT_TERM",
        decision: "BUY",
        confidence: 85,
        risk_score: 30,
        rr: 2.5,
        pnl: 140,
        outcome: "WIN",
        reasons: ["liquidity sweep", "trend aligned"],
      },
      {
        id: "T-2",
        symbol: "EURUSD",
        timeframe: "M5",
        mode: "SCALPING",
        decision: "BUY",
        confidence: 87,
        risk_score: 68,
        rr: 1.5,
        pnl: -55,
        outcome: "LOSS",
        reasons: ["late momentum entry"],
      },
    ],
    noTradeDecisions: [
      {
        id: "N-1",
        symbol: "GBPUSD",
        timeframe: "H1",
        mode: "LONG_TERM",
        confidence: 62,
        risk_score: 70,
        reasons: ["confidence below 80", "spread too high"],
      },
    ],
    kalosMetrics: [
      {
        feature: "liquidity",
        weight: 18,
        averageConfidence: 83,
        winRate: 64,
        sampleSize: 12,
      },
      {
        feature: "momentum",
        weight: 14,
        averageConfidence: 86,
        winRate: 38,
        sampleSize: 9,
      },
    ],
    drawdown: {
      daily: 1.2,
      weekly: 3.4,
      total: 5.7,
    },
    performanceBySymbol: [
      { key: "XAUUSD", totalTrades: 12, winRate: 66, expectancy: 38, maxDrawdown: 3.1 },
      { key: "EURUSD", totalTrades: 8, winRate: 25, expectancy: -28, maxDrawdown: 4.8 },
    ],
    performanceByTimeframe: [
      { key: "M15", totalTrades: 12, winRate: 66, expectancy: 38, maxDrawdown: 3.1 },
      { key: "M5", totalTrades: 8, winRate: 25, expectancy: -28, maxDrawdown: 4.8 },
    ],
    performanceByMode: [
      { key: "SHORT_TERM", totalTrades: 12, winRate: 66, expectancy: 38, maxDrawdown: 3.1 },
      { key: "SCALPING", totalTrades: 8, winRate: 25, expectancy: -28, maxDrawdown: 4.8 },
    ],
  };
}

describe("AiService", () => {
  it("generates explainable recommendations without execution permission", () => {
    const service = createAiService();

    const report = service.analyzeJournal(sampleInput());

    expect(report.disclaimer).toBe("AI advisory only. No execution, no guaranteed gain.");
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations.every(recommendation => recommendation.executionAllowed === false)).toBe(true);
    expect(report.rulesNotToModify).toContain("Risk Engine remains mandatory.");
    expect(report.rulesNotToModify).toContain("No-Trade Engine remains mandatory.");
    expect(report.auditTrail.length).toBeGreaterThanOrEqual(3);
  });

  it("detects winning and losing patterns from journal and trade results", () => {
    const service = createAiService();

    const winning = service.detectWinningPatterns(sampleInput());
    const losing = service.detectLosingPatterns(sampleInput());

    expect(winning.some(pattern => pattern.key === "XAUUSD")).toBe(true);
    expect(losing.some(pattern => pattern.key === "EURUSD")).toBe(true);
  });

  it("suggests score adjustments for review only", () => {
    const service = createAiService();

    const adjustments = service.suggestScoreAdjustments(sampleInput());

    expect(adjustments.length).toBeGreaterThan(0);
    expect(adjustments.every(adjustment => adjustment.autoApply === false)).toBe(true);
    expect(adjustments.every(adjustment => adjustment.safetyNotes.includes("Do not bypass Risk Engine."))).toBe(true);
  });

  it("explains a recommendation with safeguards", () => {
    const service = createAiService();
    const report = service.generateImprovementReport(sampleInput());

    const explanation = service.explainRecommendation(report.recommendations[0]);

    expect(explanation.executionAllowed).toBe(false);
    expect(explanation.safeguards).toContain("Never allow martingale.");
    expect(explanation.summary).toContain("AI advises review only");
  });
});
