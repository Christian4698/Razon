import { roundRisk } from "./risk-rules";
import type { PositionSizeInput, PositionSizeResult } from "./risk.types";

export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  const riskAmount = input.equity * (input.riskPerTradePercent / 100);
  const stopDistance = Math.abs(input.entry - input.stop_loss);
  const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const effectiveRiskPercent = input.equity > 0 ? (riskAmount / input.equity) * 100 : 0;

  return {
    riskAmount: roundRisk(riskAmount),
    stopDistance: roundRisk(stopDistance, 8),
    positionSize: roundRisk(positionSize, 6),
    effectiveRiskPercent: roundRisk(effectiveRiskPercent),
  };
}
