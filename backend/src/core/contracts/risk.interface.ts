import type { RiskAssessment, RiskLimits, RiskState } from "../types/risk.types";
import type { TradingSignal } from "../types/signal.types";
import type { TradeOrderDraft } from "../types/trade.types";

export interface RiskAssessmentContext {
  readonly signal: TradingSignal;
  readonly order?: TradeOrderDraft;
  readonly limits: RiskLimits;
  readonly state: RiskState;
}

/**
 * Contract for future capital protection checks.
 * No execution layer should bypass this boundary.
 */
export interface RiskEngine {
  readonly assess: (context: RiskAssessmentContext) => Promise<RiskAssessment>;
  readonly getState: () => Promise<RiskState>;
}
