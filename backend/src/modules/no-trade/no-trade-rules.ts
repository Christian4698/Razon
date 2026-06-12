import { calculateRR, mergeRiskLimits } from "../risk/risk-rules";
import type { RiskValidationResult } from "../risk/risk.types";
import type {
  ExplainBlockReasonResult,
  NoTradeBlock,
  NoTradeReasonCode,
  NoTradeValidationInput,
} from "./no-trade.types";

const reasonCatalog: Record<NoTradeReasonCode, Omit<ExplainBlockReasonResult, "reason_code">> = {
  LOW_CONFIDENCE: {
    explanation: "Confidence is below the minimum tradable threshold.",
    severity: "warning",
    recommended_action: "Keep the decision as NO_TRADE and wait for stronger alignment.",
  },
  RR_BELOW_MINIMUM: {
    explanation: "Risk/reward ratio is below 1:2.",
    severity: "critical",
    recommended_action: "Improve entry, stop loss, or take profit before considering risk.",
  },
  SPREAD_TOO_HIGH: {
    explanation: "Spread is above the accepted limit.",
    severity: "warning",
    recommended_action: "Wait for spread to normalize.",
  },
  SLIPPAGE_TOO_HIGH: {
    explanation: "Slippage is above the accepted limit.",
    severity: "warning",
    recommended_action: "Wait for better execution quality.",
  },
  ABNORMAL_VOLATILITY: {
    explanation: "Volatility is abnormal for this setup.",
    severity: "warning",
    recommended_action: "Wait for volatility to stabilize.",
  },
  INSUFFICIENT_DATA: {
    explanation: "Available market data is insufficient.",
    severity: "critical",
    recommended_action: "Collect more data before analysis or execution.",
  },
  DRAWDOWN_LIMIT_REACHED: {
    explanation: "Drawdown limit has been reached.",
    severity: "critical",
    recommended_action: "Stop new risk and review performance.",
  },
  TOO_MANY_OPEN_POSITIONS: {
    explanation: "Too many positions are already open.",
    severity: "critical",
    recommended_action: "Reduce open exposure before adding a new trade.",
  },
  MARKET_CHAOTIC: {
    explanation: "Market state is chaotic.",
    severity: "warning",
    recommended_action: "Wait until market structure becomes readable.",
  },
  NEWS_EVENT_SHIELD_ACTIVE: {
    explanation: "News/Event Shield is active.",
    severity: "critical",
    recommended_action: "Wait until event protection expires.",
  },
  AUTO_MODE_DISABLED: {
    explanation: "AUTO mode is disabled.",
    severity: "critical",
    recommended_action: "Enable AUTO deliberately or keep the decision manual.",
  },
  RISK_ENGINE_REFUSED: {
    explanation: "Risk Engine refused the setup.",
    severity: "critical",
    recommended_action: "Resolve all Risk Engine blocks before continuing.",
  },
  MARTINGALE_FORBIDDEN: {
    explanation: "Martingale is forbidden.",
    severity: "critical",
    recommended_action: "Disable martingale.",
  },
  AUTO_INCREASE_AFTER_LOSS_FORBIDDEN: {
    explanation: "Automatic increase after loss is forbidden.",
    severity: "critical",
    recommended_action: "Use stable or reduced risk after losses.",
  },
  MISSING_STOP_LOSS: {
    explanation: "Trade has no stop loss.",
    severity: "critical",
    recommended_action: "Reject the trade until SL exists.",
  },
  MISSING_TAKE_PROFIT: {
    explanation: "Trade has no take profit.",
    severity: "warning",
    recommended_action: "Reject the trade until TP exists.",
  },
  MISSING_JOURNAL: {
    explanation: "Decision has not been journaled.",
    severity: "critical",
    recommended_action: "Journal the decision before any execution path.",
  },
  MOCK_EXECUTION_FORBIDDEN: {
    explanation: "MOCK data cannot be used for execution.",
    severity: "critical",
    recommended_action: "Use verified DEMO or LIVE data for execution.",
  },
  INVALID_RR: {
    explanation: "Risk/reward is invalid.",
    severity: "critical",
    recommended_action: "Reject the setup.",
  },
  RISK_PER_TRADE_TOO_HIGH: {
    explanation: "Risk per trade is too high.",
    severity: "critical",
    recommended_action: "Reduce risk per trade.",
  },
  TOTAL_OPEN_RISK_TOO_HIGH: {
    explanation: "Total open risk is too high.",
    severity: "critical",
    recommended_action: "Reduce open risk.",
  },
  DAILY_DRAWDOWN_LIMIT: {
    explanation: "Daily drawdown limit reached.",
    severity: "critical",
    recommended_action: "Stop trading for the day.",
  },
  WEEKLY_DRAWDOWN_LIMIT: {
    explanation: "Weekly drawdown limit reached.",
    severity: "critical",
    recommended_action: "Pause trading and review.",
  },
  TOTAL_DRAWDOWN_LIMIT: {
    explanation: "Total drawdown limit reached.",
    severity: "critical",
    recommended_action: "Activate capital protection.",
  },
  SYMBOL_EXPOSURE_TOO_HIGH: {
    explanation: "Symbol exposure is too high.",
    severity: "critical",
    recommended_action: "Reduce exposure on this symbol.",
  },
  TOTAL_EXPOSURE_TOO_HIGH: {
    explanation: "Total exposure is too high.",
    severity: "critical",
    recommended_action: "Reduce total exposure.",
  },
  INVALID_POSITION_SIZE: {
    explanation: "Position size is invalid.",
    severity: "critical",
    recommended_action: "Verify entry and stop loss.",
  },
};

export function explainBlockReason(reason_code: NoTradeReasonCode): ExplainBlockReasonResult {
  const fallback = reasonCatalog.RISK_ENGINE_REFUSED;
  const item = reasonCatalog[reason_code] ?? fallback;

  return {
    reason_code,
    ...item,
  };
}

function createBlock(reason_code: NoTradeReasonCode, explanation?: string): NoTradeBlock {
  const base = explainBlockReason(reason_code);

  return {
    blocked: true,
    reason_code,
    explanation: explanation ?? base.explanation,
    severity: base.severity,
    recommended_action: base.recommended_action,
  };
}

function abnormalVolatility(value: string | number | null) {
  if (typeof value === "number") return value >= 1.2;
  if (!value) return false;
  return ["HIGH", "EXTREME", "ABNORMAL", "CHAOTIC"].includes(value.toUpperCase());
}

function drawdownBlocked(riskValidation: RiskValidationResult) {
  return riskValidation.blocks.some(block =>
    ["DAILY_DRAWDOWN_LIMIT", "WEEKLY_DRAWDOWN_LIMIT", "TOTAL_DRAWDOWN_LIMIT"].includes(block.reason_code)
  );
}

export function evaluateNoTradeRules(
  input: NoTradeValidationInput,
  riskValidation: RiskValidationResult
): readonly NoTradeBlock[] {
  const limits = mergeRiskLimits(input.limits);
  const blocks: NoTradeBlock[] = [];
  const rr = calculateRR(input.entry, input.stop_loss, input.take_profit);

  if ((input.decision === "BUY" || input.decision === "SELL") && input.confidence < 80) {
    blocks.push(createBlock("LOW_CONFIDENCE", `Confidence ${input.confidence} is below 80.`));
  }

  if ((input.decision === "BUY" || input.decision === "SELL") && (rr === null || rr < limits.minRiskRewardRatio)) {
    blocks.push(createBlock("RR_BELOW_MINIMUM", `RR ${rr ?? "unavailable"} is below 1:2.`));
  }

  if (typeof input.spread !== "number" || input.spread > limits.maxSpread) {
    blocks.push(createBlock("SPREAD_TOO_HIGH", `Spread ${input.spread ?? "unavailable"} exceeds ${limits.maxSpread}.`));
  }

  if (typeof input.slippage !== "number" || input.slippage > limits.maxSlippage) {
    blocks.push(
      createBlock("SLIPPAGE_TOO_HIGH", `Slippage ${input.slippage ?? "unavailable"} exceeds ${limits.maxSlippage}.`)
    );
  }

  if (abnormalVolatility(input.volatility)) {
    blocks.push(createBlock("ABNORMAL_VOLATILITY"));
  }

  if (input.dataSufficient === false) {
    blocks.push(createBlock("INSUFFICIENT_DATA"));
  }

  if (drawdownBlocked(riskValidation)) {
    blocks.push(createBlock("DRAWDOWN_LIMIT_REACHED"));
  }

  if ((input.openPositions ?? []).length >= limits.maxOpenPositions) {
    blocks.push(
      createBlock(
        "TOO_MANY_OPEN_POSITIONS",
        `Open positions count ${(input.openPositions ?? []).length} reached limit ${limits.maxOpenPositions}.`
      )
    );
  }

  if (input.marketState === "CHAOTIC") {
    blocks.push(createBlock("MARKET_CHAOTIC"));
  }

  if (input.newsEventShieldActive) {
    blocks.push(createBlock("NEWS_EVENT_SHIELD_ACTIVE"));
  }

  if (input.trigger_module === "AUTO" && !input.autoModeEnabled) {
    blocks.push(createBlock("AUTO_MODE_DISABLED"));
  }

  if (!riskValidation.accepted) {
    blocks.push(createBlock("RISK_ENGINE_REFUSED"));
  }

  return blocks;
}
