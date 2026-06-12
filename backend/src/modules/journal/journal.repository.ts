import type { AuditTrailEvent } from "./audit.types";
import type { JournalDecisionRecord, JournalQuery } from "./journal.types";

export interface JournalRepository {
  readonly append: (record: JournalDecisionRecord) => Promise<JournalDecisionRecord>;
  readonly appendAudit: (event: AuditTrailEvent) => Promise<AuditTrailEvent>;
  readonly find: (query?: JournalQuery) => Promise<readonly JournalDecisionRecord[]>;
  readonly findById: (id: string) => Promise<JournalDecisionRecord | undefined>;
  readonly findAuditByJournalId: (journalId: string) => Promise<readonly AuditTrailEvent[]>;
  readonly listAudit: () => Promise<readonly AuditTrailEvent[]>;
}

function inRange(timestamp: string, from?: string, to?: string) {
  const value = Date.parse(timestamp);
  const fromValue = from ? Date.parse(from) : null;
  const toValue = to ? Date.parse(to) : null;

  if (fromValue !== null && Number.isFinite(fromValue) && value < fromValue) return false;
  if (toValue !== null && Number.isFinite(toValue) && value > toValue) return false;
  return true;
}

/**
 * Append-only in-memory repository.
 * It never truncates entries, so NO_TRADE and errors remain auditable.
 */
export class InMemoryJournalRepository implements JournalRepository {
  private readonly entries: JournalDecisionRecord[] = [];
  private readonly audit: AuditTrailEvent[] = [];

  async append(record: JournalDecisionRecord): Promise<JournalDecisionRecord> {
    this.entries.push(record);
    this.audit.push(...record.audit_trail);
    return record;
  }

  async appendAudit(event: AuditTrailEvent): Promise<AuditTrailEvent> {
    this.audit.push(event);
    return event;
  }

  async find(query: JournalQuery = {}): Promise<readonly JournalDecisionRecord[]> {
    const results = this.entries.filter(entry => {
      if (query.type && entry.type !== query.type) return false;
      if (query.symbol && entry.symbol !== query.symbol) return false;
      if (query.decision && entry.decision !== query.decision) return false;
      if (query.trigger_module && entry.trigger_module !== query.trigger_module) return false;
      if (query.data_source && entry.data_source !== query.data_source) return false;
      if (!inRange(entry.date_time, query.from, query.to)) return false;
      return true;
    });

    const sorted = [...results].sort((a, b) => Date.parse(b.date_time) - Date.parse(a.date_time));
    return typeof query.limit === "number" ? sorted.slice(0, query.limit) : sorted;
  }

  async findById(id: string): Promise<JournalDecisionRecord | undefined> {
    return this.entries.find(entry => entry.id === id);
  }

  async findAuditByJournalId(journalId: string): Promise<readonly AuditTrailEvent[]> {
    return this.audit.filter(event => event.journalId === journalId);
  }

  async listAudit(): Promise<readonly AuditTrailEvent[]> {
    return [...this.audit];
  }
}
