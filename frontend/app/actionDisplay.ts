import type { ActionDisplayMode, SignalDecision } from "./cockpit.types";

export type DerivActionLabel = "UP" | "DOWN" | "WAIT" | "NO_TRADE" | "DATA_LOW" | "INVALID";

export function toDerivAction(decision: SignalDecision): DerivActionLabel {
  if (decision === "BUY") return "UP";
  if (decision === "SELL") return "DOWN";
  return decision;
}

export function displayAction(decision: SignalDecision, mode: ActionDisplayMode) {
  return mode === "deriv" ? toDerivAction(decision) : decision;
}

export function equivalentActionLabel(decision: SignalDecision, mode: ActionDisplayMode) {
  if (mode === "deriv") {
    return {
      label: "Standard equivalent",
      value: decision,
    };
  }

  return {
    label: "Deriv equivalent",
    value: toDerivAction(decision),
  };
}
