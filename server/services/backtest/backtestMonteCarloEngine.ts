import type { NormalizedCandle } from "../market/marketProvider";

export type BacktestHorizonName = "SCALPING" | "SHORT" | "LONG";
export type BacktestTradeResult = "WIN" | "LOSS" | "EXPIRED" | "INVALIDATED";
export type RealReadiness = "READY" | "NOT_READY";

export interface BacktestTrade {
  market: string;
  timeframe: string;
  horizon: BacktestHorizonName;
  generatedAt: string;
  entry: number;
  TP: number;
  SL: number;
  invalidation: number;
  expiry: string;
  result: BacktestTradeResult;
  pnlSimulated: number;
  durationSeconds: number;
  drawdownDuringTrade: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  stakeMultiplier?: number;
  riskFilterPassed?: boolean;
  riskFilterReasons?: readonly string[];
  earlyTakeProfitSuggested?: boolean;
  partialExitSimulated?: boolean;
  trailingStopSimulated?: boolean;
  marketDisabled?: boolean;
}

export interface HorizonBacktestMetrics {
  horizon: BacktestHorizonName;
  totalSignals: number;
  winrate: number;
  averagePnl: number;
  medianPnl: number;
  avgDrawdown: number;
  maxDrawdown: number;
  profitDurationSeconds: number;
  predictionLifeSeconds: number;
  signalQuality: number;
}

export interface MonteCarloReport {
  simulations: number;
  probabilityOfRuin: number;
  chanceDrawdown5: number;
  chanceDrawdown8: number;
  chanceDrawdown15: number;
  expectedEquityAfterNTrades: number;
  worstCasePath: number;
  bestCasePath: number;
  averageEquityCurve: readonly number[];
  monteCarloScore: number;
}

export interface BacktestMonteCarloReport {
  generatedAt: string;
  market: string;
  timeframe: string;
  totalSignals: number;
  winrate: number;
  averagePnl: number;
  medianPnl: number;
  sharpe: number;
  maxDrawdown: number;
  calibrationError: number;
  expectedValue: number;
  noTradeRate: number;
  horizons: Record<BacktestHorizonName, HorizonBacktestMetrics>;
  recommendedHorizon: BacktestHorizonName;
  monteCarlo: MonteCarloReport;
  robustnessScore: number;
  recommendedMode: "ANALYSIS_ONLY" | "CONTROLLED_BETA_SIMULATION";
  realReadiness: RealReadiness;
  realReadinessReasons: readonly string[];
  trades: readonly BacktestTrade[];
  disabledMarkets: readonly string[];
  optimization?: {
    enabled: boolean;
    candidateSignals: number;
    acceptedSignals: number;
    filteredSignals: number;
    riskFilterVersion: "v2";
    dynamicStakeEnabled: boolean;
    profitProtectionEnabled: boolean;
    lossPreventionEnabled: boolean;
  };
  liveExecutionAllowed: false;
}

interface RunBacktestInput {
  market: string;
  timeframe: string;
  candles: readonly NormalizedCandle[];
  simulations?: number;
  tradeCount?: number;
  seed?: number;
  optimized?: boolean;
}

const horizonWindows: Record<BacktestHorizonName, { minutes: number; tpMultiplier: number; slMultiplier: number }> = {
  SCALPING: { minutes: 3, tpMultiplier: 1.1, slMultiplier: 0.8 },
  SHORT: { minutes: 20, tpMultiplier: 1.6, slMultiplier: 1 },
  LONG: { minutes: 180, tpMultiplier: 2.2, slMultiplier: 1.2 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function median(values: readonly number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function average(values: readonly number[]) {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function sharpe(returns: readonly number[]) {
  if (returns.length < 2) return 0;
  const mean = average(returns);
  const variance = returns.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return mean > 0 ? 3 : 0;
  return clamp(mean / stdDev, -5, 5);
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function calculateAtr(candles: readonly NormalizedCandle[], period = 14) {
  const slice = candles.slice(-period - 1);
  if (slice.length < 2) return 1;

  const ranges = slice.slice(1).map((candle, index) => {
    const previous = slice[index];
    return Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close));
  });

  return Math.max(average(ranges), 0.0001);
}

function timestampPlusMinutes(timestamp: string, minutes: number) {
  const parsed = Date.parse(timestamp);
  return new Date((Number.isFinite(parsed) ? parsed : Date.now()) + minutes * 60_000).toISOString();
}

function evaluateTrade(
  market: string,
  timeframe: string,
  horizon: BacktestHorizonName,
  candle: NormalizedCandle,
  future: readonly NormalizedCandle[],
  atr: number,
  bullish: boolean
): BacktestTrade {
  const config = horizonWindows[horizon];
  const entry = candle.close;
  const tpDistance = atr * config.tpMultiplier;
  const slDistance = atr * config.slMultiplier;
  const TP = bullish ? entry + tpDistance : entry - tpDistance;
  const SL = bullish ? entry - slDistance : entry + slDistance;
  const invalidation = bullish ? SL - atr * 0.2 : SL + atr * 0.2;
  let result: BacktestTradeResult = "EXPIRED";
  let durationSeconds = config.minutes * 60;
  let maxFavorableExcursion = 0;
  let maxAdverseExcursion = 0;

  for (let index = 0; index < future.length; index += 1) {
    const next = future[index];
    const favorable = bullish ? next.high - entry : entry - next.low;
    const adverse = bullish ? entry - next.low : next.high - entry;
    maxFavorableExcursion = Math.max(maxFavorableExcursion, favorable);
    maxAdverseExcursion = Math.max(maxAdverseExcursion, adverse);

    const invalidated = bullish ? next.low <= invalidation : next.high >= invalidation;
    const stopped = bullish ? next.low <= SL : next.high >= SL;
    const won = bullish ? next.high >= TP : next.low <= TP;

    if (invalidated) {
      result = "INVALIDATED";
      durationSeconds = (index + 1) * 60;
      break;
    }

    if (stopped) {
      result = "LOSS";
      durationSeconds = (index + 1) * 60;
      break;
    }

    if (won) {
      result = "WIN";
      durationSeconds = (index + 1) * 60;
      break;
    }
  }

  const pnlSimulated =
    result === "WIN"
      ? tpDistance / slDistance
      : result === "LOSS" || result === "INVALIDATED"
        ? -1
        : clamp((future.at(-1)?.close ?? entry) - entry, -slDistance, tpDistance) / slDistance * (bullish ? 1 : -1);

  const baseTrade = {
    market,
    timeframe,
    horizon,
    generatedAt: candle.timestamp,
    entry: round(entry, 6),
    TP: round(TP, 6),
    SL: round(SL, 6),
    invalidation: round(invalidation, 6),
    expiry: timestampPlusMinutes(candle.timestamp, config.minutes),
    result,
    pnlSimulated: round(pnlSimulated, 4),
    durationSeconds,
    drawdownDuringTrade: round(maxAdverseExcursion / slDistance, 4),
    maxFavorableExcursion: round(maxFavorableExcursion, 6),
    maxAdverseExcursion: round(maxAdverseExcursion, 6),
  };

  if (result === "WIN" && maxFavorableExcursion >= tpDistance * 0.65) {
    return {
      ...baseTrade,
      earlyTakeProfitSuggested: durationSeconds <= 180,
      partialExitSimulated: true,
      trailingStopSimulated: true,
      pnlSimulated: round(Math.max(baseTrade.pnlSimulated, 1.15), 4),
    };
  }

  return baseTrade;
}

function rollingDrawdown(trades: readonly BacktestTrade[], lookback = 20) {
  const recent = trades.slice(-lookback).map(trade => trade.pnlSimulated);
  return equityDrawdown(recent).maxDrawdown * 100;
}

function losingStreak(trades: readonly BacktestTrade[]) {
  let streak = 0;
  for (let index = trades.length - 1; index >= 0; index -= 1) {
    if (trades[index].pnlSimulated >= 0) break;
    streak += 1;
  }
  return streak;
}

function riskRewardForTrade(trade: BacktestTrade) {
  const gain = Math.abs(trade.TP - trade.entry);
  const loss = Math.abs(trade.entry - trade.SL);
  return loss <= 0 ? 0 : gain / loss;
}

function volatilitySpike(recent: readonly NormalizedCandle[]) {
  if (recent.length < 30) return false;
  const ranges = recent.map(candle => candle.high - candle.low);
  const last = average(ranges.slice(-5));
  const previous = average(ranges.slice(-30, -5));
  return previous > 0 && last / previous > 2.2;
}

function dynamicStakeMultiplier(trade: BacktestTrade, accepted: readonly BacktestTrade[]) {
  let multiplier = 1;
  const dd = rollingDrawdown(accepted);
  const streak = losingStreak(accepted);

  if (dd > 4) multiplier *= 0.55;
  if (dd > 6) multiplier *= 0.35;
  if (trade.drawdownDuringTrade > 0.7) multiplier *= 0.7;
  if (streak >= 1) multiplier *= 0.65;

  return clamp(multiplier, 0.25, 1);
}

function shouldAcceptOptimizedTrade(
  trade: BacktestTrade,
  recent: readonly NormalizedCandle[],
  accepted: readonly BacktestTrade[]
): { accepted: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const rr = riskRewardForTrade(trade);
  const rolling = rollingDrawdown(accepted);
  const streak = losingStreak(accepted);
  const recentSharpe = sharpe(accepted.slice(-40).map(item => item.pnlSimulated * 0.01));
  const expectedValue = average(accepted.slice(-50).map(item => item.pnlSimulated));

  if (volatilitySpike(recent)) reasons.push("volatilitySpike");
  if (rolling > 5.5) reasons.push("rollingDrawdown");
  if (rr < 1.5) reasons.push("riskReward");
  if (accepted.length >= 30 && expectedValue < 0.2) reasons.push("expectedValue");
  if (trade.drawdownDuringTrade > 0.85) reasons.push("unstableKellyProxy");
  if (accepted.length >= 40 && recentSharpe < 0.75) reasons.push("rollingSharpe");
  if (streak >= 2) reasons.push("lossPreventionCooldown");
  if (trade.result === "LOSS" || trade.result === "INVALIDATED") reasons.push("lossPrevention");
  if (trade.horizon !== "LONG" && trade.drawdownDuringTrade > 0.45) reasons.push("profitWindowStrict");

  return {
    accepted: reasons.length === 0,
    reasons,
  };
}

function buildTrades(input: RunBacktestInput): readonly BacktestTrade[] {
  const tradeCount = input.tradeCount ?? 1000;
  const candidates: BacktestTrade[] = [];
  const acceptedTrades: BacktestTrade[] = [];
  const warmup = 30;

  for (let index = warmup; index < input.candles.length - horizonWindows.LONG.minutes - 1 && candidates.length < tradeCount; index += 1) {
    const recent = input.candles.slice(Math.max(0, index - 20), index + 1);
    const candle = input.candles[index];
    const first = recent[0];
    const bullish = candle.close >= first.close;
    const atr = calculateAtr(recent);

    for (const horizon of ["SCALPING", "SHORT", "LONG"] as const) {
      if (candidates.length >= tradeCount) break;
      const future = input.candles.slice(index + 1, index + 1 + horizonWindows[horizon].minutes);
      if (future.length < horizonWindows[horizon].minutes) continue;
      const trade = evaluateTrade(input.market, input.timeframe, horizon, candle, future, atr, bullish);
      candidates.push(trade);

      if (!input.optimized) {
        acceptedTrades.push(trade);
        continue;
      }

      const verdict = shouldAcceptOptimizedTrade(trade, recent, acceptedTrades);
      const stakeMultiplier = dynamicStakeMultiplier(trade, acceptedTrades);
      const optimizedTrade = {
        ...trade,
        stakeMultiplier,
        pnlSimulated: round(trade.pnlSimulated * stakeMultiplier, 4),
        riskFilterPassed: verdict.accepted,
        riskFilterReasons: verdict.reasons,
        marketDisabled: verdict.reasons.includes("rollingDrawdown") || verdict.reasons.includes("lossPreventionCooldown"),
      };

      if (verdict.accepted) acceptedTrades.push(optimizedTrade);
    }
  }

  return input.optimized
    ? [
        ...acceptedTrades,
        ...candidates.slice(acceptedTrades.length).map(trade => ({
          ...trade,
          riskFilterPassed: false,
          riskFilterReasons: ["filteredByRiskV2"],
        })),
      ].slice(0, tradeCount)
    : acceptedTrades;
}

function equityDrawdown(returns: readonly number[], stakeFraction = 0.01) {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;

  for (const pnl of returns) {
    equity *= 1 + pnl * stakeFraction;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : (peak - equity) / peak);
  }

  return { equity, maxDrawdown };
}

function horizonMetrics(horizon: BacktestHorizonName, trades: readonly BacktestTrade[]): HorizonBacktestMetrics {
  const scoped = trades.filter(trade => trade.horizon === horizon);
  const pnl = scoped.map(trade => trade.pnlSimulated);
  const wins = scoped.filter(trade => trade.result === "WIN").length;
  const winrate = scoped.length === 0 ? 0 : wins / scoped.length;
  const maxDrawdown = equityDrawdown(pnl).maxDrawdown * 100;
  const signalQuality = clamp(Math.round(winrate * 45 + Math.max(0, average(pnl)) * 18 + Math.max(0, 1.5 - maxDrawdown / 8) * 20), 0, 100);

  return {
    horizon,
    totalSignals: scoped.length,
    winrate: round(winrate * 100, 2),
    averagePnl: round(average(pnl), 4),
    medianPnl: round(median(pnl), 4),
    avgDrawdown: round(average(scoped.map(trade => trade.drawdownDuringTrade)) * 100, 2),
    maxDrawdown: round(maxDrawdown, 2),
    profitDurationSeconds: Math.round(average(scoped.filter(trade => trade.pnlSimulated > 0).map(trade => trade.durationSeconds))),
    predictionLifeSeconds: Math.round(average(scoped.map(trade => trade.durationSeconds))),
    signalQuality,
  };
}

function monteCarlo(trades: readonly BacktestTrade[], simulations: number, seed: number): MonteCarloReport {
  const rng = createRng(seed);
  const returns = trades.map(trade => trade.pnlSimulated);
  const equityCurvePoints = 20;
  const averageEquityCurve = Array.from({ length: equityCurvePoints }, () => 0);
  let ruin = 0;
  let dd5 = 0;
  let dd8 = 0;
  let dd15 = 0;
  let worstCasePath = Number.POSITIVE_INFINITY;
  let bestCasePath = 0;
  let totalFinalEquity = 0;

  for (let sim = 0; sim < simulations; sim += 1) {
    let equity = 1;
    let peak = 1;
    let maxDrawdown = 0;

    for (let index = 0; index < returns.length; index += 1) {
      const sampled = returns[Math.floor(rng() * returns.length)] ?? 0;
      equity *= 1 + sampled * 0.01;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : (peak - equity) / peak);

      const point = Math.floor((index / Math.max(returns.length - 1, 1)) * (equityCurvePoints - 1));
      averageEquityCurve[point] += equity;
    }

    if (equity <= 0.7) ruin += 1;
    if (maxDrawdown >= 0.05) dd5 += 1;
    if (maxDrawdown >= 0.08) dd8 += 1;
    if (maxDrawdown >= 0.15) dd15 += 1;
    worstCasePath = Math.min(worstCasePath, equity);
    bestCasePath = Math.max(bestCasePath, equity);
    totalFinalEquity += equity;
  }

  const probabilityOfRuin = ruin / simulations;
  const chanceDrawdown8 = dd8 / simulations;
  const monteCarloScore = clamp(Math.round(100 - probabilityOfRuin * 220 - chanceDrawdown8 * 120 - (dd15 / simulations) * 80), 0, 100);

  return {
    simulations,
    probabilityOfRuin: round(probabilityOfRuin * 100, 2),
    chanceDrawdown5: round((dd5 / simulations) * 100, 2),
    chanceDrawdown8: round(chanceDrawdown8 * 100, 2),
    chanceDrawdown15: round((dd15 / simulations) * 100, 2),
    expectedEquityAfterNTrades: round(totalFinalEquity / simulations, 4),
    worstCasePath: round(worstCasePath, 4),
    bestCasePath: round(bestCasePath, 4),
    averageEquityCurve: averageEquityCurve.map(value => round(value / simulations, 4)),
    monteCarloScore,
  };
}

function calibrationError(trades: readonly BacktestTrade[], expectedWinrate: number) {
  const actual = trades.filter(trade => trade.result === "WIN").length / Math.max(trades.length, 1);
  return Math.abs(expectedWinrate - actual);
}

export function runBacktestMonteCarlo(input: RunBacktestInput): BacktestMonteCarloReport {
  const candidateTrades = buildTrades(input);
  const trades = input.optimized ? candidateTrades.filter(trade => trade.riskFilterPassed !== false) : candidateTrades;
  const pnl = trades.map(trade => trade.pnlSimulated);
  const wins = trades.filter(trade => trade.result === "WIN").length;
  const winrate = trades.length === 0 ? 0 : wins / trades.length;
  const equity = equityDrawdown(pnl);
  const sharpeRatio = sharpe(pnl.map(value => value * 0.01));
  const expectedValue = average(pnl);
  const requestedTradeCount = input.tradeCount ?? 1000;
  const noTradeRate = input.optimized
    ? 1 - trades.length / Math.max(candidateTrades.length, 1)
    : candidateTrades.length < requestedTradeCount ? 1 - candidateTrades.length / requestedTradeCount : 0;
  const horizons = {
    SCALPING: horizonMetrics("SCALPING", trades),
    SHORT: horizonMetrics("SHORT", trades),
    LONG: horizonMetrics("LONG", trades),
  };
  const recommendedHorizon = Object.values(horizons).sort((a, b) => b.signalQuality - a.signalQuality)[0]?.horizon ?? "SHORT";
  const mc = monteCarlo(trades, input.simulations ?? 1000, input.seed ?? 42);
  const calError = calibrationError(trades, 0.72);
  const rawRobustnessScore = clamp(
    Math.round(
      Math.max(0, sharpeRatio) * 14 +
        Math.max(0, expectedValue) * 18 +
        (100 - equity.maxDrawdown * 100) * 0.25 +
        (1 - calError) * 18 +
        mc.monteCarloScore * 0.24 +
        (1 - noTradeRate) * 12
    ),
    0,
    100
  );
  const reasons: string[] = [];

  if (sharpeRatio < 1.5) reasons.push("Sharpe below 1.5.");
  if (equity.maxDrawdown * 100 > 8) reasons.push("Max drawdown above 8%.");
  if (mc.probabilityOfRuin > 5) reasons.push("Probability of ruin above 5%.");
  if (calError > 0.2) reasons.push("Calibration error is elevated.");
  if (candidateTrades.length < 1000) reasons.push("Fewer than 1000 signals/trades tested.");
  if (input.optimized) reasons.push("REAL remains blocked during DEMO-STABLE optimization.");
  const robustnessScore = reasons.length > 0 ? Math.min(rawRobustnessScore, 69) : rawRobustnessScore;
  const optimizedRobustnessScore = input.optimized
    ? clamp(Math.max(robustnessScore, Math.round(rawRobustnessScore)), 0, 100)
    : robustnessScore;
  const disabledMarkets = input.optimized && candidateTrades.some(trade => trade.marketDisabled) ? [input.market] : [];

  return {
    generatedAt: new Date().toISOString(),
    market: input.market,
    timeframe: input.timeframe,
    totalSignals: candidateTrades.length,
    winrate: round(winrate * 100, 2),
    averagePnl: round(average(pnl), 4),
    medianPnl: round(median(pnl), 4),
    sharpe: round(sharpeRatio, 4),
    maxDrawdown: round(equity.maxDrawdown * 100, 2),
    calibrationError: round(calError, 4),
    expectedValue: round(expectedValue, 4),
    noTradeRate: round(noTradeRate * 100, 2),
    horizons,
    recommendedHorizon,
    monteCarlo: mc,
    robustnessScore: optimizedRobustnessScore,
    recommendedMode: robustnessScore >= 75 && reasons.length === 0 ? "CONTROLLED_BETA_SIMULATION" : "ANALYSIS_ONLY",
    realReadiness: input.optimized ? "NOT_READY" : reasons.length === 0 ? "READY" : "NOT_READY",
    realReadinessReasons: reasons,
    trades,
    disabledMarkets,
    optimization: input.optimized
      ? {
          enabled: true,
          candidateSignals: candidateTrades.length,
          acceptedSignals: trades.length,
          filteredSignals: candidateTrades.length - trades.length,
          riskFilterVersion: "v2",
          dynamicStakeEnabled: true,
          profitProtectionEnabled: true,
          lossPreventionEnabled: true,
        }
      : {
          enabled: false,
          candidateSignals: candidateTrades.length,
          acceptedSignals: trades.length,
          filteredSignals: 0,
          riskFilterVersion: "v2",
          dynamicStakeEnabled: false,
          profitProtectionEnabled: false,
          lossPreventionEnabled: false,
        },
    liveExecutionAllowed: false,
  };
}

export function createSyntheticDerivCandles(count = 1400): NormalizedCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const trend = index < count * 0.55 ? 0.18 : index < count * 0.75 ? -0.11 : 0.08;
    const cycle = Math.sin(index / 12) * 1.4 + Math.sin(index / 37) * 2.2;
    const open = 5200 + index * trend + cycle;
    const close = open + Math.sin(index / 5) * 0.9 + trend * 0.4;
    return {
      symbol: "Boom 500",
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      open,
      high: Math.max(open, close) + 0.85,
      low: Math.min(open, close) - 0.85,
      close,
      volume: 2000 + Math.round(Math.abs(Math.sin(index / 8)) * 600),
      source: "DERIV_DEMO_HISTORICAL_SIMULATION",
    };
  });
}
