import type { KalosBias, KalosCandle, KalosSignal, KalosVolatilityLevel } from "../kalos.types";

export const KALOS_MARKET_REPLAY_NAME = "market-replay" as const;

export type MarketReplayControlAction = "PLAY" | "REWIND" | "FAST_FORWARD" | "PAUSE";

export type MarketReplayDirection = "UP" | "DOWN" | "FLAT";

export type MarketReplayOutcome = "WIN_SIMULATION" | "LOSS_SIMULATION" | "NO_TRADE_SIMULATION";

export interface MarketReplayInput {
  readonly symbol: string;
  readonly timeframe: string;
  readonly candles: readonly KalosCandle[];
  readonly prediction: KalosSignal;
  readonly confidence: number;
  readonly trend: KalosBias;
  readonly volatility: KalosVolatilityLevel;
  readonly tp: number | null;
  readonly sl: number | null;
  readonly invalidation: number | null;
  readonly reasons: readonly string[];
  readonly riskScore: number;
}

export interface MarketReplayPrediction {
  readonly signal: KalosSignal;
  readonly confidence: number;
  readonly seenPrice: number;
  readonly seenTrend: KalosBias;
  readonly seenVolatility: KalosVolatilityLevel;
  readonly kalosSaw: readonly string[];
}

export interface MarketReplayActualResult {
  readonly closePrice: number;
  readonly movement: number;
  readonly direction: MarketReplayDirection;
  readonly outcome: MarketReplayOutcome;
}

export interface MarketReplayDifference {
  readonly expectedDirection: MarketReplayDirection;
  readonly actualDirection: MarketReplayDirection;
  readonly matched: boolean;
  readonly priceDelta: number;
  readonly note: string;
}

export interface MarketReplayFrame {
  readonly index: number;
  readonly timestamp: string;
  readonly prediction: MarketReplayPrediction;
  readonly actualResult: MarketReplayActualResult;
  readonly difference: MarketReplayDifference;
}

export interface MarketReplayMetrics {
  readonly winSimulation: number;
  readonly lossSimulation: number;
  readonly drawdown: number;
  readonly precision: number;
}

export interface MarketReplayOutput {
  readonly module: typeof KALOS_MARKET_REPLAY_NAME;
  readonly symbol: string;
  readonly timeframe: string;
  readonly controls: readonly MarketReplayControlAction[];
  readonly frames: readonly MarketReplayFrame[];
  readonly metrics: MarketReplayMetrics;
  readonly liveExecutionAllowed: false;
  readonly disclaimer: "Replay simulation only. No real execution.";
}
