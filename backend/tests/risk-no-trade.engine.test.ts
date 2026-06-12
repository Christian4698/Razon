import { describe, expect, it } from "vitest";
import { runBacktest } from "../src/modules/backtesting/backtest.runner";
import { createNoTradeService } from "../src/modules/no-trade/no-trade.service";
import { createRiskService } from "../src/modules/risk/risk.service";
import type { RiskValidationInput } from "../src/modules/risk/risk.types";

const validRiskInput: RiskValidationInput = {
  symbol: "EURUSD",
  timeframe: "M15",
  mode: "SHORT_TERM",
  decision: "BUY",
  confidence: 88,
  risk_score: 24,
  entry: 1.1,
  stop_loss: 1.095,
  take_profit: 1.11,
  initialCapital: 10000,
  currentEquity: 10000,
  riskPerTradePercent: 1,
  spread: 0.0002,
  slippage: 0.00005,
  volatility: "NORMAL",
  data_source: "DEMO",
  trigger_module: "KALOS",
  intent: "SIGNAL",
  journaled: true,
  autoModeEnabled: false,
  openPositions: [],
  equityHistory: [],
};

describe("Risk Engine + No-Trade Engine", () => {
  it("accepts a valid analytical setup", () => {
    const risk = createRiskService().validateRisk(validRiskInput);
    const noTrade = createNoTradeService().shouldBlockTrade(validRiskInput);

    expect(risk.accepted).toBe(true);
    expect(risk.calculations.positionSize?.riskAmount).toBe(100);
    expect(risk.calculations.rr).toBe(2);
    expect(noTrade.blocked).toBe(false);
  });

  it("rejects directional trades without stop loss", () => {
    const risk = createRiskService().validateRisk({
      ...validRiskInput,
      stop_loss: null,
    });

    expect(risk.accepted).toBe(false);
    expect(risk.blocks.some(block => block.reason_code === "MISSING_STOP_LOSS")).toBe(true);
  });

  it("blocks low confidence as NO_TRADE", () => {
    const noTrade = createNoTradeService().shouldBlockTrade({
      ...validRiskInput,
      confidence: 79,
    });

    expect(noTrade.blocked).toBe(true);
    expect(noTrade.reason_code).toBe("LOW_CONFIDENCE");
    expect(noTrade.blocks[0]).toMatchObject({
      blocked: true,
      severity: "warning",
    });
  });

  it("forbids execution intent from MOCK data and missing journal", () => {
    const noTrade = createNoTradeService().shouldBlockTrade({
      ...validRiskInput,
      data_source: "MOCK",
      intent: "EXECUTION",
      journaled: false,
    });

    expect(noTrade.blocked).toBe(true);
    expect(noTrade.blocks.some(block => block.reason_code === "MOCK_EXECUTION_FORBIDDEN")).toBe(true);
    expect(noTrade.blocks.some(block => block.reason_code === "MISSING_JOURNAL")).toBe(true);
  });

  it("validates drawdown and ATR stop helpers", () => {
    const riskService = createRiskService();
    const drawdown = riskService.validateDrawdown({
      initialCapital: 10000,
      currentEquity: 9600,
      equityHistory: [{ timestamp: new Date().toISOString(), equity: 10000 }],
    });
    const atrStop = riskService.calculateATRStop({
      direction: "BUY",
      entry: 1.1,
      atr: 0.002,
      multiplier: 1.5,
    });

    expect(drawdown.blocks.some(block => block.reason_code === "DAILY_DRAWDOWN_LIMIT")).toBe(true);
    expect(atrStop.stop_loss).toBeLessThan(1.1);
    expect(atrStop.take_profit).toBeGreaterThan(1.1);
    expect(atrStop.rr).toBe(2);
  });

  it("forces backtest directional signals through Risk + No-Trade validation", () => {
    const result = runBacktest({
      symbol: "EURUSD",
      timeframe: "M15",
      period: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-04T00:00:00.000Z",
      },
      mode: "SHORT_TERM",
      strategy: "KALOS",
      initialCapital: 10000,
      riskPerTradePercent: 1,
      simulatedSpread: 0.01,
      simulatedSlippage: 0.00005,
    });

    expect(result.report.accepted).toBe(true);
    expect(result.report.trades).toHaveLength(0);
    expect(
      result.report.noTrade.some(item => item.reasons.some(reason => reason.includes("SPREAD_TOO_HIGH")))
    ).toBe(true);
  });
});
