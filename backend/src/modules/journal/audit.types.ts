export type AuditEventType =
  | "DECISION_ACCEPTED"
  | "DECISION_REFUSED"
  | "DATA_AVAILABLE"
  | "SCORE_CALCULATED"
  | "RULE_BLOCKED"
  | "TRADE_LOGGED"
  | "BACKTEST_LOGGED"
  | "ERROR_LOGGED";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditTrailEvent {
  readonly id: string;
  readonly journalId: string;
  readonly timestamp: string;
  readonly eventType: AuditEventType;
  readonly severity: AuditSeverity;
  readonly message: string;
  readonly availableData: readonly string[];
  readonly calculatedScore?: number;
  readonly blockingRule?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AuditTrailQuery {
  readonly journalId?: string;
  readonly eventType?: AuditEventType;
  readonly severity?: AuditSeverity;
  readonly from?: string;
  readonly to?: string;
}

export interface CreateAuditEventInput {
  readonly journalId: string;
  readonly eventType: AuditEventType;
  readonly severity?: AuditSeverity;
  readonly message: string;
  readonly availableData?: readonly string[];
  readonly calculatedScore?: number;
  readonly blockingRule?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
