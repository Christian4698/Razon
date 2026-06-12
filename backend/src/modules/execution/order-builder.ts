import { calculatePositionSize } from "../risk/position-size.service";
import { roundExecution, rr } from "./execution-rules";
import type { ExecutionOrderIntent, PreparedOrder } from "./execution.types";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function prepareOrder(intent: ExecutionOrderIntent): PreparedOrder {
  const stopLoss = intent.signal.stop_loss;
  const takeProfit = intent.signal.take_profit;
  const fallbackRR =
    typeof stopLoss === "number" && typeof takeProfit === "number"
      ? rr(intent.signal.entry, stopLoss, takeProfit)
      : 0;
  const positionSize =
    typeof stopLoss === "number"
      ? calculatePositionSize({
          equity: intent.context.currentEquity,
          riskPerTradePercent: intent.context.riskPerTradePercent,
          entry: intent.signal.entry,
          stop_loss: stopLoss,
        })
      : null;

  return {
    id: createId("order"),
    clientRequestId: intent.clientRequestId,
    mode: intent.context.mode,
    status: "PREPARED",
    symbol: intent.context.symbol,
    timeframe: intent.context.timeframe,
    strategyMode: intent.context.strategyMode,
    side: intent.signal.side,
    orderType: intent.orderType ?? "MARKET",
    entry: roundExecution(intent.signal.entry),
    stop_loss: typeof stopLoss === "number" ? roundExecution(stopLoss) : Number.NaN,
    take_profit: typeof takeProfit === "number" ? roundExecution(takeProfit) : Number.NaN,
    invalidation: intent.signal.invalidation ?? null,
    RR: intent.signal.RR ?? fallbackRR,
    confidence: intent.signal.confidence,
    risk_score: intent.signal.risk_score,
    spread: intent.signal.spread ?? Number.NaN,
    slippage: intent.signal.slippage ?? Number.NaN,
    volatility: intent.signal.volatility,
    data_source: intent.context.data_source,
    trigger_module: intent.context.trigger_module,
    connectorId: intent.context.connector.id,
    quantity: positionSize?.positionSize ?? 0,
    riskAmount: positionSize?.riskAmount ?? 0,
    reasons: intent.signal.reasons,
    createdAt: new Date().toISOString(),
  };
}
