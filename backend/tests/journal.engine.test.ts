import { describe, expect, it } from "vitest";
import { runBacktest } from "../src/modules/backtesting/backtest.runner";
import { createJournalService } from "../src/modules/journal/journal.service";

const baseDecision = {
  symbol: "EURUSD",
  timeframe: "M15" as const,
  mode: "SHORT_TERM" as const,
  confidence: 88,
  risk_score: 24,
  validated_reasons: ["HTF and MTF agree.", "Risk is acceptable."],
  rejected_reasons: [],
  entry: 1.1,
  stop_loss: 1.095,
  take_profit: 1.11,
  invalidation: 1.097,
  RR: 2,
  spread: 0.0002,
  slippage: 0.00005,
  volatility: "NORMAL",
  data_source: "MOCK" as const,
  trigger_module: "KALOS" as const,
};

describe("Journal & Audit Engine", () => {
  it("logs a BUY decision with required fields and audit trail", async () => {
    const journal = createJournalService();

    const record = await journal.logDecision({
      ...baseDecision,
      decision: "BUY",
      result: {
        status: "PENDING",
      },
    });

    expect(record.id).toBeTruthy();
    expect(record.date_time).toBeTruthy();
    expect(record.decision).toBe("BUY");
    expect(record.audit_trail.some(event => event.eventType === "DATA_AVAILABLE")).toBe(true);
    expect(record.audit_trail.some(event => event.eventType === "SCORE_CALCULATED")).toBe(true);
    expect(record.audit_trail.some(event => event.eventType === "DECISION_ACCEPTED")).toBe(true);

    const byId = await journal.getDecisionById(record.id);
    expect(byId?.id).toBe(record.id);
  });

  it("logs NO_TRADE as a valid decision with blocking rule", async () => {
    const journal = createJournalService();

    const record = await journal.logNoTrade({
      ...baseDecision,
      confidence: 40,
      risk_score: 82,
      validated_reasons: [],
      rejected_reasons: ["Spread too high."],
      entry: null,
      stop_loss: null,
      take_profit: null,
      invalidation: null,
      RR: null,
    });

    expect(record.type).toBe("NO_TRADE");
    expect(record.decision).toBe("NO_TRADE");
    expect(record.audit_trail.some(event => event.eventType === "DECISION_REFUSED")).toBe(true);
    expect(record.audit_trail.some(event => event.eventType === "RULE_BLOCKED")).toBe(true);
  });

  it("logs errors as auditable NO_TRADE records", async () => {
    const journal = createJournalService();

    const record = await journal.logError({
      symbol: "EURUSD",
      timeframe: "M15",
      mode: "SHORT_TERM",
      trigger_module: "BACKTEST",
      data_source: "MOCK",
      availableData: ["mock_candles"],
      error: {
        code: "BACKTEST_DATA_INSUFFICIENT",
        message: "Backtest refused: data is insufficient.",
        recoverable: true,
      },
    });

    expect(record.type).toBe("ERROR");
    expect(record.error?.code).toBe("BACKTEST_DATA_INSUFFICIENT");
    expect(record.audit_trail.some(event => event.eventType === "ERROR_LOGGED")).toBe(true);
  });

  it("logs backtest KALOS signals without modifying Backtesting Engine", async () => {
    const journal = createJournalService();
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
      simulatedSpread: 0.0002,
      simulatedSlippage: 0.00005,
    });

    const records = await journal.logBacktest({ report: result.report });

    expect(records.length).toBe(result.report.kalosSignals.length);
    expect(records[0]?.trigger_module).toBe("BACKTEST");
    expect(records[0]?.data_source).toBe("MOCK");
    expect(records.some(record => record.audit_trail.some(event => event.eventType === "BACKTEST_LOGGED"))).toBe(true);
  });

  it("returns filtered journal and performance summary", async () => {
    const journal = createJournalService();
    await journal.logDecision({
      ...baseDecision,
      decision: "BUY",
      result: {
        status: "WIN",
        pnl: 120,
      },
    });
    await journal.logDecision({
      ...baseDecision,
      decision: "SELL",
      result: {
        status: "LOSS",
        pnl: -50,
      },
    });
    await journal.logNoTrade({
      ...baseDecision,
      validated_reasons: [],
      rejected_reasons: ["NO_TRADE threshold active."],
      entry: null,
      stop_loss: null,
      take_profit: null,
      invalidation: null,
      RR: null,
    });

    const entries = await journal.getJournal({ symbol: "EURUSD" });
    const summary = await journal.getPerformanceSummary({ symbol: "EURUSD" });

    expect(entries).toHaveLength(3);
    expect(summary.totalDecisions).toBe(3);
    expect(summary.buyCount).toBe(1);
    expect(summary.sellCount).toBe(1);
    expect(summary.noTradeCount).toBe(1);
    expect(summary.netPnl).toBe(70);
    expect(summary.winRate).toBe(50);
  });
});
