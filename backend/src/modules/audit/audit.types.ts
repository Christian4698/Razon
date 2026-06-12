export type ControlAuditEventType = "DATA_MODE_CHANGE_REQUESTED" | "DATA_MODE_CHANGED" | "DATA_MODE_CHANGE_BLOCKED";

export type ControlAuditSeverity = "info" | "warning" | "critical";

export interface ControlAuditEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly eventType: ControlAuditEventType;
  readonly severity: ControlAuditSeverity;
  readonly message: string;
  readonly actor: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface CreateControlAuditEventInput {
  readonly eventType: ControlAuditEventType;
  readonly severity?: ControlAuditSeverity;
  readonly message: string;
  readonly actor: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}
