import type { BacktestMetrics, BacktestTrade } from "./backtest.types";

const emptyMetrics: BacktestMetrics = {
  totalTrades: 0,
  winRate: 0,
  lossRate: 0,
  profitFactor: 0,
  expectancy: 0,
  maxDrawdown: 0,
  averageRR: 0,
  losingStreak: 0,
  winningStreak: 0,
  netProfit: 0,
  averageWin: 0,
  averageLoss: 0,
};

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function average(values: readonly number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function calculateMaxDrawdown(trades: readonly BacktestTrade[]) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const trade of trades) {
    equity += trade.pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  return maxDrawdown;
}

function calculateStreaks(trades: readonly BacktestTrade[]) {
  let winningStreak = 0;
  let losingStreak = 0;
  let currentWins = 0;
  let currentLosses = 0;

  for (const trade of trades) {
    if (trade.pnl > 0) {
      currentWins += 1;
      currentLosses = 0;
    } else if (trade.pnl < 0) {
      currentLosses += 1;
      currentWins = 0;
    } else {
      currentWins = 0;
      currentLosses = 0;
    }

    winningStreak = Math.max(winningStreak, currentWins);
    losingStreak = Math.max(losingStreak, currentLosses);
  }

  return { winningStreak, losingStreak };
}

export function calculateMetrics(trades: readonly BacktestTrade[]): BacktestMetrics {
  if (trades.length === 0) return emptyMetrics;

  const wins = trades.filter(trade => trade.pnl > 0);
  const losses = trades.filter(trade => trade.pnl < 0);
  const grossProfit = wins.reduce((total, trade) => total + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((total, trade) => total + trade.pnl, 0));
  const netProfit = trades.reduce((total, trade) => total + trade.pnl, 0);
  const { winningStreak, losingStreak } = calculateStreaks(trades);

  return {
    totalTrades: trades.length,
    winRate: round((wins.length / trades.length) * 100, 2),
    lossRate: round((losses.length / trades.length) * 100, 2),
    profitFactor: grossLoss === 0 ? round(grossProfit, 4) : round(grossProfit / grossLoss, 4),
    expectancy: round(netProfit / trades.length, 4),
    maxDrawdown: round(calculateMaxDrawdown(trades), 4),
    averageRR: round(average(trades.map(trade => trade.rr)), 4),
    losingStreak,
    winningStreak,
    netProfit: round(netProfit, 4),
    averageWin: round(average(wins.map(trade => trade.pnl)), 4),
    averageLoss: round(average(losses.map(trade => trade.pnl)), 4),
  };
}
