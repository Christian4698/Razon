import type {
  AiAnalysisInput,
  AiImprovementReport,
  AiPattern,
  AiRecommendation,
  AiRecommendationExplanation,
  AiScoreAdjustment,
} from "./ai.types";
import { AiAuditService } from "./ai-audit.service";
import { AiRecommendationService, rulesNotToModify } from "./ai-recommendation.service";
import { ConfidenceLearningService } from "./confidence-learning.service";
import { PatternDiscoveryService } from "./pattern-discovery.service";

function now() {
  return new Date().toISOString();
}

function summarize(input: AiAnalysisInput, recommendations: readonly AiRecommendation[]) {
  const decisions = input.journal.length + input.noTradeDecisions.length;
  const trades = input.tradeResults.length;
  const backtests = input.backtests.length;

  return [
    `Analyzed ${decisions} decisions, ${trades} trade results and ${backtests} backtests.`,
    `Generated ${recommendations.length} advisory recommendations.`,
    "AI advises only; KALOS analyzes, Risk Engine protects, No-Trade Engine blocks.",
  ].join(" ");
}

export class AiService {
  private readonly patterns = new PatternDiscoveryService();
  private readonly confidenceLearning = new ConfidenceLearningService();
  private readonly recommendations = new AiRecommendationService();
  private readonly audit = new AiAuditService();

  analyzeJournal(input: AiAnalysisInput): AiImprovementReport {
    return this.generateImprovementReport(input);
  }

  detectWinningPatterns(input: AiAnalysisInput): readonly AiPattern[] {
    return this.patterns.detectWinningPatterns(input);
  }

  detectLosingPatterns(input: AiAnalysisInput): readonly AiPattern[] {
    return this.patterns.detectLosingPatterns(input);
  }

  suggestScoreAdjustments(input: AiAnalysisInput): readonly AiScoreAdjustment[] {
    return this.confidenceLearning.suggestScoreAdjustments(input);
  }

  explainRecommendation(recommendation: AiRecommendation): AiRecommendationExplanation {
    return this.recommendations.explainRecommendation(recommendation);
  }

  generateImprovementReport(input: AiAnalysisInput): AiImprovementReport {
    const winningPatterns = this.detectWinningPatterns(input);
    const losingPatterns = this.detectLosingPatterns(input);
    const scoreAdjustments = this.suggestScoreAdjustments(input);
    const recommendations = this.recommendations.createRecommendations(
      input,
      winningPatterns,
      losingPatterns,
      scoreAdjustments,
    );

    const auditTrail = [
      this.audit.createAuditRecord("AI_ANALYSIS_STARTED", [
        "Journal, backtests, trade results, NO_TRADE decisions and KALOS metrics loaded.",
      ]),
      this.audit.auditRecommendationSafety(),
      this.audit.createAuditRecord("AI_ANALYSIS_COMPLETED", [
        `${winningPatterns.length} winning patterns detected.`,
        `${losingPatterns.length} losing patterns detected.`,
        `${scoreAdjustments.length} score adjustments suggested for review only.`,
      ]),
    ];

    return {
      generatedAt: now(),
      summary: summarize(input, recommendations),
      winningPatterns,
      losingPatterns,
      scoreAdjustments,
      recommendations,
      auditTrail,
      rulesNotToModify,
      disclaimer: "AI advisory only. No execution, no guaranteed gain.",
    };
  }
}

export function createAiService() {
  return new AiService();
}
