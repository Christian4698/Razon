import type { MarketAnalysisResult } from "./analysis.interface";
import type { ConfidenceScore, SignalAction, SignalReason } from "../types/signal.types";

export interface ProbabilityInput {
  readonly analysis: MarketAnalysisResult;
  readonly historicalWinRate?: number;
  readonly historicalSampleSize?: number;
  readonly riskPenalty?: number;
}

export interface ProbabilityEstimate {
  readonly action: SignalAction;
  readonly confidence: ConfidenceScore;
  readonly probability: number;
  readonly reasons: readonly SignalReason[];
  readonly estimatedAt: string;
}

/**
 * Contract for future probability estimation.
 * Implementations must keep confidence bounded and explainable.
 */
export interface ProbabilityEngine {
  readonly estimate: (input: ProbabilityInput) => Promise<ProbabilityEstimate>;
}
