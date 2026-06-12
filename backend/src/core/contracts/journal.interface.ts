import type { MarketAnalysisResult } from "./analysis.interface";
import type { RiskAssessment } from "../types/risk.types";
import type { TradingSignal } from "../types/signal.types";
import type { TradeOrder, TradePosition } from "../types/trade.types";

export type JournalEntryType =
  | "ANALYSIS"
  | "SIGNAL"
  | "RISK"
  | "ORDER"
  | "POSITION"
  | "NO_TRADE"
  | "SYSTEM";

export interface JournalEntry<TPayload = unknown> {
  readonly id: string;
  readonly type: JournalEntryType;
  readonly payload: TPayload;
  readonly createdAt: string;
}

export interface JournalQuery {
  readonly type?: JournalEntryType;
  readonly symbol?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
}

/**
 * Contract for append-only audit and learning records.
 */
export interface JournalWriter {
  readonly recordAnalysis: (analysis: MarketAnalysisResult) => Promise<JournalEntry<MarketAnalysisResult>>;
  readonly recordSignal: (signal: TradingSignal) => Promise<JournalEntry<TradingSignal>>;
  readonly recordRisk: (risk: RiskAssessment) => Promise<JournalEntry<RiskAssessment>>;
  readonly recordOrder: (order: TradeOrder) => Promise<JournalEntry<TradeOrder>>;
  readonly recordPosition: (position: TradePosition) => Promise<JournalEntry<TradePosition>>;
  readonly recordNoTrade: (signal: TradingSignal, risk?: RiskAssessment) => Promise<JournalEntry>;
}

export interface JournalReader {
  readonly find: (query: JournalQuery) => Promise<readonly JournalEntry[]>;
  readonly getById: (id: string) => Promise<JournalEntry | undefined>;
}

export interface JournalGateway extends JournalWriter, JournalReader {}
