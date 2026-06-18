export type TradingMode = "analysis" | "manual" | "semi-auto" | "auto";

export interface ExecutionEngineState {
  readonly enabled: false;
  readonly mode: TradingMode;
  readonly liveExecutionEnabled: false;
  readonly orderPlacementAllowed: false;
  readonly reason: "EXECUTION_DISABLED_BY_DEFAULT";
}

export function parseTradingMode(value: unknown): TradingMode {
  if (typeof value !== "string") return "analysis";
  if (value === "manual" || value === "semi-auto" || value === "auto" || value === "analysis") return value;
  return "analysis";
}

export function executionEngineState(mode: TradingMode): ExecutionEngineState {
  return {
    enabled: false,
    mode,
    liveExecutionEnabled: false,
    orderPlacementAllowed: false,
    reason: "EXECUTION_DISABLED_BY_DEFAULT",
  };
}
