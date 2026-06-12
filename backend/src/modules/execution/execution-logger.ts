import type { JournalService } from "../journal/journal.service";
import type { ExecutionAttemptEventType, ExecutionAttemptLog, ExecutionOrderStatus, PreparedOrder } from "./execution.types";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class ExecutionLogger {
  private readonly logs: ExecutionAttemptLog[] = [];

  constructor(private readonly journalService?: JournalService) {}

  async log(
    eventType: ExecutionAttemptEventType,
    status: ExecutionOrderStatus,
    message: string,
    order?: PreparedOrder,
    metadata?: Readonly<Record<string, unknown>>
  ): Promise<ExecutionAttemptLog> {
    const event: ExecutionAttemptLog = {
      id: createId("exec-log"),
      timestamp: new Date().toISOString(),
      eventType,
      orderId: order?.id,
      status,
      message,
      metadata,
    };

    this.logs.push(event);

    if (this.journalService && order) {
      await this.journalService.logDecision({
        symbol: order.symbol,
        timeframe: order.timeframe,
        mode: order.strategyMode,
        decision: status === "REFUSED" || status === "FAILED" ? "NO_TRADE" : order.side,
        confidence: order.confidence,
        risk_score: order.risk_score,
        validated_reasons: status === "REFUSED" || status === "FAILED" ? [] : order.reasons,
        rejected_reasons: status === "REFUSED" || status === "FAILED" ? [message] : [],
        entry: order.entry,
        stop_loss: Number.isFinite(order.stop_loss) ? order.stop_loss : null,
        take_profit: Number.isFinite(order.take_profit) ? order.take_profit : null,
        invalidation: order.invalidation,
        RR: order.RR,
        spread: Number.isFinite(order.spread) ? order.spread : null,
        slippage: Number.isFinite(order.slippage) ? order.slippage : null,
        volatility: order.volatility,
        data_source: order.data_source,
        trigger_module: order.trigger_module,
        result: {
          status: status === "EXECUTED" ? "PENDING" : status === "REFUSED" || status === "FAILED" ? "REJECTED" : "PENDING",
          notes: message,
        },
        audit: [
          {
            journalId: "pending",
            eventType:
              status === "REFUSED" || status === "FAILED"
                ? "DECISION_REFUSED"
                : status === "EXECUTED"
                  ? "TRADE_LOGGED"
                  : "DATA_AVAILABLE",
            severity: status === "REFUSED" || status === "FAILED" ? "critical" : "info",
            message,
            availableData: ["execution_order", "risk_validation", "no_trade_validation"],
            metadata,
          },
        ],
      });
    }

    return event;
  }

  list(): readonly ExecutionAttemptLog[] {
    return [...this.logs];
  }
}
