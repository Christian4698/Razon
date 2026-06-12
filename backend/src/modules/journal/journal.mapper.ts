import type { KalosOutput } from "../kalos";
import type { BacktestReport, BacktestTrade } from "../backtesting/backtest.types";
import type { JournalDecisionInput, JournalMode, JournalResult } from "./journal.types";

function rr(entry: number | null, stopLoss: number | null, takeProfit: number | null) {
  if (typeof entry !== "number" || typeof stopLoss !== "number" || typeof takeProfit !== "number") return null;
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  if (risk <= 0 || reward <= 0) return null;
  return Number((reward / risk).toFixed(4));
}

function backtestModeToJournalMode(mode: BacktestReport["request"]["mode"]): JournalMode {
  if (mode === "SCALPING") return "SCALPING";
  if (mode === "LONG_TERM") return "LONG_TERM";
  return "SHORT_TERM";
}

function resultFromTrade(trade: BacktestTrade | undefined): JournalResult | undefined {
  if (!trade) return undefined;

  return {
    status: trade.pnl > 0 ? "WIN" : trade.pnl < 0 ? "LOSS" : "BREAKEVEN",
    pnl: trade.pnl,
    exitReason: trade.exitReason,
    notes: "Simulated backtest trade result.",
  };
}

export interface MapKalosDecisionInput {
  readonly symbol: string;
  readonly timeframe: JournalDecisionInput["timeframe"];
  readonly mode: JournalMode;
  readonly output: KalosOutput;
  readonly data_source: JournalDecisionInput["data_source"];
  readonly trigger_module?: JournalDecisionInput["trigger_module"];
  readonly spread?: number | null;
  readonly slippage?: number | null;
  readonly entry?: number | null;
  readonly result?: JournalResult;
}

export function mapKalosDecision(input: MapKalosDecisionInput): JournalDecisionInput {
  const decision = input.output.signal === "NO_TRADE" ? "NO_TRADE" : input.output.signal;

  return {
    symbol: input.symbol,
    timeframe: input.timeframe,
    mode: input.mode,
    decision,
    confidence: input.output.confidence,
    risk_score: input.output.risk_score,
    validated_reasons: decision === "BUY" || decision === "SELL" ? input.output.reasons : [],
    rejected_reasons: decision === "WAIT" || decision === "NO_TRADE" ? input.output.reasons : [],
    entry: input.entry ?? null,
    stop_loss: input.output.sl,
    take_profit: input.output.tp,
    invalidation: input.output.invalidation,
    RR: rr(input.entry ?? null, input.output.sl, input.output.tp),
    spread: input.spread ?? null,
    slippage: input.slippage ?? null,
    volatility: input.output.volatility.level,
    data_source: input.data_source,
    trigger_module: input.trigger_module ?? "KALOS",
    result: input.result,
  };
}

export function mapBacktestReport(report: BacktestReport): readonly JournalDecisionInput[] {
  const tradeBySignalIndex = new Map(report.trades.map(trade => [trade.signalIndex, trade]));
  const noTradeIndexes = new Set(report.noTrade.map(item => item.index));

  return report.kalosSignals.map(signalRecord => {
    const trade = tradeBySignalIndex.get(signalRecord.index);
    const output = signalRecord.signal;
    const isNoTrade = noTradeIndexes.has(signalRecord.index) || output.signal === "WAIT" || output.signal === "NO_TRADE";
    const entry = trade?.entryPrice ?? null;

    return {
      ...mapKalosDecision({
        symbol: report.request.symbol,
        timeframe: report.request.timeframe,
        mode: backtestModeToJournalMode(report.request.mode),
        output,
        data_source: report.dataSource === "mock" ? "MOCK" : "DEMO",
        trigger_module: "BACKTEST",
        spread: report.request.simulatedSpread,
        slippage: report.request.simulatedSlippage,
        entry,
        result: resultFromTrade(trade),
      }),
      decision: isNoTrade ? output.signal : output.signal,
      rejected_reasons: isNoTrade ? output.reasons : [],
      validated_reasons: isNoTrade ? [] : output.reasons,
    };
  });
}
