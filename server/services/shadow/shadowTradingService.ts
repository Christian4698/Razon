import { createSyntheticDerivCandles, runBacktestMonteCarlo, type BacktestHorizonName, type BacktestTrade } from "../backtest/backtestMonteCarloEngine";

export type ShadowLifecycleStatus = "CREATED" | "ACTIVE" | "EXPIRED" | "CLOSED" | "INVALIDATED";
export type ShadowMode = BacktestHorizonName;
export type ShadowRealReadiness = "NOT_READY";

export interface ShadowSignalRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly market: string;
  readonly direction: "UP" | "DOWN" | "WAIT";
  readonly confidence: number;
  readonly entry: number;
  readonly virtualExit: number;
  readonly TP: number;
  readonly SL: number;
  readonly expiry: string;
  readonly expectedValue: number;
  readonly riskReward: number;
  readonly signalHorizon: ShadowMode;
  readonly capitalModel: "FIXED_FRACTION_SIMULATION";
  readonly pnlSimulated: number;
  readonly result: "WIN" | "LOSS" | "EXPIRED" | "INVALIDATED";
  readonly lifecycle: ShadowLifecycleStatus;
}

export interface ShadowTradingReport {
  readonly generatedAt: string;
  readonly mode: "SHADOW_TRADING";
  readonly pipeline: readonly ["Market Feed", "Signal", "Decision", "Virtual Entry", "Virtual TP/SL", "Journal", "Performance"];
  readonly modes: readonly ShadowMode[];
  readonly minimumLiveSignalsRequired: 500;
  readonly signalsObserved: number;
  readonly todayPnl: number;
  readonly weeklyPnl: number;
  readonly virtualBalance: number;
  readonly winrate: number;
  readonly avgDurationSeconds: number;
  readonly drawdown: number;
  readonly sharpe: number;
  readonly noTradeRate: number;
  readonly profitFactor: number;
  readonly rollingSharpe: number;
  readonly rollingDrawdown: number;
  readonly signalDecay: number;
  readonly confidenceStability: number;
  readonly marketStability: number;
  readonly regimeChanges: number;
  readonly rules: {
    readonly rollingSharpeOk: boolean;
    readonly drawdownOk: boolean;
    readonly signalDecayOk: boolean;
    readonly confidenceDriftOk: boolean;
  };
  readonly realReadiness: ShadowRealReadiness;
  readonly realReadinessReasons: readonly string[];
  readonly liveExecutionEnabled: false;
  readonly orderPlacementAllowed: false;
  readonly autoExecution: false;
  readonly forbiddenRoutes: readonly ["buy", "sell", "proposal", "order", "execution", "confirm-real"];
  readonly journal: readonly ShadowSignalRecord[];
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
  const stdDev = standardDeviation(values);
  if (stdDev === 0) return average(values) > 0 ? 3 : 0;
  return average(values) / stdDev;
}

function equityDrawdown(pnl: readonly number[], initialBalance = 10000) {
  let equity = initialBalance;
  let peak = initialBalance;
  let maxDrawdown = 0;

  for (const value of pnl) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : (peak - equity) / peak);
  }

  return { equity, maxDrawdown: maxDrawdown * 100 };
}

function directionFromTrade(trade: BacktestTrade): "UP" | "DOWN" {
  return trade.TP >= trade.entry ? "UP" : "DOWN";
}

function confidenceFromTrade(trade: BacktestTrade, reportSharpe: number) {
  const base = trade.result === "WIN" ? 78 : trade.result === "EXPIRED" ? 66 : 58;
  const stability = Math.max(0, Math.min(12, reportSharpe * 4));
  const drawdownPenalty = Math.min(16, trade.drawdownDuringTrade * 18);
  return Math.round(Math.max(35, Math.min(95, base + stability - drawdownPenalty)));
}

function lifecycleFromTrade(trade: BacktestTrade): ShadowLifecycleStatus {
  if (trade.result === "INVALIDATED") return "INVALIDATED";
  if (trade.result === "EXPIRED") return "EXPIRED";
  return "CLOSED";
}

function virtualExitFromTrade(trade: BacktestTrade) {
  if (trade.result === "WIN") return trade.TP;
  if (trade.result === "LOSS" || trade.result === "INVALIDATED") return trade.SL;
  const distance = Math.abs(trade.TP - trade.entry) * Math.max(-1, Math.min(1, trade.pnlSimulated));
  return round(directionFromTrade(trade) === "UP" ? trade.entry + distance : trade.entry - distance, 6);
}

function riskReward(trade: BacktestTrade) {
  const risk = Math.abs(trade.entry - trade.SL);
  const reward = Math.abs(trade.TP - trade.entry);
  return risk <= 0 ? 0 : reward / risk;
}

function toShadowRecord(trade: BacktestTrade, index: number, reportSharpe: number, reportExpectedValue: number): ShadowSignalRecord {
  return {
    id: `shadow-${index + 1}`,
    timestamp: trade.generatedAt,
    market: trade.market,
    direction: directionFromTrade(trade),
    confidence: confidenceFromTrade(trade, reportSharpe),
    entry: trade.entry,
    virtualExit: virtualExitFromTrade(trade),
    TP: trade.TP,
    SL: trade.SL,
    expiry: trade.expiry,
    expectedValue: round(reportExpectedValue, 4),
    riskReward: round(riskReward(trade), 2),
    signalHorizon: trade.horizon,
    capitalModel: "FIXED_FRACTION_SIMULATION",
    pnlSimulated: round(trade.pnlSimulated * 100, 2),
    result: trade.result,
    lifecycle: lifecycleFromTrade(trade),
  };
}

function profitFactor(pnl: readonly number[]) {
  const gains = pnl.filter(value => value > 0).reduce((total, value) => total + value, 0);
  const losses = Math.abs(pnl.filter(value => value < 0).reduce((total, value) => total + value, 0));
  return losses === 0 ? gains > 0 ? 99 : 0 : gains / losses;
}

function countRegimeChanges(records: readonly ShadowSignalRecord[]) {
  let changes = 0;
  for (let index = 1; index < records.length; index += 1) {
    if (records[index].direction !== records[index - 1].direction || records[index].signalHorizon !== records[index - 1].signalHorizon) {
      changes += 1;
    }
  }
  return changes;
}

export function getShadowTradingReport(): ShadowTradingReport {
  const report = runBacktestMonteCarlo({
    market: "Boom 500",
    timeframe: "M1",
    candles: createSyntheticDerivCandles(1600),
    simulations: 1000,
    tradeCount: 1500,
    seed: 20260619,
    optimized: true,
  });
  const records = report.trades
    .slice(0, 500)
    .map((trade, index) => toShadowRecord(trade, index, report.sharpe, report.expectedValue));
  const pnl = records.map(record => record.pnlSimulated);
  const wins = records.filter(record => record.result === "WIN").length;
  const closed = records.filter(record => record.lifecycle === "CLOSED").length;
  const expired = records.filter(record => record.lifecycle === "EXPIRED").length;
  const confidenceStdDev = standardDeviation(records.map(record => record.confidence));
  const rollingPnl = pnl.slice(-100);
  const rollingEquity = equityDrawdown(rollingPnl);
  const equity = equityDrawdown(pnl);
  const avgDurationSeconds = average(report.trades.slice(0, 500).map(trade => trade.durationSeconds));
  const signalDecay = records.length === 0 ? 0 : (expired / records.length) * 100;
  const confidenceDrift = confidenceStdDev;
  const confidenceStability = Math.max(0, 100 - confidenceDrift);
  const marketStability = Math.max(0, 100 - countRegimeChanges(records) / Math.max(records.length, 1) * 100);
  const rules = {
    rollingSharpeOk: sharpe(rollingPnl) >= 1.5,
    drawdownOk: rollingEquity.maxDrawdown <= 8,
    signalDecayOk: signalDecay <= 15,
    confidenceDriftOk: confidenceDrift <= 10,
  };
  const realReadinessReasons = [
    "REAL remains blocked by policy during Shadow Trading.",
    "Shadow signals are virtual and do not create buy/sell/proposal/order requests.",
    rules.rollingSharpeOk ? null : "Rolling Sharpe is below 1.5.",
    rules.drawdownOk ? null : "Rolling drawdown is above 8%.",
    rules.signalDecayOk ? null : "Signal decay is above 15%.",
    rules.confidenceDriftOk ? null : "Confidence drift is above 10%.",
  ].filter((reason): reason is string => Boolean(reason));

  return {
    generatedAt: new Date().toISOString(),
    mode: "SHADOW_TRADING",
    pipeline: ["Market Feed", "Signal", "Decision", "Virtual Entry", "Virtual TP/SL", "Journal", "Performance"],
    modes: ["SCALPING", "SHORT", "LONG"],
    minimumLiveSignalsRequired: 500,
    signalsObserved: records.length,
    todayPnl: round(average(pnl.slice(-50)) * 50, 2),
    weeklyPnl: round(pnl.reduce((total, value) => total + value, 0), 2),
    virtualBalance: round(equity.equity, 2),
    winrate: round((wins / Math.max(records.length, 1)) * 100, 2),
    avgDurationSeconds: Math.round(avgDurationSeconds),
    drawdown: round(equity.maxDrawdown, 2),
    sharpe: round(sharpe(pnl), 4),
    noTradeRate: report.noTradeRate,
    profitFactor: round(profitFactor(pnl), 2),
    rollingSharpe: round(sharpe(rollingPnl), 4),
    rollingDrawdown: round(rollingEquity.maxDrawdown, 2),
    signalDecay: round(signalDecay, 2),
    confidenceStability: round(confidenceStability, 2),
    marketStability: round(marketStability, 2),
    regimeChanges: countRegimeChanges(records),
    rules,
    realReadiness: "NOT_READY",
    realReadinessReasons,
    liveExecutionEnabled: false,
    orderPlacementAllowed: false,
    autoExecution: false,
    forbiddenRoutes: ["buy", "sell", "proposal", "order", "execution", "confirm-real"],
    journal: records.slice(-25).reverse(),
  };
}
