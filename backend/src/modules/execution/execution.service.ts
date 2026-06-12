import { createJournalService, type JournalService } from "../journal/journal.service";
import { ExecutionLogger } from "./execution-logger";
import { roundExecution } from "./execution-rules";
import { prepareOrder as buildPreparedOrder } from "./order-builder";
import { validateOrder as validatePreparedOrder } from "./order-validator";
import type {
  ClosePositionInput,
  ExecutionContext,
  ExecutionOrderIntent,
  ExecutionPosition,
  ExecutionResult,
  PreparedOrder,
  UpdatePositionInput,
} from "./execution.types";

export interface ExecutionServiceOptions {
  readonly journalService?: JournalService;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pnl(position: ExecutionPosition, closePrice: number) {
  const raw = position.side === "BUY"
    ? (closePrice - position.entry) * position.quantity
    : (position.entry - closePrice) * position.quantity;
  return roundExecution(raw, 4);
}

export class ExecutionService {
  private readonly orders: PreparedOrder[] = [];
  private readonly positions: ExecutionPosition[] = [];
  private readonly logger: ExecutionLogger;

  constructor(options: ExecutionServiceOptions = {}) {
    this.logger = new ExecutionLogger(options.journalService ?? createJournalService());
  }

  async prepareOrder(intent: ExecutionOrderIntent): Promise<PreparedOrder> {
    const order = buildPreparedOrder(intent);
    this.orders.push(order);
    await this.logger.log("ORDER_PREPARED", "PREPARED", `Order ${order.side} prepared for ${order.symbol}.`, order);
    return order;
  }

  validateOrder(order: PreparedOrder, context: ExecutionContext) {
    return validatePreparedOrder({
      order,
      context,
      openOrders: this.orders,
    });
  }

  async executeBuy(intent: Omit<ExecutionOrderIntent, "signal"> & { readonly signal: Omit<ExecutionOrderIntent["signal"], "side"> }): Promise<ExecutionResult> {
    return this.execute({
      ...intent,
      signal: {
        ...intent.signal,
        side: "BUY",
      },
    });
  }

  async executeSell(intent: Omit<ExecutionOrderIntent, "signal"> & { readonly signal: Omit<ExecutionOrderIntent["signal"], "side"> }): Promise<ExecutionResult> {
    return this.execute({
      ...intent,
      signal: {
        ...intent.signal,
        side: "SELL",
      },
    });
  }

  async closePosition(input: ClosePositionInput): Promise<ExecutionPosition | null> {
    const position = this.positions.find(item => item.id === input.positionId && item.status === "OPEN");
    if (!position) return null;

    const closePrice = input.closePrice ?? position.entry;
    const updated: ExecutionPosition = {
      ...position,
      status: "CLOSED",
      closedAt: new Date().toISOString(),
      closePrice,
      realizedPnl: pnl(position, closePrice),
    };
    this.replacePosition(updated);
    await this.logger.log("POSITION_CLOSED", "CLOSED", `Position ${position.id} closed: ${input.reason}.`, undefined, {
      position: updated,
    });
    return updated;
  }

  async closeAllPositions(reason = "closeAllPositions requested"): Promise<readonly ExecutionPosition[]> {
    const open = this.positions.filter(position => position.status === "OPEN");
    const closed: ExecutionPosition[] = [];

    for (const position of open) {
      const item = await this.closePosition({ positionId: position.id, closePrice: position.entry, reason });
      if (item) closed.push(item);
    }

    return closed;
  }

  async moveToBreakEven(positionId: string): Promise<ExecutionPosition | null> {
    const position = this.positions.find(item => item.id === positionId && item.status === "OPEN");
    if (!position) return null;
    return this.updateStopLoss({
      positionId,
      price: position.entry,
      reason: "moveToBreakEven requested",
    });
  }

  async updateStopLoss(input: UpdatePositionInput): Promise<ExecutionPosition | null> {
    const position = this.positions.find(item => item.id === input.positionId && item.status === "OPEN");
    if (!position) return null;
    const updated = {
      ...position,
      stop_loss: input.price,
    };
    this.replacePosition(updated);
    await this.logger.log("POSITION_UPDATED", "UPDATED", `Stop loss updated: ${input.reason}.`, undefined, {
      position: updated,
    });
    return updated;
  }

  async updateTakeProfit(input: UpdatePositionInput): Promise<ExecutionPosition | null> {
    const position = this.positions.find(item => item.id === input.positionId && item.status === "OPEN");
    if (!position) return null;
    const updated = {
      ...position,
      take_profit: input.price,
    };
    this.replacePosition(updated);
    await this.logger.log("POSITION_UPDATED", "UPDATED", `Take profit updated: ${input.reason}.`, undefined, {
      position: updated,
    });
    return updated;
  }

  async applyTrailingStop(positionId: string, currentPrice: number, distance: number): Promise<ExecutionPosition | null> {
    const position = this.positions.find(item => item.id === positionId && item.status === "OPEN");
    if (!position || distance <= 0) return null;
    const proposedStop = position.side === "BUY" ? currentPrice - distance : currentPrice + distance;
    const shouldUpdate =
      position.side === "BUY" ? proposedStop > position.stop_loss : proposedStop < position.stop_loss;

    if (!shouldUpdate) return position;

    return this.updateStopLoss({
      positionId,
      price: roundExecution(proposedStop),
      reason: "trailing stop applied",
    });
  }

  async cancelOrder(orderId: string): Promise<PreparedOrder | null> {
    const order = this.orders.find(item => item.id === orderId);
    if (!order || order.status === "EXECUTED") return null;
    const cancelled: PreparedOrder = {
      ...order,
      status: "CANCELLED",
    };
    this.replaceOrder(cancelled);
    await this.logger.log("ORDER_CANCELLED", "CANCELLED", `Order ${orderId} cancelled.`, cancelled);
    return cancelled;
  }

  listOrders(): readonly PreparedOrder[] {
    return [...this.orders];
  }

  listPositions(): readonly ExecutionPosition[] {
    return [...this.positions];
  }

  listLogs() {
    return this.logger.list();
  }

  private async execute(intent: ExecutionOrderIntent): Promise<ExecutionResult> {
    const order = await this.prepareOrder(intent);
    const validation = this.validateOrder(order, intent.context);

    if (!validation.accepted) {
      const refused: PreparedOrder = { ...order, status: "REFUSED" };
      this.replaceOrder(refused);
      await this.logger.log(
        "ORDER_REFUSED",
        "REFUSED",
        validation.refusals.map(item => `${item.reason_code}: ${item.explanation}`).join(" | "),
        refused,
        { refusals: validation.refusals }
      );
      return {
        accepted: false,
        order: refused,
        status: "REFUSED",
        refusals: validation.refusals,
        logs: this.logger.list(),
      };
    }

    const sent: PreparedOrder = { ...order, status: "SENT" };
    this.replaceOrder(sent);
    await this.logger.log("ORDER_SENT", "SENT", `Order ${order.id} sent in ${order.mode} mode.`, sent);

    const executed: PreparedOrder = { ...sent, status: "EXECUTED" };
    const position: ExecutionPosition = {
      id: createId("position"),
      orderId: executed.id,
      symbol: executed.symbol,
      side: executed.side,
      mode: executed.mode,
      quantity: executed.quantity,
      entry: executed.entry,
      stop_loss: executed.stop_loss,
      take_profit: executed.take_profit,
      status: "OPEN",
      openedAt: new Date().toISOString(),
    };

    this.replaceOrder(executed);
    this.positions.push(position);
    await this.logger.log("ORDER_EXECUTED", "EXECUTED", `Order ${executed.id} executed in ${executed.mode} mode.`, executed, {
      position,
    });

    return {
      accepted: true,
      order: executed,
      status: "EXECUTED",
      position,
      refusals: [],
      logs: this.logger.list(),
    };
  }

  private replaceOrder(order: PreparedOrder) {
    const index = this.orders.findIndex(item => item.id === order.id);
    if (index >= 0) this.orders[index] = order;
  }

  private replacePosition(position: ExecutionPosition) {
    const index = this.positions.findIndex(item => item.id === position.id);
    if (index >= 0) this.positions[index] = position;
  }
}

export function createExecutionService(options?: ExecutionServiceOptions) {
  return new ExecutionService(options);
}

export const prepareOrder = buildPreparedOrder;
export const validateOrder = validatePreparedOrder;
