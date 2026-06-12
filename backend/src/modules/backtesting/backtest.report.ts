import { calculateMetrics } from "./backtest.metrics";
import type {
  BacktestDataSource,
  BacktestJournalEntry,
  BacktestMetrics,
  BacktestNoTradeRecord,
  BacktestRecommendation,
  BacktestReport,
  BacktestRequest,
  BacktestSignalRecord,
  BacktestTrade,
} from "./backtest.types";

function createReportId(symbol: string) {
  return `bt-${symbol.replace(/[^a-z0-9]/gi, "").toLowerCase()}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function recommendationsFor(metrics: BacktestMetrics, noTradeCount: number): readonly BacktestRecommendation[] {
  const recommendations: BacktestRecommendation[] = [];

  if (metrics.totalTrades === 0) {
    recommendations.push({
      severity: "critical",
      message: "No simulated trade was produced. Review data quality, timeframe, or KALOS thresholds.",
    });
  }

  if (metrics.profitFactor > 0 && metrics.profitFactor < 1.2) {
    recommendations.push({
      severity: "warning",
      message: "Profit factor is weak. Strategy should stay in simulation.",
    });
  }

  if (metrics.maxDrawdown > Math.abs(metrics.netProfit) && metrics.totalTrades > 0) {
    recommendations.push({
      severity: "warning",
      message: "Drawdown is large compared with net profit. Risk settings need review.",
    });
  }

  if (metrics.losingStreak >= 4) {
    recommendations.push({
      severity: "warning",
      message: "Long losing streak detected. Consider tighter NO_TRADE filters.",
    });
  }

  if (noTradeCount > metrics.totalTrades * 3) {
    recommendations.push({
      severity: "info",
      message: "NO_TRADE frequency is high. This may be healthy if the objective is capital protection.",
    });
  }

  recommendations.push({
    severity: "info",
    message: "Backtest is a simulation only. It must not be used as permission for real execution.",
  });

  return recommendations;
}

export interface GenerateReportInput {
  readonly request: BacktestRequest;
  readonly accepted: boolean;
  readonly dataSource: BacktestDataSource;
  readonly dataSourceMessage: string;
  readonly trades: readonly BacktestTrade[];
  readonly kalosSignals: readonly BacktestSignalRecord[];
  readonly noTrade: readonly BacktestNoTradeRecord[];
  readonly errors: readonly string[];
  readonly journal: readonly BacktestJournalEntry[];
}

export function generateReport(input: GenerateReportInput): BacktestReport {
  const metrics = calculateMetrics(input.trades);
  const generatedAt = new Date().toISOString();

  return {
    id: createReportId(input.request.symbol),
    generatedAt,
    request: input.request,
    accepted: input.accepted,
    dataSource: input.dataSource,
    dataSourceMessage: input.dataSourceMessage,
    metrics,
    trades: input.trades,
    kalosSignals: input.kalosSignals,
    noTrade: input.noTrade,
    errors: input.errors,
    recommendations: recommendationsFor(metrics, input.noTrade.length),
    journal: input.journal,
    disclaimer: "Backtest simulation only. No real execution.",
  };
}
