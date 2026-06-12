import type { AiAuditRecord } from "./ai.types";

const forbiddenActions = [
  "open_trade",
  "modify_risk_engine",
  "increase_risk_automatically",
  "remove_no_trade_engine",
  "promise_gain",
  "replace_kalos",
];

function now() {
  return new Date().toISOString();
}

export class AiAuditService {
  createAuditRecord(event: string, details: readonly string[]): AiAuditRecord {
    return {
      id: `AI-AUDIT-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      timestamp: now(),
      event,
      details,
      forbiddenActionsChecked: forbiddenActions,
    };
  }

  auditRecommendationSafety() {
    return this.createAuditRecord("SAFETY_GUARDRAILS_CHECKED", [
      "AI output is advisory only.",
      "No broker order API is called.",
      "Risk Engine and No-Trade Engine remain mandatory.",
      "No score adjustment is auto-applied.",
    ]);
  }
}
