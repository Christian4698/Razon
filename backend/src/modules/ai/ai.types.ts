export type AiMode = "SCALPING" | "SHORT_TERM" | "LONG_TERM";

export type AiDecision = "BUY" | "SELL" | "WAIT" | "NO_TRADE";

export type AiOutcome = "WIN" | "LOSS" | "BREAKEVEN" | "PENDING" | "REJECTED" | "NO_TRADE";

export type AiRecommendationCategory =
  | "SCORING"
  | "NO_TRADE"
  | "RISK_AWARENESS"
  | "DATA_QUALITY"
  | "JOURNALING";

export type AiRecommendationAction =
  | "REVIEW_WEIGHT"
  | "TIGHTEN_FILTER"
  | "COLLECT_MORE_DATA"
  | "KEEP_RULE";

export type AiPatternType = "WINNING" | "LOSING";

export type AiPatternScope = "symbol" | "timeframe" | "mode" | "decision" | "reason";

export interface AiJournalEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly mode: AiMode;
  readonly decision: AiDecision;
  readonly confidence: number;
  readonly risk_score: number;
  readonly reasons: readonly string[];
  readonly rejectedReasons?: readonly string[];
  readonly rr?: number | null;
  readonly pnl?: number | null;
  readonly outcome?: AiOutcome;
}

export interface AiBacktestSummary {
  readonly id: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly mode: AiMode;
  readonly totalTrades: number;
  readonly winRate: number;
  readonly lossRate: number;
  readonly profitFactor: number;
  readonly expectancy: number;
  readonly maxDrawdown: number;
  readonly averageRR: number;
}

export interface AiTradeResult {
  readonly id: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly mode: AiMode;
  readonly decision: Extract<AiDecision, "BUY" | "SELL">;
  readonly confidence: number;
  readonly risk_score: number;
  readonly rr: number;
  readonly pnl: number;
  readonly outcome: Extract<AiOutcome, "WIN" | "LOSS" | "BREAKEVEN">;
  readonly reasons: readonly string[];
}

export interface AiNoTradeDecision {
  readonly id: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly mode: AiMode;
  readonly confidence: number;
  readonly risk_score: number;
  readonly reasons: readonly string[];
}

export interface AiKalosMetric {
  readonly feature: string;
  readonly weight: number;
  readonly averageConfidence: number;
  readonly winRate: number | null;
  readonly sampleSize: number;
}

export interface AiDrawdownSnapshot {
  readonly daily: number;
  readonly weekly: number;
  readonly total: number;
}

export interface AiPerformanceBucket {
  readonly key: string;
  readonly totalTrades: number;
  readonly winRate: number;
  readonly expectancy: number;
  readonly maxDrawdown: number;
}

export interface AiAnalysisInput {
  readonly journal: readonly AiJournalEntry[];
  readonly backtests: readonly AiBacktestSummary[];
  readonly tradeResults: readonly AiTradeResult[];
  readonly noTradeDecisions: readonly AiNoTradeDecision[];
  readonly kalosMetrics: readonly AiKalosMetric[];
  readonly drawdown: AiDrawdownSnapshot;
  readonly performanceBySymbol: readonly AiPerformanceBucket[];
  readonly performanceByTimeframe: readonly AiPerformanceBucket[];
  readonly performanceByMode: readonly AiPerformanceBucket[];
}

export interface AiOutcomeSample {
  readonly id: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly mode: AiMode;
  readonly decision: AiDecision;
  readonly confidence: number;
  readonly riskScore: number;
  readonly rr: number | null;
  readonly pnl: number | null;
  readonly outcome: AiOutcome;
  readonly reasons: readonly string[];
}

export interface AiPattern {
  readonly id: string;
  readonly type: AiPatternType;
  readonly scope: AiPatternScope;
  readonly key: string;
  readonly sampleSize: number;
  readonly winRate: number;
  readonly lossRate: number;
  readonly expectancy: number;
  readonly averageConfidence: number;
  readonly reasons: readonly string[];
}

export interface AiScoreAdjustment {
  readonly target: string;
  readonly suggestedDelta: number;
  readonly confidence: number;
  readonly evidenceCount: number;
  readonly reason: string;
  readonly safetyNotes: readonly string[];
  readonly autoApply: false;
}

export interface AiRecommendation {
  readonly id: string;
  readonly category: AiRecommendationCategory;
  readonly action: AiRecommendationAction;
  readonly title: string;
  readonly reasons: readonly string[];
  readonly estimatedImpact: "LOW" | "MEDIUM" | "HIGH";
  readonly confidence: number;
  readonly risks: readonly string[];
  readonly rulesNotToModify: readonly string[];
  readonly executionAllowed: false;
  readonly createdAt: string;
}

export interface AiRecommendationExplanation {
  readonly recommendationId: string;
  readonly summary: string;
  readonly evidence: readonly string[];
  readonly safeguards: readonly string[];
  readonly executionAllowed: false;
}

export interface AiAuditRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly event: string;
  readonly details: readonly string[];
  readonly forbiddenActionsChecked: readonly string[];
}

export interface AiImprovementReport {
  readonly generatedAt: string;
  readonly summary: string;
  readonly winningPatterns: readonly AiPattern[];
  readonly losingPatterns: readonly AiPattern[];
  readonly scoreAdjustments: readonly AiScoreAdjustment[];
  readonly recommendations: readonly AiRecommendation[];
  readonly auditTrail: readonly AiAuditRecord[];
  readonly rulesNotToModify: readonly string[];
  readonly disclaimer: "AI advisory only. No execution, no guaranteed gain.";
}
