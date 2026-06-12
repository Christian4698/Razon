import type { Timeframe } from "../../core/types/timeframe.types";
import type { FuturePathEngineOutput } from "./future-path-engine";
import type { KalosMarketBrainOutput } from "./market-brain";
import type { MarketReplayOutput } from "./market-replay";

export type KalosSignal = "BUY" | "SELL" | "WAIT" | "NO_TRADE";

export type KalosMode = "SCALPING" | "SHORT_TERM" | "LONG_TERM";

export type KalosControlMode = "MANUAL" | "SEMI_AUTO" | "AUTO";

export type KalosAnalysisLayer = "HTF" | "MTF" | "LTF";

export type KalosBias = "BULLISH" | "BEARISH" | "NEUTRAL";

export type KalosVolatilityLevel = "LOW" | "NORMAL" | "HIGH" | "EXTREME";

export type KalosMarketStructureType =
  | "HH"
  | "HL"
  | "LH"
  | "LL"
  | "BOS"
  | "CHoCH"
  | "Breakout"
  | "Retest"
  | "Support"
  | "Resistance";

export type KalosSmartMoneyType =
  | "Liquidity Sweep"
  | "Buy Side Liquidity"
  | "Sell Side Liquidity"
  | "Order Block"
  | "Fair Value Gap"
  | "Strong High"
  | "Weak Low"
  | "Supply Zone"
  | "Demand Zone";

export type KalosOverlayObjectType = "LABEL" | "ARROW" | "SIGNAL_BALL" | "ZONE" | "LEVEL" | "PROJECTION";

export type KalosOverlayStatus = "ACCEPTED" | "REJECTED" | "NEUTRAL";

export type HistoricalTradeOutcome = "WIN" | "LOSS" | "BREAKEVEN" | "NO_TRADE";

export interface KalosCandle {
  readonly timestamp: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
}

export interface KalosLayerInput {
  readonly layer: KalosAnalysisLayer;
  readonly timeframe: Timeframe;
  readonly candles: readonly KalosCandle[];
  readonly currentPrice?: number;
}

export interface HistoricalCalibrationSample {
  readonly symbol?: string;
  readonly mode?: KalosMode;
  readonly signal: KalosSignal;
  readonly confidence: number;
  readonly outcome: HistoricalTradeOutcome;
  readonly createdAt?: string;
}

export interface HistoricalCalibration {
  readonly sampleSize: number;
  readonly winRate: number | null;
  readonly reliability: "LOW" | "MEDIUM" | "HIGH";
  readonly confidenceAdjustment: number;
  readonly reasons: readonly string[];
}

export interface KalosInput {
  readonly symbol: string;
  readonly mode: KalosMode;
  readonly controlMode?: KalosControlMode;
  readonly layers: readonly KalosLayerInput[];
  readonly historicalSamples?: readonly HistoricalCalibrationSample[];
  readonly dataFreshness?: {
    readonly checkedAt: string;
    readonly maxAgeMs: number;
    readonly enforce: boolean;
  };
}

export interface FeatureVote {
  readonly feature: string;
  readonly layer: KalosAnalysisLayer;
  readonly bias: KalosBias;
  readonly score: number;
  readonly confidenceImpact: number;
  readonly riskImpact: number;
  readonly reasons: readonly string[];
}

export interface VolatilityReading {
  readonly level: KalosVolatilityLevel;
  readonly atr: number | null;
  readonly atrPercent: number | null;
  readonly riskImpact: number;
  readonly reasons: readonly string[];
}

export interface EntryScoreReading {
  readonly score: number;
  readonly bias: KalosBias;
  readonly reasons: readonly string[];
}

export interface NoTradeReading {
  readonly blocked: boolean;
  readonly reasons: readonly string[];
  readonly riskImpact: number;
}

export interface KalosLayerAnalysis {
  readonly layer: KalosAnalysisLayer;
  readonly timeframe: Timeframe;
  readonly price: number | null;
  readonly structureDetections: readonly KalosMarketStructureDetection[];
  readonly smartMoneyDetections: readonly KalosSmartMoneyDetection[];
  readonly marketStructure: FeatureVote;
  readonly liquidity: FeatureVote;
  readonly trend: FeatureVote;
  readonly momentum: FeatureVote;
  readonly volatility: VolatilityReading;
  readonly entryScore: EntryScoreReading;
  readonly noTrade: NoTradeReading;
}

export interface KalosMarketStructureDetection {
  readonly type: KalosMarketStructureType;
  readonly layer: KalosAnalysisLayer;
  readonly timestamp: string;
  readonly price: number;
  readonly bias: KalosBias;
  readonly confidence: number;
  readonly reason: string;
}

export interface KalosSmartMoneyDetection {
  readonly type: KalosSmartMoneyType;
  readonly layer: KalosAnalysisLayer;
  readonly timestamp: string;
  readonly price: number;
  readonly priceTo?: number;
  readonly bias: KalosBias;
  readonly confidence: number;
  readonly reason: string;
}

export interface KalosOverlayObject {
  readonly id: string;
  readonly type: KalosOverlayObjectType;
  readonly label: string;
  readonly layer?: KalosAnalysisLayer;
  readonly timestamp?: string;
  readonly fromTimestamp?: string;
  readonly toTimestamp?: string;
  readonly price?: number;
  readonly fromPrice?: number;
  readonly toPrice?: number;
  readonly direction?: "BUY" | "SELL";
  readonly status: KalosOverlayStatus;
  readonly color: string;
  readonly reason: string;
}

export interface KalosOutput {
  readonly symbol: string;
  readonly mode: KalosMode;
  readonly controlMode: KalosControlMode;
  readonly signal: KalosSignal;
  readonly decision: KalosSignal;
  readonly confidence: number;
  readonly reasons: readonly string[];
  readonly rejectedReasons: readonly string[];
  readonly tp: number | null;
  readonly sl: number | null;
  readonly invalidation: number | null;
  readonly trend: KalosBias;
  readonly volatility: VolatilityReading;
  readonly risk_score: number;
  readonly riskScore: number;
  readonly overlayObjects: readonly KalosOverlayObject[];
  readonly marketBrain: KalosMarketBrainOutput;
  readonly futurePath: FuturePathEngineOutput;
  readonly marketReplay: MarketReplayOutput;
  readonly marketStructureDetections: readonly KalosMarketStructureDetection[];
  readonly smartMoneyDetections: readonly KalosSmartMoneyDetection[];
  readonly analysis: readonly KalosLayerAnalysis[];
  readonly calibration: HistoricalCalibration;
  readonly generatedAt: string;
  readonly disclaimer: "Probability-based analysis only. No real execution.";
}
