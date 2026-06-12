import type { Timeframe } from "../../core/types/timeframe.types";
import type { AuditTrailEvent, CreateAuditEventInput } from "./audit.types";
import type { BacktestReport, BacktestTrade } from "../backtesting/backtest.types";

export type JournalMode = "SCALPING" | "SHORT_TERM" | "LONG_TERM";

export type JournalDecision = "BUY" | "SELL" | "WAIT" | "NO_TRADE";

export type JournalDataSource = "LIVE" | "DEMO" | "MOCK";

export type JournalTriggerModule = "KALOS" | "BACKTEST" | "MANUAL" | "AUTO";

export type JournalEntryType = "DECISION" | "TRADE" | "NO_TRADE" | "BACKTEST" | "ERROR";

export interface JournalResult {
  readonly status: "WIN" | "LOSS" | "BREAKEVEN" | "PENDING" | "REJECTED" | "ERROR";
  readonly pnl?: number;
  readonly exitReason?: string;
  readonly notes?: string;
}

export interface JournalErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly stack?: string;
  readonly recoverable?: boolean;
}

export interface JournalDecisionInput {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly mode: JournalMode;
  readonly decision: JournalDecision;
  readonly confidence: number;
  readonly risk_score: number;
  readonly validated_reasons: readonly string[];
  readonly rejected_reasons: readonly string[];
  readonly entry: number | null;
  readonly stop_loss: number | null;
  readonly take_profit: number | null;
  readonly invalidation: number | null;
  readonly RR: number | null;
  readonly spread: number | null;
  readonly slippage: number | null;
  readonly volatility: string | number | null;
  readonly data_source: JournalDataSource;
  readonly trigger_module: JournalTriggerModule;
  readonly result?: JournalResult;
  readonly error?: JournalErrorPayload;
  readonly audit?: readonly CreateAuditEventInput[];
}

export interface JournalDecisionRecord extends JournalDecisionInput {
  readonly id: string;
  readonly type: JournalEntryType;
  readonly date_time: string;
  readonly audit_trail: readonly AuditTrailEvent[];
}

export interface JournalTradeInput {
  readonly decision: JournalDecisionInput;
  readonly trade: BacktestTrade | Readonly<Record<string, unknown>>;
}

export interface JournalBacktestInput {
  readonly report: BacktestReport;
}

export interface JournalErrorInput {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly mode: JournalMode;
  readonly trigger_module: JournalTriggerModule;
  readonly error: JournalErrorPayload;
  readonly data_source?: JournalDataSource;
  readonly availableData?: readonly string[];
}

export interface JournalQuery {
  readonly type?: JournalEntryType;
  readonly symbol?: string;
  readonly decision?: JournalDecision;
  readonly trigger_module?: JournalTriggerModule;
  readonly data_source?: JournalDataSource;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
}

export interface PerformanceSummary {
  readonly totalDecisions: number;
  readonly buyCount: number;
  readonly sellCount: number;
  readonly waitCount: number;
  readonly noTradeCount: number;
  readonly averageConfidence: number;
  readonly averageRiskScore: number;
  readonly wins: number;
  readonly losses: number;
  readonly netPnl: number;
  readonly winRate: number;
  readonly errors: number;
}
