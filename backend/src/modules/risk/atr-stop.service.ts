import { calculateRR, roundRisk } from "./risk-rules";
import type { ATRStopInput, ATRStopResult } from "./risk.types";

export function calculateATRStop(input: ATRStopInput): ATRStopResult {
  const multiplier = input.multiplier ?? 1.6;
  const minRiskRewardRatio = input.minRiskRewardRatio ?? 2;
  const stopDistance = Math.max(input.atr * multiplier, 0);
  const targetDistance = stopDistance * minRiskRewardRatio;

  if (input.direction === "BUY") {
    const stop_loss = roundRisk(input.entry - stopDistance, 6);
    const take_profit = roundRisk(input.entry + targetDistance, 6);
    const invalidation = roundRisk(input.entry - input.atr, 6);

    return {
      stop_loss,
      take_profit,
      invalidation,
      rr: calculateRR(input.entry, stop_loss, take_profit) ?? 0,
    };
  }

  const stop_loss = roundRisk(input.entry + stopDistance, 6);
  const take_profit = roundRisk(input.entry - targetDistance, 6);
  const invalidation = roundRisk(input.entry + input.atr, 6);

  return {
    stop_loss,
    take_profit,
    invalidation,
    rr: calculateRR(input.entry, stop_loss, take_profit) ?? 0,
  };
}
