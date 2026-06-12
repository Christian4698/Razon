import type {
  AiAnalysisInput,
  AiPattern,
  AiRecommendation,
  AiRecommendationExplanation,
  AiScoreAdjustment,
} from "./ai.types";

export const rulesNotToModify = [
  "Risk Engine remains mandatory.",
  "No-Trade Engine remains mandatory.",
  "Never increase risk automatically after a loss.",
  "Never allow martingale.",
  "Never execute when data source is MOCK.",
  "Never remove SL or TP requirements.",
  "Never promise gains or verified performance without evidence.",
];

function now() {
  return new Date().toISOString();
}

function recommendationId(prefix: string, index: number) {
  return `AI-${prefix}-${String(index + 1).padStart(3, "0")}`;
}

export class AiRecommendationService {
  createRecommendations(
    input: AiAnalysisInput,
    winningPatterns: readonly AiPattern[],
    losingPatterns: readonly AiPattern[],
    adjustments: readonly AiScoreAdjustment[],
  ): readonly AiRecommendation[] {
    const recommendations: AiRecommendation[] = [];

    adjustments.forEach((adjustment, index) => {
      recommendations.push({
        id: recommendationId("SCORE", index),
        category: adjustment.suggestedDelta === 0 ? "DATA_QUALITY" : "SCORING",
        action: adjustment.suggestedDelta === 0 ? "COLLECT_MORE_DATA" : "REVIEW_WEIGHT",
        title: adjustment.suggestedDelta === 0
          ? "Collect more validated samples"
          : `Review scoring for ${adjustment.target}`,
        reasons: [adjustment.reason, `${adjustment.evidenceCount} evidence samples.`],
        estimatedImpact: adjustment.evidenceCount >= 8 ? "MEDIUM" : "LOW",
        confidence: adjustment.confidence,
        risks: [
          "Small samples can overfit to recent market conditions.",
          "Manual review is required before changing KALOS weights.",
        ],
        rulesNotToModify,
        executionAllowed: false,
        createdAt: now(),
      });
    });

    losingPatterns.slice(0, 2).forEach((pattern, index) => {
      recommendations.push({
        id: recommendationId("FILTER", index),
        category: "NO_TRADE",
        action: "TIGHTEN_FILTER",
        title: `Review No-Trade filter for ${pattern.scope} ${pattern.key}`,
        reasons: pattern.reasons,
        estimatedImpact: pattern.sampleSize >= 5 ? "MEDIUM" : "LOW",
        confidence: Math.min(85, pattern.sampleSize * 12),
        risks: [
          "A stricter filter may reduce trade frequency.",
          "The AI cannot remove or weaken existing No-Trade rules.",
        ],
        rulesNotToModify,
        executionAllowed: false,
        createdAt: now(),
      });
    });

    if (input.drawdown.daily > 2 || input.drawdown.weekly > 5 || input.drawdown.total > 8) {
      recommendations.push({
        id: recommendationId("RISK", recommendations.length),
        category: "RISK_AWARENESS",
        action: "KEEP_RULE",
        title: "Keep drawdown protection strict",
        reasons: [
          `Drawdown snapshot daily=${input.drawdown.daily}, weekly=${input.drawdown.weekly}, total=${input.drawdown.total}.`,
          "Risk rules should remain protective even if signals look strong.",
        ],
        estimatedImpact: "HIGH",
        confidence: 82,
        risks: ["Disabling drawdown protection can expose capital to uncontrolled loss."],
        rulesNotToModify,
        executionAllowed: false,
        createdAt: now(),
      });
    }

    if (!recommendations.length && winningPatterns.length) {
      recommendations.push({
        id: recommendationId("KEEP", 0),
        category: "SCORING",
        action: "KEEP_RULE",
        title: "Keep current KALOS weights under observation",
        reasons: winningPatterns[0].reasons,
        estimatedImpact: "LOW",
        confidence: 60,
        risks: ["Positive patterns require more samples before any parameter change."],
        rulesNotToModify,
        executionAllowed: false,
        createdAt: now(),
      });
    }

    return recommendations.slice(0, 10);
  }

  explainRecommendation(recommendation: AiRecommendation): AiRecommendationExplanation {
    return {
      recommendationId: recommendation.id,
      summary: `${recommendation.title}. The AI advises review only and cannot execute or rewrite safeguards.`,
      evidence: recommendation.reasons,
      safeguards: [
        ...recommendation.rulesNotToModify,
        "Recommendation must be approved by a human before implementation.",
      ],
      executionAllowed: false,
    };
  }
}
