import { calculateATRStop } from "./atr-stop.service";
import { validateDrawdown } from "./drawdown.service";
import { calculatePositionSize } from "./position-size.service";
import { calculateRR, createRiskBlock, mergeRiskLimits, roundRisk } from "./risk-rules";
import type {
  ATRStopInput,
  ATRStopResult,
  DrawdownValidationInput,
  DrawdownValidationResult,
  PositionSizeInput,
  PositionSizeResult,
  RiskBlock,
  RiskCalculations,
  RiskOpenPosition,
  RiskValidationInput,
  RiskValidationResult,
} from "./risk.types";

function directionalDecision(decision: RiskValidationInput["decision"]) {
  return decision === "BUY" || decision === "SELL";
}

function totalOpenRiskPercent(openPositions: readonly RiskOpenPosition[], equity: number) {
  if (equity <= 0) return 0;
  const totalRisk = openPositions.reduce((total, position) => total + position.riskAmount, 0);
  return roundRisk((totalRisk / equity) * 100, 4);
}

function exposurePercent(openPositions: readonly RiskOpenPosition[], equity: number) {
  if (equity <= 0) return 0;
  return roundRisk((openPositions.reduce((total, position) => total + position.notional, 0) / equity) * 100, 4);
}

function symbolExposurePercent(symbol: string, openPositions: readonly RiskOpenPosition[], equity: number) {
  if (equity <= 0) return 0;
  const total = openPositions
    .filter(position => position.symbol === symbol)
    .reduce((sum, position) => sum + position.notional, 0);
  return roundRisk((total / equity) * 100, 4);
}

function buildCalculations(input: RiskValidationInput): RiskCalculations {
  const openPositions = input.openPositions ?? [];
  const limits = mergeRiskLimits(input.limits);
  const rr = calculateRR(input.entry, input.stop_loss, input.take_profit);
  const drawdown = validateDrawdown({
    initialCapital: input.initialCapital,
    currentEquity: input.currentEquity,
    equityHistory: input.equityHistory,
    limits,
  });
  const positionSize =
    directionalDecision(input.decision) && typeof input.entry === "number" && typeof input.stop_loss === "number"
      ? calculatePositionSize({
          equity: input.currentEquity,
          riskPerTradePercent: input.riskPerTradePercent,
          entry: input.entry,
          stop_loss: input.stop_loss,
        })
      : null;

  return {
    positionSize,
    riskPerTradeAmount: positionSize?.riskAmount ?? 0,
    totalOpenRiskPercent: totalOpenRiskPercent(openPositions, input.currentEquity),
    rr,
    slValid: !directionalDecision(input.decision) || typeof input.stop_loss === "number",
    tpValid: !directionalDecision(input.decision) || typeof input.take_profit === "number",
    drawdown,
    exposureBySymbolPercent: symbolExposurePercent(input.symbol, openPositions, input.currentEquity),
    totalExposurePercent: exposurePercent(openPositions, input.currentEquity),
    spreadAcceptable: typeof input.spread === "number" && input.spread <= limits.maxSpread,
    slippageAcceptable: typeof input.slippage === "number" && input.slippage <= limits.maxSlippage,
  };
}

function validateRiskBlocks(input: RiskValidationInput, calculations: RiskCalculations): readonly RiskBlock[] {
  const limits = mergeRiskLimits(input.limits);
  const blocks: RiskBlock[] = [...calculations.drawdown.blocks];
  const openPositions = input.openPositions ?? [];

  if (input.martingaleEnabled) {
    blocks.push(
      createRiskBlock(
        "MARTINGALE_FORBIDDEN",
        "Martingale is forbidden by RAZON risk policy.",
        "critical",
        "Disable martingale and use fixed fractional risk."
      )
    );
  }

  if (input.increaseAfterLossEnabled) {
    blocks.push(
      createRiskBlock(
        "AUTO_INCREASE_AFTER_LOSS_FORBIDDEN",
        "Automatic risk increase after a loss is forbidden.",
        "critical",
        "Keep risk stable or reduce risk after losses."
      )
    );
  }

  if (directionalDecision(input.decision) && typeof input.stop_loss !== "number") {
    blocks.push(
      createRiskBlock(
        "MISSING_STOP_LOSS",
        "Directional trade has no stop loss.",
        "critical",
        "Reject the trade until a valid SL exists."
      )
    );
  }

  if (directionalDecision(input.decision) && typeof input.take_profit !== "number") {
    blocks.push(
      createRiskBlock(
        "MISSING_TAKE_PROFIT",
        "Directional trade has no take profit.",
        "warning",
        "Reject the trade until a valid TP exists."
      )
    );
  }

  if (input.intent === "EXECUTION" && !input.journaled) {
    blocks.push(
      createRiskBlock(
        "MISSING_JOURNAL",
        "Execution intent requires prior journalization.",
        "critical",
        "Journal the decision before any execution path."
      )
    );
  }

  if (input.intent === "EXECUTION" && input.data_source === "MOCK") {
    blocks.push(
      createRiskBlock(
        "MOCK_EXECUTION_FORBIDDEN",
        "Execution from MOCK data is forbidden.",
        "critical",
        "Use verified LIVE or DEMO data before execution."
      )
    );
  }

  if (directionalDecision(input.decision) && (calculations.rr === null || calculations.rr < limits.minRiskRewardRatio)) {
    blocks.push(
      createRiskBlock(
        "INVALID_RR",
        `RR ${calculations.rr ?? "unavailable"} is below ${limits.minRiskRewardRatio}.`,
        "critical",
        "Reject the trade or improve entry, SL, or TP."
      )
    );
  }

  if (input.riskPerTradePercent > limits.maxRiskPerTradePercent) {
    blocks.push(
      createRiskBlock(
        "RISK_PER_TRADE_TOO_HIGH",
        `Risk per trade ${input.riskPerTradePercent}% exceeds ${limits.maxRiskPerTradePercent}%.`,
        "critical",
        "Reduce risk per trade."
      )
    );
  }

  if (calculations.totalOpenRiskPercent > limits.maxTotalOpenRiskPercent) {
    blocks.push(
      createRiskBlock(
        "TOTAL_OPEN_RISK_TOO_HIGH",
        `Total open risk ${calculations.totalOpenRiskPercent}% exceeds ${limits.maxTotalOpenRiskPercent}%.`,
        "critical",
        "Close or reduce existing risk before adding exposure."
      )
    );
  }

  if (calculations.exposureBySymbolPercent > limits.maxSymbolExposurePercent) {
    blocks.push(
      createRiskBlock(
        "SYMBOL_EXPOSURE_TOO_HIGH",
        `Symbol exposure ${calculations.exposureBySymbolPercent}% exceeds ${limits.maxSymbolExposurePercent}%.`,
        "critical",
        "Reduce exposure on this symbol."
      )
    );
  }

  if (calculations.totalExposurePercent > limits.maxTotalExposurePercent) {
    blocks.push(
      createRiskBlock(
        "TOTAL_EXPOSURE_TOO_HIGH",
        `Total exposure ${calculations.totalExposurePercent}% exceeds ${limits.maxTotalExposurePercent}%.`,
        "critical",
        "Reduce total portfolio exposure."
      )
    );
  }

  if (!calculations.spreadAcceptable) {
    blocks.push(
      createRiskBlock(
        "SPREAD_TOO_HIGH",
        `Spread ${input.spread ?? "unavailable"} exceeds ${limits.maxSpread}.`,
        "warning",
        "Wait for spread to normalize."
      )
    );
  }

  if (!calculations.slippageAcceptable) {
    blocks.push(
      createRiskBlock(
        "SLIPPAGE_TOO_HIGH",
        `Slippage ${input.slippage ?? "unavailable"} exceeds ${limits.maxSlippage}.`,
        "warning",
        "Wait for execution quality to improve."
      )
    );
  }

  if (directionalDecision(input.decision) && calculations.positionSize && calculations.positionSize.positionSize <= 0) {
    blocks.push(
      createRiskBlock(
        "INVALID_POSITION_SIZE",
        "Position size could not be calculated safely.",
        "critical",
        "Reject the trade and verify entry/SL."
      )
    );
  }

  if (openPositions.length > limits.maxOpenPositions) {
    blocks.push(
      createRiskBlock(
        "TOTAL_OPEN_RISK_TOO_HIGH",
        `Open positions count ${openPositions.length} exceeds ${limits.maxOpenPositions}.`,
        "critical",
        "Do not add new positions until exposure is reduced."
      )
    );
  }

  return blocks;
}

export class RiskService {
  validateRisk(input: RiskValidationInput): RiskValidationResult {
    const calculations = buildCalculations(input);
    const blocks = validateRiskBlocks(input, calculations);

    return {
      accepted: blocks.length === 0,
      blocks,
      calculations,
    };
  }

  calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
    return calculatePositionSize(input);
  }

  calculateATRStop(input: ATRStopInput): ATRStopResult {
    return calculateATRStop(input);
  }

  validateDrawdown(input: DrawdownValidationInput): DrawdownValidationResult {
    return validateDrawdown(input);
  }
}

export function createRiskService() {
  return new RiskService();
}

export function validateRisk(input: RiskValidationInput): RiskValidationResult {
  return createRiskService().validateRisk(input);
}

export { calculatePositionSize, calculateATRStop, validateDrawdown };
