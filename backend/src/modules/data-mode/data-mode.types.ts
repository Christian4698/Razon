import type { ControlAuditEvent } from "../audit";

export type DataMode = "REAL_DATA" | "DEMO_DATA";

export type DataModeChangeStatus = "APPLIED" | "BLOCKED";

export interface DataModeState {
  readonly mode: DataMode;
  readonly liveEnabled: boolean;
  readonly executionEnabled: false;
  readonly visibleLabels: readonly string[];
  readonly lastChangedAt: string | null;
}

export interface DataModeSafetyContext {
  readonly liveEnabled: boolean;
  readonly emergencyStopActive: boolean;
  readonly analysisInProgress: boolean;
  readonly tradeInProgress: boolean;
}

export interface DataModeConfirmation {
  readonly stepOneWarningAccepted: boolean;
  readonly stepTwoSafetyAccepted: boolean;
  readonly typedPhrase: string;
}

export interface DataModeChangeRequest {
  readonly actor: string;
  readonly from: DataMode;
  readonly to: DataMode;
  readonly safety: DataModeSafetyContext;
  readonly confirmation: DataModeConfirmation;
}

export interface DataModeChangeResult {
  readonly status: DataModeChangeStatus;
  readonly state: DataModeState;
  readonly reasons: readonly string[];
  readonly auditEvent: ControlAuditEvent;
}
