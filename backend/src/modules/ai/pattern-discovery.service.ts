import type {
  AiAnalysisInput,
  AiDecision,
  AiOutcome,
  AiOutcomeSample,
  AiPattern,
  AiPatternScope,
} from "./ai.types";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function outcomeFromPnl(pnl: number | null | undefined, fallback: AiOutcome | undefined): AiOutcome {
  if (fallback) return fallback;
  if (typeof pnl !== "number") return "PENDING";
  if (pnl > 0) return "WIN";
  if (pnl < 0) return "LOSS";
  return "BREAKEVEN";
}

function sampleWon(sample: AiOutcomeSample) {
  return sample.outcome === "WIN";
}

function sampleLost(sample: AiOutcomeSample) {
  return sample.outcome === "LOSS";
}

function average(values: readonly number[]) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export class PatternDiscoveryService {
  buildOutcomeSamples(input: AiAnalysisInput): readonly AiOutcomeSample[] {
    const journalSamples = input.journal.map(entry => ({
      id: entry.id,
      symbol: entry.symbol,
      timeframe: entry.timeframe,
      mode: entry.mode,
      decision: entry.decision,
      confidence: entry.confidence,
      riskScore: entry.risk_score,
      rr: entry.rr ?? null,
      pnl: entry.pnl ?? null,
      outcome: outcomeFromPnl(entry.pnl, entry.outcome),
      reasons: [...entry.reasons, ...(entry.rejectedReasons ?? [])],
    }));

    const tradeSamples = input.tradeResults.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      timeframe: trade.timeframe,
      mode: trade.mode,
      decision: trade.decision,
      confidence: trade.confidence,
      riskScore: trade.risk_score,
      rr: trade.rr,
      pnl: trade.pnl,
      outcome: trade.outcome,
      reasons: trade.reasons,
    }));

    const noTradeSamples = input.noTradeDecisions.map(decision => ({
      id: decision.id,
      symbol: decision.symbol,
      timeframe: decision.timeframe,
      mode: decision.mode,
      decision: "NO_TRADE" as AiDecision,
      confidence: decision.confidence,
      riskScore: decision.risk_score,
      rr: null,
      pnl: null,
      outcome: "NO_TRADE" as AiOutcome,
      reasons: decision.reasons,
    }));

    return [...journalSamples, ...tradeSamples, ...noTradeSamples];
  }

  detectWinningPatterns(input: AiAnalysisInput): readonly AiPattern[] {
    return this.detectPatterns(input, "WINNING");
  }

  detectLosingPatterns(input: AiAnalysisInput): readonly AiPattern[] {
    return this.detectPatterns(input, "LOSING");
  }

  private detectPatterns(input: AiAnalysisInput, type: "WINNING" | "LOSING") {
    const samples = this.buildOutcomeSamples(input).filter(sample => sample.outcome !== "PENDING");
    const groups = [
      ...this.groupBy(samples, "symbol", sample => sample.symbol),
      ...this.groupBy(samples, "timeframe", sample => sample.timeframe),
      ...this.groupBy(samples, "mode", sample => sample.mode),
      ...this.groupBy(samples, "decision", sample => sample.decision),
      ...this.groupBy(samples, "reason", sample => sample.reasons[0] ?? "no reason"),
    ];

    return groups
      .map(group => this.toPattern(group.scope, group.key, group.samples, type))
      .filter((pattern): pattern is AiPattern => Boolean(pattern))
      .sort((a, b) => b.sampleSize - a.sampleSize)
      .slice(0, 8);
  }

  private groupBy(
    samples: readonly AiOutcomeSample[],
    scope: AiPatternScope,
    selectKey: (sample: AiOutcomeSample) => string,
  ) {
    const groups = new Map<string, AiOutcomeSample[]>();

    for (const sample of samples) {
      const key = selectKey(sample);
      const current = groups.get(key) ?? [];
      current.push(sample);
      groups.set(key, current);
    }

    return [...groups.entries()].map(([key, groupedSamples]) => ({
      scope,
      key,
      samples: groupedSamples,
    }));
  }

  private toPattern(
    scope: AiPatternScope,
    key: string,
    samples: readonly AiOutcomeSample[],
    type: "WINNING" | "LOSING",
  ): AiPattern | null {
    if (samples.length < 2 && scope !== "decision") return null;

    const wins = samples.filter(sampleWon).length;
    const losses = samples.filter(sampleLost).length;
    const winRate = clampPercent((wins / samples.length) * 100);
    const lossRate = clampPercent((losses / samples.length) * 100);
    const expectancy = average(samples.map(sample => sample.pnl ?? 0));
    const averageConfidence = clampPercent(average(samples.map(sample => sample.confidence)));

    if (type === "WINNING" && winRate < 55 && expectancy <= 0) return null;
    if (type === "LOSING" && lossRate < 45 && expectancy >= 0) return null;

    return {
      id: `${type.toLowerCase()}-${scope}-${key.replace(/\W+/g, "-").toLowerCase()}`,
      type,
      scope,
      key,
      sampleSize: samples.length,
      winRate,
      lossRate,
      expectancy: Number(expectancy.toFixed(2)),
      averageConfidence,
      reasons: [
        `${samples.length} samples grouped by ${scope}.`,
        `Win rate ${winRate} percent, loss rate ${lossRate} percent.`,
        `Average confidence ${averageConfidence} percent.`,
      ],
    };
  }
}
