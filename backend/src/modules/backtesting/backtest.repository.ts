import type { BacktestJournalEntry, BacktestReport } from "./backtest.types";

export interface BacktestRepository {
  readonly saveReport: (report: BacktestReport) => Promise<BacktestReport>;
  readonly getReport: (id: string) => Promise<BacktestReport | undefined>;
  readonly listReports: () => Promise<readonly BacktestReport[]>;
  readonly appendJournal: (entry: BacktestJournalEntry) => Promise<BacktestJournalEntry>;
  readonly listJournal: () => Promise<readonly BacktestJournalEntry[]>;
}

/**
 * In-memory journal/repository for local simulation.
 * It keeps the Backtesting Engine independent from brokers and execution code.
 */
export class InMemoryBacktestRepository implements BacktestRepository {
  private readonly reports = new Map<string, BacktestReport>();
  private readonly journal: BacktestJournalEntry[] = [];

  async saveReport(report: BacktestReport): Promise<BacktestReport> {
    this.reports.set(report.id, report);
    this.journal.push(...report.journal);
    return report;
  }

  async getReport(id: string): Promise<BacktestReport | undefined> {
    return this.reports.get(id);
  }

  async listReports(): Promise<readonly BacktestReport[]> {
    return [...this.reports.values()];
  }

  async appendJournal(entry: BacktestJournalEntry): Promise<BacktestJournalEntry> {
    this.journal.push(entry);
    return entry;
  }

  async listJournal(): Promise<readonly BacktestJournalEntry[]> {
    return [...this.journal];
  }
}
