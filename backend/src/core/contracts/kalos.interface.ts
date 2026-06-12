import type { MarketAnalysisResult } from "./analysis.interface";
import type { ProbabilityEstimate } from "./probability.interface";
import type { RiskAssessment } from "../types/risk.types";
import type { ConfidenceScore, PriceLevel, SignalAction, SignalReason } from "../types/signal.types";
import type { Timeframe } from "../types/timeframe.types";

export interface KalosInput {
  readonly analysis: MarketAnalysisResult;
  readonly probability?: ProbabilityEstimate;
  readonly risk?: RiskAssessment;
}

export interface KalosSignal {
  readonly signal: SignalAction;
  readonly confidence: ConfidenceScore;
  readonly tp?: PriceLevel;
  readonly sl?: PriceLevel;
  readonly invalidation?: string;
  readonly reasons: readonly SignalReason[];
  readonly timeframe: Timeframe;
  readonly volatility?: number;
}

export interface KalosOpportunity extends KalosSignal {
  readonly id: string;
  readonly symbol: string;
  readonly entry?: PriceLevel;
  readonly riskRewardRatio?: number;
  readonly expectedDuration?: string;
  readonly score: number;
}

export interface KalosResult {
  readonly primary: KalosSignal;
  readonly opportunities: readonly KalosOpportunity[];
  readonly generatedAt: string;
}

/**
 * Contract for the future proprietary KALOS engine.
 * This file defines shape only; it contains no scoring logic.
 */
export interface KalosEngine {
  readonly evaluate: (input: KalosInput) => Promise<KalosResult>;
}
