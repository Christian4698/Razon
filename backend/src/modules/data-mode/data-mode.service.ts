import { type ControlAuditService, createControlAuditService } from "../audit";
import type {
  DataMode,
  DataModeChangeRequest,
  DataModeChangeResult,
  DataModeSafetyContext,
  DataModeState,
} from "./data-mode.types";

const REQUIRED_CONFIRMATION = "JE COMPRENDS";

function now() {
  return new Date().toISOString();
}

export function visibleDataModeLabels(mode: DataMode) {
  if (mode === "DEMO_DATA") return ["DEMO_DATA", "DEMO_MODE", "MOCK", "NO REAL IMPACT"] as const;
  return ["REAL_DATA", "BROKER/API DATA", "ANALYSE REELLE", "LIVE OFF = EXECUTION OFF"] as const;
}

export function createDataModeState(mode: DataMode, liveEnabled = false, lastChangedAt: string | null = null): DataModeState {
  return {
    mode,
    liveEnabled,
    executionEnabled: false,
    visibleLabels: visibleDataModeLabels(mode),
    lastChangedAt,
  };
}

function blockingReasons(request: DataModeChangeRequest) {
  const reasons: string[] = [];
  const safety: DataModeSafetyContext = request.safety;

  if (safety.emergencyStopActive) reasons.push("Emergency Stop is active and has priority.");
  if (request.from === request.to) reasons.push("Target data mode is already active.");
  if (safety.analysisInProgress) reasons.push("Data mode change blocked while analysis is in progress.");
  if (safety.tradeInProgress) reasons.push("Data mode change blocked while trade workflow is in progress.");
  if (!request.confirmation.stepOneWarningAccepted) reasons.push("Step 1 warning confirmation is missing.");
  if (!request.confirmation.stepTwoSafetyAccepted) reasons.push("Step 2 safety confirmation is missing.");
  if (request.confirmation.typedPhrase !== REQUIRED_CONFIRMATION) {
    reasons.push("Exact confirmation phrase JE COMPRENDS is required.");
  }

  return reasons;
}

export class DataModeService {
  constructor(private readonly audit: ControlAuditService = createControlAuditService()) {}

  requestChange(request: DataModeChangeRequest): DataModeChangeResult {
    this.audit.log({
      eventType: "DATA_MODE_CHANGE_REQUESTED",
      severity: "warning",
      message: `Data mode change requested from ${request.from} to ${request.to}.`,
      actor: request.actor,
      metadata: {
        from: request.from,
        to: request.to,
        liveEnabled: request.safety.liveEnabled,
      },
    });

    const reasons = blockingReasons(request);
    const blocked = reasons.length > 0;
    const state = createDataModeState(blocked ? request.from : request.to, request.safety.liveEnabled, blocked ? null : now());
    const auditEvent = this.audit.log({
      eventType: blocked ? "DATA_MODE_CHANGE_BLOCKED" : "DATA_MODE_CHANGED",
      severity: blocked ? "critical" : "info",
      message: blocked
        ? `Data mode change blocked from ${request.from} to ${request.to}.`
        : `Data mode changed from ${request.from} to ${request.to}.`,
      actor: request.actor,
      metadata: {
        from: request.from,
        to: request.to,
        executionEnabled: false,
        reasons: reasons.join(" | "),
      },
    });

    return {
      status: blocked ? "BLOCKED" : "APPLIED",
      state,
      reasons,
      auditEvent,
    };
  }

  getAuditTrail() {
    return this.audit.list();
  }
}

export function createDataModeService(audit?: ControlAuditService) {
  return new DataModeService(audit);
}
