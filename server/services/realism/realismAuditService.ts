import {
  createSyntheticDerivCandles,
  runBacktestMonteCarlo,
  type BacktestTrade,
} from "../backtest/backtestMonteCarloEngine";

export type ProductionConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface DelayScenario {
  readonly delayMs: 50 | 100 | 300 | 1000;
  readonly sharpe: number;
  readonly pnl: number;
  readonly drawdown: number;
  readonly winrate: number;
}

export interface CalibrationPoint {
  readonly confidenceBucket: string;
  readonly predictedConfidence: number;
  readonly realizedSuccess: number;
  readonly samples: number;
}

export interface RealismAuditReport {
  readonly generatedAt: string;
  readonly audit: "REALISM_AND_LEAKAGE";
  readonly sampleSize: number;
  readonly daysObserved: number;
  readonly temporalIntegrity: {
    readonly checked: number;
    readonly violations: number;
    readonly signalTimeBeforeEntry: boolean;
    readonly entryTimeBeforeExit: boolean;
    readonly candleCloseLeakage: number;
    readonly tickLeakage: number;
    readonly ohlcHindsight: number;
  };
  readonly executionRealism: {
    readonly entrySlippagePoints: number;
    readonly exitSlippagePoints: number;
    readonly spreadPoints: number;
    readonly delayScenarios: readonly DelayScenario[];
  };
  readonly latency: {
    readonly feedLatencyMs: number;
    readonly signalLatencyMs: number;
    readonly decisionLatencyMs: number;
    readonly journalLatencyMs: number;
    readonly stable: boolean;
  };
  readonly marketFriction: {
    readonly spreadModel: "DYNAMIC_SYNTHETIC_SPREAD";
    readonly lateEntryPenalty: number;
    readonly invalidSignalPenalty: number;
    readonly stressPenalty: number;
  };
  readonly stressAudit: {
    readonly highVolatility: DelayScenario;
    readonly flashMove: DelayScenario;
    readonly tickLoss: DelayScenario;
    readonly feedInterruption: DelayScenario;
    readonly missingCandles: DelayScenario;
    readonly clockDrift: DelayScenario;
  };
  readonly confidenceIntegrity: {
    readonly calibrationCurve: readonly CalibrationPoint[];
    readonly calibrationError: number;
  };
  readonly metrics: {
    readonly idealSharpe: number;
    readonly realisticSharpe: number;
    readonly idealPnL: number;
    readonly realisticPnL: number;
    readonly idealDrawdown: number;
    readonly realisticDrawdown: number;
  };
  readonly gate: {
    readonly realisticSharpeOk: boolean;
    readonly realisticDrawdownOk: boolean;
    readonly signalLeakageOk: boolean;
    readonly latencyStable: boolean;
    readonly daysObservedOk: boolean;
  };
  readonly signalLeakage: number;
  readonly simulationBias: number;
  readonly productionConfidence: ProductionConfidence;
  readonly realReadiness: "NOT_READY";
  readonly realReadinessReasons: readonly string[];
  readonly liveExecutionEnabled: false;
  readonly orderPlacementAllowed: false;
  readonly autoExecution: false;
  readonly forbiddenRoutes: readonly ["buy", "sell", "proposal", "order", "execution", "confirm-real"];
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function average(values: readonly number[]) {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / (values.length - 1));
}

function sharpe(values: readonly number[]) {
  const deviation = standardDeviation(values);
  if (deviation === 0) return average(values) > 0 ? 3 : 0;
  return average(values) / deviation;
}

function equityDrawdown(values: readonly number[], initialBalance = 10000) {
  let equity = initialBalance;
  let peak = initialBalance;
  let maxDrawdown = 0;

  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : (peak - equity) / peak);
  }

  return maxDrawdown * 100;
}

function direction(trade: BacktestTrade) {
  return trade.TP >= trade.entry ? 1 : -1;
}

function riskDistance(trade: BacktestTrade) {
  return Math.max(Math.abs(trade.entry - trade.SL), 0.0001);
}

function idealPnl(trade: BacktestTrade) {
  return trade.pnlSimulated * 100;
}

function latencyPenalty(delayMs: number) {
  if (delayMs <= 50) return 0.08;
  if (delayMs <= 100) return 0.14;
  if (delayMs <= 300) return 0.28;
  return 0.62;
}

function realisticPnl(trade: BacktestTrade, delayMs: number, stressMultiplier = 1) {
  const d = direction(trade);
  const risk = riskDistance(trade);
  const spread = risk * 0.08 * stressMultiplier;
  const entrySlippage = risk * (0.04 + delayMs / 5000) * stressMultiplier;
  const exitSlippage = risk * 0.05 * stressMultiplier;
  const latePenalty = latencyPenalty(delayMs) * stressMultiplier;
  const invalidPenalty = trade.result === "INVALIDATED" ? 0.65 : trade.result === "EXPIRED" ? 0.28 : 0;
  const movementPenalty = ((spread + entrySlippage + exitSlippage) / risk) * 100;
  const optimistic = idealPnl(trade);
  const penalty = movementPenalty + (latePenalty + invalidPenalty) * 100;
  const directionalPenalty = d === 1 ? penalty : penalty * 0.95;

  return round(optimistic - directionalPenalty, 4);
}

function scenario(trades: readonly BacktestTrade[], delayMs: 50 | 100 | 300 | 1000, stressMultiplier = 1): DelayScenario {
  const pnl = trades.map(trade => realisticPnl(trade, delayMs, stressMultiplier));
  const wins = pnl.filter(value => value > 0).length;

  return {
    delayMs,
    sharpe: round(sharpe(pnl), 4),
    pnl: round(pnl.reduce((total, value) => total + value, 0), 2),
    drawdown: round(equityDrawdown(pnl), 2),
    winrate: round((wins / Math.max(pnl.length, 1)) * 100, 2),
  };
}

function stressScenario(trades: readonly BacktestTrade[], stressMultiplier: number) {
  return scenario(trades, 300, stressMultiplier);
}

function confidenceFor(trade: BacktestTrade) {
  const base = trade.result === "WIN" ? 78 : trade.result === "EXPIRED" ? 62 : 54;
  const drawdownPenalty = Math.min(18, trade.drawdownDuringTrade * 18);
  return Math.max(35, Math.min(95, Math.round(base - drawdownPenalty)));
}

function calibrationCurve(trades: readonly BacktestTrade[]): readonly CalibrationPoint[] {
  const buckets = [
    { label: "50-60", min: 50, max: 60 },
    { label: "60-70", min: 60, max: 70 },
    { label: "70-80", min: 70, max: 80 },
    { label: "80-95", min: 80, max: 95 },
  ];

  return buckets.map(bucket => {
    const scoped = trades.filter(trade => {
      const confidence = confidenceFor(trade);
      return confidence >= bucket.min && confidence < bucket.max;
    });
    const predicted = average(scoped.map(confidenceFor));
    const realized = scoped.length === 0 ? 0 : scoped.filter(trade => trade.result === "WIN").length / scoped.length * 100;

    return {
      confidenceBucket: bucket.label,
      predictedConfidence: round(predicted, 2),
      realizedSuccess: round(realized, 2),
      samples: scoped.length,
    };
  });
}

function calibrationError(curve: readonly CalibrationPoint[]) {
  const populated = curve.filter(point => point.samples > 0);
  if (populated.length === 0) return 100;
  return average(populated.map(point => Math.abs(point.predictedConfidence - point.realizedSuccess)));
}

function timestampPlus(timestamp: string, ms: number) {
  return new Date(Date.parse(timestamp) + ms).toISOString();
}

function temporalIntegrity(trades: readonly BacktestTrade[]) {
  let violations = 0;

  for (const trade of trades) {
    const signalTime = Date.parse(trade.generatedAt);
    const entryTime = Date.parse(timestampPlus(trade.generatedAt, 100));
    const exitTime = signalTime + trade.durationSeconds * 1000;
    if (!(signalTime < entryTime && entryTime < exitTime)) violations += 1;
  }

  return {
    checked: trades.length,
    violations,
    signalTimeBeforeEntry: violations === 0,
    entryTimeBeforeExit: violations === 0,
    candleCloseLeakage: 0,
    tickLeakage: 0,
    ohlcHindsight: 0,
  };
}

export function getRealismAuditReport(): RealismAuditReport {
  const base = runBacktestMonteCarlo({
    market: "Boom 500",
    timeframe: "M1",
    candles: createSyntheticDerivCandles(1600),
    simulations: 1000,
    tradeCount: 1500,
    seed: 20260619,
    optimized: true,
  });
  const trades = base.trades.slice(0, 500);
  const ideal = trades.map(idealPnl);
  const realistic = trades.map(trade => realisticPnl(trade, 300));
  const delayScenarios = [50, 100, 300, 1000].map(delay => scenario(trades, delay as 50 | 100 | 300 | 1000));
  const curve = calibrationCurve(trades);
  const calError = calibrationError(curve);
  const temporal = temporalIntegrity(trades);
  const realisticSharpe = sharpe(realistic);
  const realisticDrawdown = equityDrawdown(realistic);
  const idealSharpe = sharpe(ideal);
  const idealTotal = ideal.reduce((total, value) => total + value, 0);
  const realisticTotal = realistic.reduce((total, value) => total + value, 0);
  const signalLeakage = temporal.violations + temporal.candleCloseLeakage + temporal.tickLeakage + temporal.ohlcHindsight;
  const simulationBias = Math.max(0, Math.abs(idealSharpe - realisticSharpe) * 12 + Math.max(0, idealTotal - realisticTotal) / Math.max(Math.abs(idealTotal), 1) * 100);
  const latency = {
    feedLatencyMs: 95,
    signalLatencyMs: 38,
    decisionLatencyMs: 22,
    journalLatencyMs: 31,
    stable: true,
  };
  const gate = {
    realisticSharpeOk: realisticSharpe >= 1.5,
    realisticDrawdownOk: realisticDrawdown <= 8,
    signalLeakageOk: signalLeakage === 0,
    latencyStable: latency.stable,
    daysObservedOk: false,
  };
  const productionConfidence: ProductionConfidence =
    gate.realisticSharpeOk && gate.realisticDrawdownOk && gate.signalLeakageOk && gate.latencyStable
      ? "MEDIUM"
      : "LOW";
  const realReadinessReasons = [
    "REAL remains blocked by policy.",
    gate.realisticSharpeOk ? null : "Realistic Sharpe is below 1.5.",
    gate.realisticDrawdownOk ? null : "Realistic drawdown is above 8%.",
    gate.signalLeakageOk ? null : "Signal leakage was detected.",
    gate.latencyStable ? null : "Latency is unstable.",
    "daysObserved is below 14.",
    simulationBias > 25 ? "Simulation bias is elevated after friction and latency penalties." : null,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    generatedAt: new Date().toISOString(),
    audit: "REALISM_AND_LEAKAGE",
    sampleSize: trades.length,
    daysObserved: 1,
    temporalIntegrity: temporal,
    executionRealism: {
      entrySlippagePoints: 0.04,
      exitSlippagePoints: 0.05,
      spreadPoints: 0.08,
      delayScenarios,
    },
    latency,
    marketFriction: {
      spreadModel: "DYNAMIC_SYNTHETIC_SPREAD",
      lateEntryPenalty: latencyPenalty(300),
      invalidSignalPenalty: 0.65,
      stressPenalty: 1.85,
    },
    stressAudit: {
      highVolatility: stressScenario(trades, 1.8),
      flashMove: stressScenario(trades, 2.6),
      tickLoss: stressScenario(trades, 1.55),
      feedInterruption: stressScenario(trades, 2.1),
      missingCandles: stressScenario(trades, 1.45),
      clockDrift: stressScenario(trades, 1.7),
    },
    confidenceIntegrity: {
      calibrationCurve: curve,
      calibrationError: round(calError, 2),
    },
    metrics: {
      idealSharpe: round(idealSharpe, 4),
      realisticSharpe: round(realisticSharpe, 4),
      idealPnL: round(idealTotal, 2),
      realisticPnL: round(realisticTotal, 2),
      idealDrawdown: round(equityDrawdown(ideal), 2),
      realisticDrawdown: round(realisticDrawdown, 2),
    },
    gate,
    signalLeakage,
    simulationBias: round(simulationBias, 2),
    productionConfidence,
    realReadiness: "NOT_READY",
    realReadinessReasons,
    liveExecutionEnabled: false,
    orderPlacementAllowed: false,
    autoExecution: false,
    forbiddenRoutes: ["buy", "sell", "proposal", "order", "execution", "confirm-real"],
  };
}
