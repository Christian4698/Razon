import type {
  AiAnalysisInput,
  AiPattern,
  AiScoreAdjustment,
} from "./ai.types";
import { PatternDiscoveryService } from "./pattern-discovery.service";

const lockedSafetyNotes = [
  "Do not increase risk automatically.",
  "Do not bypass Risk Engine.",
  "Do not bypass No-Trade Engine.",
  "Do not auto-apply score changes.",
];

function clampDelta(value: number) {
  return Math.max(-10, Math.min(10, Math.round(value)));
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(90, Math.round(value)));
}

export class ConfidenceLearningService {
  private readonly patterns = new PatternDiscoveryService();

  suggestScoreAdjustments(input: AiAnalysisInput): readonly AiScoreAdjustment[] {
    const winningPatterns = this.patterns.detectWinningPatterns(input);
    const losingPatterns = this.patterns.detectLosingPatterns(input);
    const metricAdjustments = input.kalosMetrics
      .filter(metric => metric.sampleSize >= 3 && metric.winRate !== null)
      .map(metric => this.metricAdjustment(metric.feature, metric.weight, metric.winRate ?? 0, metric.sampleSize));

    const patternAdjustments = [
      ...winningPatterns.slice(0, 3).map(pattern => this.patternAdjustment(pattern, 3)),
      ...losingPatterns.slice(0, 3).map(pattern => this.patternAdjustment(pattern, -4)),
    ];

    const dataQualityAdjustment = input.journal.length + input.tradeResults.length < 10
      ? [
          {
            target: "dataset_size",
            suggestedDelta: 0,
            confidence: 70,
            evidenceCount: input.journal.length + input.tradeResults.length,
            reason: "Collect more journal and trade samples before changing KALOS weights.",
            safetyNotes: lockedSafetyNotes,
            autoApply: false as const,
          },
        ]
      : [];

    return [...metricAdjustments, ...patternAdjustments, ...dataQualityAdjustment].slice(0, 8);
  }

  private metricAdjustment(
    feature: string,
    currentWeight: number,
    winRate: number,
    sampleSize: number,
  ): AiScoreAdjustment {
    const suggestedDelta = winRate >= 60 ? 2 : winRate <= 42 ? -3 : 0;

    return {
      target: `kalos.${feature}.weight`,
      suggestedDelta: clampDelta(suggestedDelta),
      confidence: clampConfidence(sampleSize * 8),
      evidenceCount: sampleSize,
      reason: `Feature ${feature} has win rate ${winRate} percent at current weight ${currentWeight}.`,
      safetyNotes: lockedSafetyNotes,
      autoApply: false,
    };
  }

  private patternAdjustment(pattern: AiPattern, baseDelta: number): AiScoreAdjustment {
    const confidence = clampConfidence(pattern.sampleSize * 12);
    const direction = baseDelta > 0 ? "review positive weight" : "review stricter filtering";

    return {
      target: `${pattern.scope}.${pattern.key}`,
      suggestedDelta: clampDelta(baseDelta),
      confidence,
      evidenceCount: pattern.sampleSize,
      reason: `${direction} because ${pattern.type.toLowerCase()} pattern has expectancy ${pattern.expectancy}.`,
      safetyNotes: lockedSafetyNotes,
      autoApply: false,
    };
  }
}
