import type { Timeframe } from "../../core/types/timeframe.types";
import type { JournalDataSource, JournalMode, JournalTriggerModule } from "../journal/journal.types";
import type { NoTradeDecision } from "../no-trade/no-trade.types";
import type { RiskValidationResult } from "../risk/risk.types";

export type ExecutionMode = "PAPER" | "DEMO" | "LIVE";

export type ExecutionSide = "BUY" | "SELL";

export type ExecutionOrderType = "MARKET" | "LIMIT" | "STOP";

export type ExecutionOrderStatus =
  | "PREPARED"
  | "REFUSED"
  | "SENT"
  | "EXECUTED"
  | "FAILED"
  | "CANCELLED"
  | "CLOSED"
  | "UPDATED";

export type ExecutionAttemptEventType =
  | "ORDER_PREPARED"
  | "ORDER_REFUSED"
  | "ORDER_SENT"
  | "ORDER_EXECUTED"
  | "ORDER_FAILED"
  | "ORDER_CANCELLED"
  | "POSITION_CLOSED"
  | "POSITION_UPDATED";

export type ExecutionRefusalCode =
  | "LIVE_TRADING_DISABLED"
  | "CONNECTOR_DISCONNECTED"
  | "AUTO_OR_MANUAL_CONFIRMATION_REQUIRED"
  | "EMERGENCY_STOP_ACTIVE"
  | "DUPLICATE_ORDER"
  | "CONFIDENCE_TOO_LOW"
  | "RR_TOO_LOW"
  | "MISSING_STOP_LOSS"
  | "MISSING_TAKE_PROFIT"
  | "MOCK_DATA_FORBIDDEN"
  | "RISK_ENGINE_REFUSED"
  | "NO_TRADE_BLOCKED"
  | "MARTINGALE_FORBIDDEN"
  | "SPREAD_OR_SLIPPAGE_ABNORMAL"
  | "JOURNAL_NOT_READY"
  | "ORDER_NOT_FOUND"
  | "POSITION_NOT_FOUND";

export interface ExecutionRefusal {
  readonly blocked: true;
  readonly reason_code: ExecutionRefusalCode;
  readonly explanation: string;
  readonly severity: "warning" | "critical";
  readonly recommended_action: string;
}

export interface ExecutionConnectorState {
  readonly id: string;
  readonly connected: boolean;
  readonly mode: ExecutionMode;
  readonly label?: string;
}

export interface ExecutionContext {
  readonly mode: ExecutionMode;
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly strategyMode: JournalMode;
  readonly data_source: JournalDataSource;
  readonly trigger_module: JournalTriggerModule;
  readonly connector: ExecutionConnectorState;
  readonly autoModeEnabled: boolean;
  readonly manualConfirmationReceived: boolean;
  readonly emergencyStopActive: boolean;
  readonly journalReady: boolean;
  readonly initialCapital: number;
  readonly currentEquity: number;
  readonly riskPerTradePercent: number;
  readonly openPositionsCount?: number;
}

export interface ExecutionSignalInput {
  readonly side: ExecutionSide;
  readonly confidence: number;
  readonly risk_score: number;
  readonly entry: number;
  readonly stop_loss: number | null;
  readonly take_profit: number | null;
  readonly invalidation?: number | null;
  readonly RR: number | null;
  readonly spread: number | null;
  readonly slippage: number | null;
  readonly volatility: string | number | null;
  readonly reasons: readonly string[];
}

export interface ExecutionOrderIntent {
  readonly context: ExecutionContext;
  readonly signal: ExecutionSignalInput;
  readonly orderType?: ExecutionOrderType;
  readonly clientRequestId?: string;
}

export interface PreparedOrder {
  readonly id: string;
  readonly clientRequestId?: string;
  readonly mode: ExecutionMode;
  readonly status: ExecutionOrderStatus;
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly strategyMode: JournalMode;
  readonly side: ExecutionSide;
  readonly orderType: ExecutionOrderType;
  readonly entry: number;
  readonly stop_loss: number;
  readonly take_profit: number;
  readonly invalidation: number | null;
  readonly RR: number;
  readonly confidence: number;
  readonly risk_score: number;
  readonly spread: number;
  readonly slippage: number;
  readonly volatility: string | number | null;
  readonly data_source: JournalDataSource;
  readonly trigger_module: JournalTriggerModule;
  readonly connectorId: string;
  readonly quantity: number;
  readonly riskAmount: number;
  readonly reasons: readonly string[];
  readonly createdAt: string;
}

export interface ExecutionValidationResult {
  readonly accepted: boolean;
  readonly order: PreparedOrder;
  readonly refusals: readonly ExecutionRefusal[];
  readonly riskValidation: RiskValidationResult;
  readonly noTradeDecision: NoTradeDecision;
}

export interface ExecutionPosition {
  readonly id: string;
  readonly orderId: string;
  readonly symbol: string;
  readonly side: ExecutionSide;
  readonly mode: ExecutionMode;
  readonly quantity: number;
  readonly entry: number;
  readonly stop_loss: number;
  readonly take_profit: number;
  readonly status: "OPEN" | "CLOSED";
  readonly openedAt: string;
  readonly closedAt?: string;
  readonly closePrice?: number;
  readonly realizedPnl?: number;
}

export interface ExecutionAttemptLog {
  readonly id: string;
  readonly timestamp: string;
  readonly eventType: ExecutionAttemptEventType;
  readonly orderId?: string;
  readonly positionId?: string;
  readonly status: ExecutionOrderStatus;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionResult {
  readonly accepted: boolean;
  readonly order: PreparedOrder;
  readonly status: ExecutionOrderStatus;
  readonly position?: ExecutionPosition;
  readonly refusals: readonly ExecutionRefusal[];
  readonly logs: readonly ExecutionAttemptLog[];
}

export interface ClosePositionInput {
  readonly positionId: string;
  readonly closePrice?: number;
  readonly reason: string;
}

export interface UpdatePositionInput {
  readonly positionId: string;
  readonly price: number;
  readonly reason: string;
}
