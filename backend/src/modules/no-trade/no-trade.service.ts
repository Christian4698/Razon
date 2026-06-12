import { createRiskService } from "../risk/risk.service";
import { fromRiskBlock, type NoTradeDecision, type NoTradeValidationInput } from "./no-trade.types";
import { evaluateNoTradeRules, explainBlockReason } from "./no-trade-rules";

export class NoTradeService {
  shouldBlockTrade(input: NoTradeValidationInput): NoTradeDecision {
    const riskValidation = input.riskValidation ?? createRiskService().validateRisk(input);
    const directBlocks = evaluateNoTradeRules(input, riskValidation);
    const riskBlocks = riskValidation.blocks.map(fromRiskBlock);
    const blocks = [...directBlocks, ...riskBlocks].filter(
      (block, index, all) => all.findIndex(item => item.reason_code === block.reason_code) === index
    );
    const first = blocks[0];

    return {
      blocked: blocks.length > 0,
      reason_code: first?.reason_code,
      explanation: first?.explanation ?? "Trade is allowed by No-Trade Engine.",
      blocks,
      riskValidation,
    };
  }

  explainBlockReason = explainBlockReason;
}

export function createNoTradeService() {
  return new NoTradeService();
}

export function shouldBlockTrade(input: NoTradeValidationInput): NoTradeDecision {
  return createNoTradeService().shouldBlockTrade(input);
}

export { explainBlockReason };
