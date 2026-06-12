import { createNoTradeService } from "../no-trade/no-trade.service";
import { createRiskService } from "../risk/risk.service";
import { EXECUTION_MIN_CONFIDENCE, EXECUTION_MIN_RR, createExecutionRefusal, liveTradingEnabled } from "./execution-rules";
import type {
  ExecutionContext,
  ExecutionRefusal,
  ExecutionValidationResult,
  PreparedOrder,
} from "./execution.types";

function duplicateOpenOrder(order: PreparedOrder, openOrders: readonly PreparedOrder[]) {
  return openOrders.some(
    item =>
      item.status !== "CANCELLED" &&
      item.status !== "REFUSED" &&
      item.id !== order.id &&
      item.symbol === order.symbol &&
      item.side === order.side &&
      item.entry === order.entry &&
      item.stop_loss === order.stop_loss &&
      item.take_profit === order.take_profit
  );
}

export interface ValidateOrderInput {
  readonly order: PreparedOrder;
  readonly context: ExecutionContext;
  readonly openOrders?: readonly PreparedOrder[];
}

export function validateOrder(input: ValidateOrderInput): ExecutionValidationResult {
  const order = input.order;
  const context = input.context;
  const riskService = createRiskService();
  const riskValidation = riskService.validateRisk({
    symbol: order.symbol,
    timeframe: order.timeframe,
    mode: order.strategyMode,
    decision: order.side,
    confidence: order.confidence,
    risk_score: order.risk_score,
    entry: order.entry,
    stop_loss: Number.isFinite(order.stop_loss) ? order.stop_loss : null,
    take_profit: Number.isFinite(order.take_profit) ? order.take_profit : null,
    initialCapital: context.initialCapital,
    currentEquity: context.currentEquity,
    riskPerTradePercent: context.riskPerTradePercent,
    spread: Number.isFinite(order.spread) ? order.spread : null,
    slippage: Number.isFinite(order.slippage) ? order.slippage : null,
    volatility: order.volatility,
    data_source: order.data_source,
    trigger_module: order.trigger_module,
    intent: "EXECUTION",
    journaled: context.journalReady,
    autoModeEnabled: context.autoModeEnabled,
    martingaleEnabled: false,
    increaseAfterLossEnabled: false,
    openPositions: [],
    equityHistory: [],
  });
  const noTradeDecision = createNoTradeService().shouldBlockTrade({
    symbol: order.symbol,
    timeframe: order.timeframe,
    mode: order.strategyMode,
    decision: order.side,
    confidence: order.confidence,
    risk_score: order.risk_score,
    entry: order.entry,
    stop_loss: Number.isFinite(order.stop_loss) ? order.stop_loss : null,
    take_profit: Number.isFinite(order.take_profit) ? order.take_profit : null,
    initialCapital: context.initialCapital,
    currentEquity: context.currentEquity,
    riskPerTradePercent: context.riskPerTradePercent,
    spread: Number.isFinite(order.spread) ? order.spread : null,
    slippage: Number.isFinite(order.slippage) ? order.slippage : null,
    volatility: order.volatility,
    data_source: order.data_source,
    trigger_module: order.trigger_module,
    intent: "EXECUTION",
    journaled: context.journalReady,
    autoModeEnabled: context.autoModeEnabled,
    riskValidation,
  });
  const refusals: ExecutionRefusal[] = [];

  if (order.mode === "LIVE" && !liveTradingEnabled()) {
    refusals.push(
      createExecutionRefusal(
        "LIVE_TRADING_DISABLED",
        "LIVE mode is disabled. ENABLE_LIVE_TRADING must be true.",
        "critical",
        "Use PAPER/DEMO or explicitly enable live trading in a controlled environment."
      )
    );
  }

  if (!context.connector.connected) {
    refusals.push(
      createExecutionRefusal(
        "CONNECTOR_DISCONNECTED",
        "Execution connector is disconnected.",
        "critical",
        "Connect and health-check the connector before execution."
      )
    );
  }

  if (!context.autoModeEnabled && !context.manualConfirmationReceived) {
    refusals.push(
      createExecutionRefusal(
        "AUTO_OR_MANUAL_CONFIRMATION_REQUIRED",
        "AUTO mode is disabled and manual confirmation was not received.",
        "critical",
        "Enable AUTO deliberately or request manual confirmation."
      )
    );
  }

  if (context.emergencyStopActive) {
    refusals.push(
      createExecutionRefusal(
        "EMERGENCY_STOP_ACTIVE",
        "Emergency Stop is active.",
        "critical",
        "Clear Emergency Stop only after risk review."
      )
    );
  }

  if (!context.journalReady) {
    refusals.push(
      createExecutionRefusal(
        "JOURNAL_NOT_READY",
        "Journalization is not ready.",
        "critical",
        "Ensure Journal Engine is available before execution."
      )
    );
  }

  if (duplicateOpenOrder(order, input.openOrders ?? [])) {
    refusals.push(
      createExecutionRefusal(
        "DUPLICATE_ORDER",
        "An identical active order already exists.",
        "critical",
        "Do not submit duplicate orders."
      )
    );
  }

  if (order.confidence < EXECUTION_MIN_CONFIDENCE) {
    refusals.push(
      createExecutionRefusal(
        "CONFIDENCE_TOO_LOW",
        `Confidence ${order.confidence} is below ${EXECUTION_MIN_CONFIDENCE}.`,
        "critical",
        "Keep the decision as NO_TRADE."
      )
    );
  }

  if (order.RR < EXECUTION_MIN_RR) {
    refusals.push(
      createExecutionRefusal(
        "RR_TOO_LOW",
        `RR ${order.RR} is below 1:2.`,
        "critical",
        "Improve entry, stop loss, or take profit."
      )
    );
  }

  if (!Number.isFinite(order.stop_loss)) {
    refusals.push(
      createExecutionRefusal("MISSING_STOP_LOSS", "Order has no valid stop loss.", "critical", "Reject the order.")
    );
  }

  if (!Number.isFinite(order.take_profit)) {
    refusals.push(
      createExecutionRefusal("MISSING_TAKE_PROFIT", "Order has no valid take profit.", "critical", "Reject the order.")
    );
  }

  if (order.data_source === "MOCK") {
    refusals.push(
      createExecutionRefusal(
        "MOCK_DATA_FORBIDDEN",
        "Execution from MOCK data is forbidden.",
        "critical",
        "Use verified DEMO or LIVE data."
      )
    );
  }

  if (!riskValidation.accepted) {
    refusals.push(
      createExecutionRefusal(
        "RISK_ENGINE_REFUSED",
        "Risk Engine refused the order.",
        "critical",
        "Resolve Risk Engine blocks."
      )
    );
  }

  if (noTradeDecision.blocked) {
    refusals.push(
      createExecutionRefusal(
        "NO_TRADE_BLOCKED",
        noTradeDecision.explanation,
        "critical",
        "Respect NO_TRADE and wait."
      )
    );
  }

  const uniqueRefusals = refusals.filter(
    (refusal, index, all) => all.findIndex(item => item.reason_code === refusal.reason_code) === index
  );

  return {
    accepted: uniqueRefusals.length === 0,
    order,
    refusals: uniqueRefusals,
    riskValidation,
    noTradeDecision,
  };
}
