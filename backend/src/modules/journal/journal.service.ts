import { AuditService } from "./audit.service";
import { mapBacktestReport } from "./journal.mapper";
import { InMemoryJournalRepository, type JournalRepository } from "./journal.repository";
import type { AuditTrailEvent, CreateAuditEventInput } from "./audit.types";
import type {
  JournalBacktestInput,
  JournalDecisionInput,
  JournalDecisionRecord,
  JournalErrorInput,
  JournalQuery,
  JournalTradeInput,
  PerformanceSummary,
} from "./journal.types";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function availableDataFor(input: JournalDecisionInput): readonly string[] {
  const available: string[] = ["symbol", "timeframe", "mode", "decision", "confidence", "risk_score"];

  if (typeof input.entry === "number") available.push("entry");
  if (typeof input.stop_loss === "number") available.push("stop_loss");
  if (typeof input.take_profit === "number") available.push("take_profit");
  if (typeof input.invalidation === "number") available.push("invalidation");
  if (typeof input.RR === "number") available.push("RR");
  if (typeof input.spread === "number") available.push("spread");
  if (typeof input.slippage === "number") available.push("slippage");
  if (input.volatility !== null) available.push("volatility");
  if (input.result) available.push("result");
  if (input.error) available.push("error");

  return available;
}

function blockingRuleFor(input: JournalDecisionInput) {
  if (input.error) return input.error.code;
  if (input.decision === "NO_TRADE") return input.rejected_reasons[0] ?? "NO_TRADE";
  if (input.decision === "WAIT") return input.rejected_reasons[0] ?? "WAIT";
  return undefined;
}

function defaultAuditInputs(journalId: string, input: JournalDecisionInput): readonly CreateAuditEventInput[] {
  const availableData = availableDataFor(input);
  const decisionIsRefusal = input.decision === "WAIT" || input.decision === "NO_TRADE" || Boolean(input.error);
  const events: CreateAuditEventInput[] = [
    {
      journalId,
      eventType: "DATA_AVAILABLE",
      message: `Data available for ${input.symbol}: ${availableData.join(", ")}.`,
      availableData,
      metadata: {
        data_source: input.data_source,
        trigger_module: input.trigger_module,
      },
    },
    {
      journalId,
      eventType: "SCORE_CALCULATED",
      message: `Confidence ${input.confidence} and risk score ${input.risk_score} calculated.`,
      availableData,
      calculatedScore: input.confidence,
      metadata: {
        risk_score: input.risk_score,
        RR: input.RR,
      },
    },
    {
      journalId,
      eventType: decisionIsRefusal ? "DECISION_REFUSED" : "DECISION_ACCEPTED",
      severity: decisionIsRefusal ? "warning" : "info",
      message: decisionIsRefusal
        ? `Razon refused or paused action with ${input.decision}.`
        : `Razon accepted analytical decision ${input.decision}.`,
      availableData,
      calculatedScore: input.confidence,
      blockingRule: blockingRuleFor(input),
    },
  ];

  const blockingRule = blockingRuleFor(input);
  if (blockingRule) {
    events.push({
      journalId,
      eventType: "RULE_BLOCKED",
      severity: input.error ? "critical" : "warning",
      message: `Blocking rule: ${blockingRule}.`,
      availableData,
      calculatedScore: input.risk_score,
      blockingRule,
    });
  }

  if (input.error) {
    events.push({
      journalId,
      eventType: "ERROR_LOGGED",
      severity: "critical",
      message: input.error.message,
      availableData,
      blockingRule: input.error.code,
      metadata: {
        recoverable: input.error.recoverable,
      },
    });
  }

  return events;
}

export interface JournalServiceOptions {
  readonly repository?: JournalRepository;
}

export class JournalService {
  private readonly repository: JournalRepository;
  private readonly auditService: AuditService;

  constructor(options: JournalServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryJournalRepository();
    this.auditService = new AuditService(this.repository);
  }

  async logDecision(input: JournalDecisionInput): Promise<JournalDecisionRecord> {
    const id = createId("journal");
    const auditInputs = [...defaultAuditInputs(id, input), ...(input.audit ?? [])];
    const auditTrail: AuditTrailEvent[] = auditInputs.map(event =>
      this.auditService.createEvent({
        ...event,
        journalId: id,
      })
    );
    const type = input.error ? "ERROR" : input.decision === "NO_TRADE" ? "NO_TRADE" : "DECISION";
    const record: JournalDecisionRecord = {
      ...input,
      id,
      type,
      date_time: now(),
      audit_trail: auditTrail,
    };

    return this.repository.append(record);
  }

  async logTrade(input: JournalTradeInput): Promise<JournalDecisionRecord> {
    return this.logDecision({
      ...input.decision,
      trigger_module: input.decision.trigger_module,
      audit: [
        ...(input.decision.audit ?? []),
        {
          journalId: "pending",
          eventType: "TRADE_LOGGED",
          message: "Trade was journaled as a simulated or external result. No execution was performed by Journal Engine.",
          availableData: ["trade", "decision"],
          metadata: {
            trade: input.trade,
          },
        },
      ],
    });
  }

  async logNoTrade(input: Omit<JournalDecisionInput, "decision">): Promise<JournalDecisionRecord> {
    return this.logDecision({
      ...input,
      decision: "NO_TRADE",
    });
  }

  async logBacktest(input: JournalBacktestInput): Promise<readonly JournalDecisionRecord[]> {
    const mapped = mapBacktestReport(input.report);

    if (mapped.length === 0) {
      const record = await this.logError({
        symbol: input.report.request.symbol,
        timeframe: input.report.request.timeframe,
        mode: input.report.request.mode,
        trigger_module: "BACKTEST",
        data_source: input.report.dataSource === "mock" ? "MOCK" : "DEMO",
        availableData: ["backtest_report"],
        error: {
          code: input.report.accepted ? "BACKTEST_EMPTY" : "BACKTEST_REJECTED",
          message: input.report.errors.join(" ") || "Backtest produced no KALOS signal to journal.",
          recoverable: true,
        },
      });

      return [record];
    }

    const records: JournalDecisionRecord[] = [];
    for (const decision of mapped) {
      const record = await this.logDecision({
        ...decision,
        audit: [
          ...(decision.audit ?? []),
          {
            journalId: "pending",
            eventType: "BACKTEST_LOGGED",
            message: `Backtest ${input.report.id} decision journaled.`,
            availableData: ["backtest_report", "kalos_signal"],
            metadata: {
              reportId: input.report.id,
              accepted: input.report.accepted,
              dataSource: input.report.dataSource,
            },
          },
        ],
      });
      records.push(record);
    }

    return records;
  }

  async logError(input: JournalErrorInput): Promise<JournalDecisionRecord> {
    return this.logDecision({
      symbol: input.symbol,
      timeframe: input.timeframe,
      mode: input.mode,
      decision: "NO_TRADE",
      confidence: 0,
      risk_score: 100,
      validated_reasons: [],
      rejected_reasons: [input.error.message],
      entry: null,
      stop_loss: null,
      take_profit: null,
      invalidation: null,
      RR: null,
      spread: null,
      slippage: null,
      volatility: null,
      data_source: input.data_source ?? "DEMO",
      trigger_module: input.trigger_module,
      result: {
        status: "ERROR",
        notes: input.error.message,
      },
      error: input.error,
      audit: [
        {
          journalId: "pending",
          eventType: "ERROR_LOGGED",
          severity: "critical",
          message: input.error.message,
          availableData: input.availableData ?? [],
          blockingRule: input.error.code,
        },
      ],
    });
  }

  async getJournal(query: JournalQuery = {}): Promise<readonly JournalDecisionRecord[]> {
    return this.repository.find(query);
  }

  async getDecisionById(id: string): Promise<JournalDecisionRecord | undefined> {
    return this.repository.findById(id);
  }

  async getPerformanceSummary(query: JournalQuery = {}): Promise<PerformanceSummary> {
    const entries = await this.repository.find(query);
    const decisions = entries.filter(entry => entry.type !== "ERROR");
    const confidenceValues = decisions.map(entry => entry.confidence);
    const riskValues = decisions.map(entry => entry.risk_score);
    const wins = decisions.filter(entry => entry.result?.status === "WIN");
    const losses = decisions.filter(entry => entry.result?.status === "LOSS");
    const netPnl = decisions.reduce((total, entry) => total + (entry.result?.pnl ?? 0), 0);
    const totalClosed = wins.length + losses.length;

    return {
      totalDecisions: decisions.length,
      buyCount: decisions.filter(entry => entry.decision === "BUY").length,
      sellCount: decisions.filter(entry => entry.decision === "SELL").length,
      waitCount: decisions.filter(entry => entry.decision === "WAIT").length,
      noTradeCount: decisions.filter(entry => entry.decision === "NO_TRADE").length,
      averageConfidence:
        confidenceValues.length === 0
          ? 0
          : round(confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length, 2),
      averageRiskScore:
        riskValues.length === 0
          ? 0
          : round(riskValues.reduce((total, value) => total + value, 0) / riskValues.length, 2),
      wins: wins.length,
      losses: losses.length,
      netPnl: round(netPnl, 4),
      winRate: totalClosed === 0 ? 0 : round((wins.length / totalClosed) * 100, 2),
      errors: entries.filter(entry => entry.type === "ERROR" || entry.error).length,
    };
  }

  async getAuditTrail(journalId?: string): Promise<readonly AuditTrailEvent[]> {
    return this.auditService.getAuditTrail(journalId ? { journalId } : {});
  }
}

export function createJournalService(options?: JournalServiceOptions) {
  return new JournalService(options);
}
