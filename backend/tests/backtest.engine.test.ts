import { describe, expect, it } from "vitest";
import { calculateMetrics } from "../src/modules/backtesting/backtest.metrics";
import { BacktestService, runBacktest } from "../src/modules/backtesting/backtest.service";
import { runBacktest as runBacktestSync } from "../src/modules/backtesting/backtest.runner";
import type { BacktestCandle, BacktestTrade } from "../src/modules/backtesting/backtest.types";

function trendingCandles(count: number, direction: "up" | "down" = "up"): BacktestCandle[] {
  const start = Date.UTC(2026, 0, 1, 0, 0, 0);
  const step = direction === "up" ? 0.0015 : -0.0015;

  return Array.from({ length: count }, (_, index) => {
    const open = 1.1 + index * step;
    const close = open + step * 0.8;
    const high = Math.max(open, close) + 0.001;
    const low = Math.min(open, close) - 0.001;

    return {
      timestamp: new Date(start + index * 5 * 60_000).toISOString(),
      open,
      high,
      low,
      close,
      volume: 1000 + index,
    };
  });
}

describe("Backtesting Engine", () => {
  it("runs a KALOS backtest with mock data when historical candles are absent", async () => {
    const report = await runBacktest({
      symbol: "EURUSD",
      timeframe: "M15",
      period: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-10T00:00:00.000Z",
      },
      mode: "SHORT_TERM",
      strategy: "KALOS",
      initialCapital: 10000,
      riskPerTradePercent: 1,
      simulatedSpread: 0.0002,
      simulatedSlippage: 0.00005,
    });

    expect(report.accepted).toBe(true);
    expect(report.dataSource).toBe("mock");
    expect(report.dataSourceMessage).toContain("simulated mock candles");
    expect(report.kalosSignals.length).toBeGreaterThan(0);
    expect(report.metrics.totalTrades).toBe(report.trades.length);
    expect(report.disclaimer).toBe("Backtest simulation only. No real execution.");
  });

  it("refuses a backtest when provided historical data is insufficient", () => {
    const result = runBacktestSync({
      symbol: "EURUSD",
      timeframe: "M5",
      period: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-02T00:00:00.000Z",
      },
      mode: "SCALPING",
      strategy: "KALOS",
      initialCapital: 5000,
      riskPerTradePercent: 1,
      simulatedSpread: 0.0002,
      simulatedSlippage: 0.00005,
      candles: trendingCandles(30),
    });

    expect(result.report.accepted).toBe(false);
    expect(result.report.dataSource).toBe("historical");
    expect(result.report.errors.some(error => error.includes("at least 120 candles"))).toBe(true);
    expect(result.report.trades).toEqual([]);
  });

  it("simulates trades and journal entries without exposing execution behavior", () => {
    const result = runBacktestSync({
      symbol: "EURUSD",
      timeframe: "M5",
      period: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-02T00:00:00.000Z",
      },
      mode: "SHORT_TERM",
      strategy: "KALOS",
      initialCapital: 10000,
      riskPerTradePercent: 1,
      simulatedSpread: 0.0002,
      simulatedSlippage: 0.00005,
      candles: trendingCandles(220, "up"),
    });

    expect(result.report.accepted).toBe(true);
    expect(result.report.trades.length).toBeGreaterThan(0);
    expect(result.report.metrics.totalTrades).toBe(result.report.trades.length);
    expect(result.report.journal.some(entry => entry.type === "TRADE_SIMULATED")).toBe(true);
    expect("placeOrder" in result).toBe(false);
  });

  it("calculates mandatory metrics from simulated trades", () => {
    const trades: BacktestTrade[] = [
      {
        id: "t1",
        signalIndex: 1,
        symbol: "EURUSD",
        direction: "BUY",
        entryTime: "2026-01-01T00:00:00.000Z",
        exitTime: "2026-01-01T00:05:00.000Z",
        entryPrice: 1,
        exitPrice: 1.02,
        sl: 0.99,
        tp: 1.02,
        riskAmount: 100,
        positionSize: 10000,
        rr: 2,
        pnl: 200,
        returnPercent: 2,
        exitReason: "TP",
        kalosConfidence: 80,
        kalosReasons: [],
      },
      {
        id: "t2",
        signalIndex: 2,
        symbol: "EURUSD",
        direction: "BUY",
        entryTime: "2026-01-01T00:10:00.000Z",
        exitTime: "2026-01-01T00:15:00.000Z",
        entryPrice: 1,
        exitPrice: 0.99,
        sl: 0.99,
        tp: 1.02,
        riskAmount: 100,
        positionSize: 10000,
        rr: 2,
        pnl: -100,
        returnPercent: -1,
        exitReason: "SL",
        kalosConfidence: 80,
        kalosReasons: [],
      },
    ];

    const metrics = calculateMetrics(trades);

    expect(metrics.totalTrades).toBe(2);
    expect(metrics.winRate).toBe(50);
    expect(metrics.lossRate).toBe(50);
    expect(metrics.profitFactor).toBe(2);
    expect(metrics.expectancy).toBe(50);
    expect(metrics.netProfit).toBe(100);
    expect(metrics.averageWin).toBe(200);
    expect(metrics.averageLoss).toBe(-100);
  });

  it("stores reports through the backtest service repository", async () => {
    const service = new BacktestService();
    const report = await service.runBacktest({
      symbol: "EURUSD",
      timeframe: "M15",
      period: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-08T00:00:00.000Z",
      },
      mode: "LONG_TERM",
      strategy: "KALOS",
      initialCapital: 10000,
      riskPerTradePercent: 1,
      simulatedSpread: 0.0002,
      simulatedSlippage: 0.00005,
    });
    const stored = await service.getReport(report.id);
    const reports = await service.listReports();

    expect(stored?.id).toBe(report.id);
    expect(reports).toHaveLength(1);
  });
});
