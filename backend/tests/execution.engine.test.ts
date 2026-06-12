import { beforeEach, describe, expect, it } from "vitest";
import { createExecutionService } from "../src/modules/execution/execution.service";
import type { ExecutionOrderIntent } from "../src/modules/execution/execution.types";

function baseIntent(): ExecutionOrderIntent {
  return {
    context: {
      mode: "PAPER",
      symbol: "EURUSD",
      timeframe: "M15",
      strategyMode: "SHORT_TERM",
      data_source: "DEMO",
      trigger_module: "MANUAL",
      connector: {
        id: "paper-connector",
        connected: true,
        mode: "PAPER",
      },
      autoModeEnabled: false,
      manualConfirmationReceived: true,
      emergencyStopActive: false,
      journalReady: true,
      initialCapital: 10000,
      currentEquity: 10000,
      riskPerTradePercent: 1,
    },
    signal: {
      side: "BUY",
      confidence: 88,
      risk_score: 24,
      entry: 1.1,
      stop_loss: 1.095,
      take_profit: 1.11,
      invalidation: 1.097,
      RR: 2,
      spread: 0.0002,
      slippage: 0.00005,
      volatility: "NORMAL",
      reasons: ["KALOS accepted and risk is valid."],
    },
  };
}

describe("Execution Engine", () => {
  beforeEach(() => {
    delete process.env.ENABLE_LIVE_TRADING;
  });

  it("executes a controlled PAPER BUY after all validations pass", async () => {
    const service = createExecutionService();
    const result = await service.executeBuy({
      ...baseIntent(),
      signal: {
        ...baseIntent().signal,
      },
    });

    expect(result.accepted).toBe(true);
    expect(result.status).toBe("EXECUTED");
    expect(result.position?.status).toBe("OPEN");
    expect(result.logs.some(log => log.eventType === "ORDER_PREPARED")).toBe(true);
    expect(result.logs.some(log => log.eventType === "ORDER_SENT")).toBe(true);
    expect(result.logs.some(log => log.eventType === "ORDER_EXECUTED")).toBe(true);
  });

  it("refuses LIVE execution by default", async () => {
    const service = createExecutionService();
    const intent = baseIntent();
    const result = await service.executeBuy({
      ...intent,
      context: {
        ...intent.context,
        mode: "LIVE",
        data_source: "LIVE",
        connector: {
          id: "live-connector",
          connected: true,
          mode: "LIVE",
        },
      },
      signal: {
        ...intent.signal,
      },
    });

    expect(result.accepted).toBe(false);
    expect(result.status).toBe("REFUSED");
    expect(result.refusals.some(refusal => refusal.reason_code === "LIVE_TRADING_DISABLED")).toBe(true);
    expect(result.logs.some(log => log.eventType === "ORDER_REFUSED")).toBe(true);
  });

  it("refuses execution from MOCK data", async () => {
    const service = createExecutionService();
    const intent = baseIntent();
    const result = await service.executeSell({
      ...intent,
      context: {
        ...intent.context,
        data_source: "MOCK",
      },
      signal: {
        ...intent.signal,
        entry: 1.1,
        stop_loss: 1.105,
        take_profit: 1.09,
      },
    });

    expect(result.accepted).toBe(false);
    expect(result.refusals.some(refusal => refusal.reason_code === "MOCK_DATA_FORBIDDEN")).toBe(true);
  });

  it("requires AUTO mode or manual confirmation", async () => {
    const service = createExecutionService();
    const intent = baseIntent();
    const result = await service.executeBuy({
      ...intent,
      context: {
        ...intent.context,
        manualConfirmationReceived: false,
        autoModeEnabled: false,
      },
      signal: {
        ...intent.signal,
      },
    });

    expect(result.accepted).toBe(false);
    expect(result.refusals.some(refusal => refusal.reason_code === "AUTO_OR_MANUAL_CONFIRMATION_REQUIRED")).toBe(true);
  });

  it("blocks duplicate identical orders", async () => {
    const service = createExecutionService();
    const intent = baseIntent();
    const first = await service.executeBuy({
      ...intent,
      signal: {
        ...intent.signal,
      },
    });
    const second = await service.executeBuy({
      ...intent,
      signal: {
        ...intent.signal,
      },
    });

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    expect(second.refusals.some(refusal => refusal.reason_code === "DUPLICATE_ORDER")).toBe(true);
  });

  it("updates and closes PAPER positions without broker execution", async () => {
    const service = createExecutionService();
    const result = await service.executeBuy({
      ...baseIntent(),
      signal: {
        ...baseIntent().signal,
      },
    });
    const positionId = result.position?.id;
    expect(positionId).toBeTruthy();

    const breakEven = await service.moveToBreakEven(positionId ?? "");
    const trailed = await service.applyTrailingStop(positionId ?? "", 1.12, 0.004);
    const closed = await service.closePosition({
      positionId: positionId ?? "",
      closePrice: 1.12,
      reason: "test close",
    });

    expect(breakEven?.stop_loss).toBe(result.position?.entry);
    expect(trailed?.stop_loss).toBeGreaterThan(breakEven?.stop_loss ?? 0);
    expect(closed?.status).toBe("CLOSED");
    expect(closed?.realizedPnl).toBeGreaterThan(0);
  });
});
