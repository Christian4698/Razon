import type { ExecutionRefusal, ExecutionRefusalCode } from "./execution.types";

export const EXECUTION_MIN_CONFIDENCE = 80;

export const EXECUTION_MIN_RR = 2;

export function liveTradingEnabled() {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env?.ENABLE_LIVE_TRADING === "true";
}

export function createExecutionRefusal(
  reason_code: ExecutionRefusalCode,
  explanation: string,
  severity: "warning" | "critical",
  recommended_action: string
): ExecutionRefusal {
  return {
    blocked: true,
    reason_code,
    explanation,
    severity,
    recommended_action,
  };
}

export function roundExecution(value: number, decimals = 6) {
  return Number(value.toFixed(decimals));
}

export function rr(entry: number, stopLoss: number, takeProfit: number) {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  if (risk <= 0 || reward <= 0) return 0;
  return roundExecution(reward / risk, 4);
}
