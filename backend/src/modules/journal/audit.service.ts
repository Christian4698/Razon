import type { AuditTrailEvent, AuditTrailQuery, CreateAuditEventInput } from "./audit.types";
import type { JournalRepository } from "./journal.repository";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function inRange(timestamp: string, from?: string, to?: string) {
  const value = Date.parse(timestamp);
  const fromValue = from ? Date.parse(from) : null;
  const toValue = to ? Date.parse(to) : null;

  if (fromValue !== null && Number.isFinite(fromValue) && value < fromValue) return false;
  if (toValue !== null && Number.isFinite(toValue) && value > toValue) return false;
  return true;
}

export class AuditService {
  constructor(private readonly repository: JournalRepository) {}

  createEvent(input: CreateAuditEventInput): AuditTrailEvent {
    return {
      id: createId("audit"),
      journalId: input.journalId,
      timestamp: now(),
      eventType: input.eventType,
      severity: input.severity ?? "info",
      message: input.message,
      availableData: input.availableData ?? [],
      calculatedScore: input.calculatedScore,
      blockingRule: input.blockingRule,
      metadata: input.metadata,
    };
  }

  async logAudit(input: CreateAuditEventInput): Promise<AuditTrailEvent> {
    const event = this.createEvent(input);
    return this.repository.appendAudit(event);
  }

  async getAuditTrail(query: AuditTrailQuery = {}): Promise<readonly AuditTrailEvent[]> {
    const events = query.journalId
      ? await this.repository.findAuditByJournalId(query.journalId)
      : await this.repository.listAudit();

    return events.filter(event => {
      if (query.eventType && event.eventType !== query.eventType) return false;
      if (query.severity && event.severity !== query.severity) return false;
      if (!inRange(event.timestamp, query.from, query.to)) return false;
      return true;
    });
  }
}
