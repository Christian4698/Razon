/**
 * Error codes reserved for future controlled execution failures.
 */
export type ExecutionErrorCode =
  | "EXECUTION_DISABLED"
  | "LIVE_TRADING_DISABLED"
  | "RISK_REJECTED"
  | "CONNECTOR_ORDER_UNAVAILABLE"
  | "ORDER_SUBMISSION_FAILED"
  | "POSITION_NOT_FOUND"
  | "EMERGENCY_STOP_ACTIVE";

export interface ExecutionErrorDetails {
  readonly code: ExecutionErrorCode;
  readonly message: string;
  readonly orderId?: string;
  readonly positionId?: string;
}

/**
 * Typed execution error shape for order and position boundaries.
 * Runtime implementations can later map this to HTTP, logs, or exceptions.
 */
export interface ExecutionErrorContract extends ExecutionErrorDetails {
  readonly name: "ExecutionError";
  readonly recoverable: boolean;
}
