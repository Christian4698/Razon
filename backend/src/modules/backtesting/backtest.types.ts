import type { KalosInput, KalosLayerInput, KalosOutput } from "../kalos";
import type { Timeframe } from "../../core/types/timeframe.types";

export type BacktestMode = "SCALPING" | "SHORT_TERM" | "LONG_TERM";

export type BacktestStrategy = "KALOS";

export type BacktestDataSource = "historical" | "mock";

export type BacktestTradeDirection = "BUY" | "SELL";

export type BacktestTradeExitReason = "TP" | "SL" | "END_OF_WINDOW";

export interface BacktestPeriod {
  readonly from: string;
  readonly to: string;
}

export interface BacktestCandle {
  readonly timestamp: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
}

export interface BacktestRequest {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly period: BacktestPeriod;
  readonly mode: BacktestMode;
  readonly strategy: BacktestStrategy;
  readonly initialCapital: number;
  readonly riskPerTradePercent: number;
  readonly simulatedSpread: number;
  readonly simulatedSlippage: number;
  readonly candles?: readonly BacktestCandle[];
}

export interface BacktestValidation {
  readonly accepted: boolean;
  readonly errors: readonly string[];
  readonly dataSource: BacktestDataSource;
  readonly dataSourceMessage: string;
}

export interface BacktestReplayFrame {
  readonly index: number;
  readonly timestamp: string;
  readonly candle: BacktestCandle;
  readonly layers: readonly KalosLayerInput[];
  readonly kalosInput: KalosInput;
}

export interface BacktestSignalRecord {
  readonly index: number;
  readonly timestamp: string;
  readonly signal: KalosOutput;
}

export interface BacktestNoTradeRecord {
  readonly index: number;
  readonly timestamp: string;
  readonly signal: "WAIT" | "NO_TRADE";
  readonly confidence: number;
  readonly reasons: readonly string[];
}

export interface BacktestTrade {
  readonly id: string;
  readonly signalIndex: number;
  readonly symbol: string;
  readonly direction: BacktestTradeDirection;
  readonly entryTime: string;
  readonly exitTime: string;
  readonly entryPrice: number;
  readonly exitPrice: number;
  readonly sl: number;
  readonly tp: number;
  readonly riskAmount: number;
  readonly positionSize: number;
  readonly rr: number;
  readonly pnl: number;
  readonly returnPercent: number;
  readonly exitReason: BacktestTradeExitReason;
  readonly kalosConfidence: number;
  readonly kalosReasons: readonly string[];
}

export interface BacktestMetrics {
  readonly totalTrades: number;
  readonly winRate: number;
  readonly lossRate: number;
  readonly profitFactor: number;
  readonly expectancy: number;
  readonly maxDrawdown: number;
  readonly averageRR: number;
  readonly losingStreak: number;
  readonly winningStreak: number;
  readonly netProfit: number;
  readonly averageWin: number;
  readonly averageLoss: number;
}

export interface BacktestRecommendation {
  readonly severity: "info" | "warning" | "critical";
  readonly message: string;
}

export interface BacktestJournalEntry {
  readonly timestamp: string;
  readonly type: "BACKTEST_STARTED" | "SIGNAL_EVALUATED" | "TRADE_SIMULATED" | "NO_TRADE" | "BACKTEST_COMPLETED" | "BACKTEST_REJECTED";
  readonly message: string;
}

export interface BacktestReport {
  readonly id: string;
  readonly generatedAt: string;
  readonly request: BacktestRequest;
  readonly accepted: boolean;
  readonly dataSource: BacktestDataSource;
  readonly dataSourceMessage: string;
  readonly metrics: BacktestMetrics;
  readonly trades: readonly BacktestTrade[];
  readonly kalosSignals: readonly BacktestSignalRecord[];
  readonly noTrade: readonly BacktestNoTradeRecord[];
  readonly errors: readonly string[];
  readonly recommendations: readonly BacktestRecommendation[];
  readonly journal: readonly BacktestJournalEntry[];
  readonly disclaimer: "Backtest simulation only. No real execution.";
}

export interface BacktestRunResult {
  readonly report: BacktestReport;
  readonly candles: readonly BacktestCandle[];
  readonly replayFrames: readonly BacktestReplayFrame[];
}
