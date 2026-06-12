export const FRAPPE_DOLLAR_ANALYSIS_FEATURES = [
  "strongImpulse",
  "candleAcceleration",
  "bosBreak",
  "chochConfirmation",
  "liquiditySweep",
  "probableContinuation",
  "slTpDistanceOk",
  "falseSignalRisk",
  "readableMarket",
] as const;

export const FRAPPE_DOLLAR_SAFETY_RULES = [
  "No trade without SL.",
  "No trade without TP.",
  "No signal when the market is unreadable.",
  "No LIVE auto-execution.",
  "Journal every signal.",
] as const;

export type {
  FrappeDollarAnalysisInput,
  FrappeDollarDirection,
  FrappeDollarSafetyDecision,
  FrappeDollarSignalOutput,
  FrappeDollarSignalType,
  FrappeDollarVisualMarker,
  FrappeDollarVisualMarkerKind,
} from "./frappe-dollar.types";
