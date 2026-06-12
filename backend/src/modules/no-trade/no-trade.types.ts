import type { RiskBlock, RiskReasonCode, RiskValidationInput, RiskValidationResult } from "../risk/risk.types";

export type MarketState = "TREND" | "RANGE" | "NORMAL" | "CHAOTIC" | "NEWS_SENSITIVE";

export type NoTradeReasonCode =
  | "LOW_CONFIDENCE"
  | "RR_BELOW_MINIMUM"
  | "SPREAD_TOO_HIGH"
  | "SLIPPAGE_TOO_HIGH"
  | "ABNORMAL_VOLATILITY"
  | "INSUFFICIENT_DATA"
  | "DRAWDOWN_LIMIT_REACHED"
  | "TOO_MANY_OPEN_POSITIONS"
  | "MARKET_CHAOTIC"
  | "NEWS_EVENT_SHIELD_ACTIVE"
  | "AUTO_MODE_DISABLED"
  | "RISK_ENGINE_REFUSED"
  | RiskReasonCode;

export type NoTradeSeverity = "info" | "warning" | "critical";

export interface NoTradeBlock {
  readonly blocked: true;
  readonly reason_code: NoTradeReasonCode;
  readonly explanation: string;
  readonly severity: NoTradeSeverity;
  readonly recommended_action: string;
}

export interface NoTradeValidationInput extends RiskValidationInput {
  readonly dataSufficient?: boolean;
  readonly marketState?: MarketState;
  readonly newsEventShieldActive?: boolean;
  readonly riskValidation?: RiskValidationResult;
}

export interface NoTradeDecision {
  readonly blocked: boolean;
  readonly reason_code?: NoTradeReasonCode;
  readonly explanation: string;
  readonly blocks: readonly NoTradeBlock[];
  readonly riskValidation: RiskValidationResult;
}

export interface ExplainBlockReasonResult {
  readonly reason_code: NoTradeReasonCode;
  readonly explanation: string;
  readonly severity: NoTradeSeverity;
  readonly recommended_action: string;
}

export function fromRiskBlock(block: RiskBlock): NoTradeBlock {
  return {
    blocked: true,
    reason_code: block.reason_code,
    explanation: block.explanation,
    severity: block.severity,
    recommended_action: block.recommended_action,
  };
}
