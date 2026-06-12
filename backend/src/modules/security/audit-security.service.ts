import type { SecurityAuditRecord, SecuritySeverity } from "./security.types";

function maskString(value: string) {
  if (/token|secret|password|api[_-]?key|bearer/i.test(value)) return "[MASKED]";
  return value;
}

function sanitize(value: unknown): unknown {
  if (typeof value === "string") return maskString(value);
  if (Array.isArray(value)) return value.map(item => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /token|secret|password|api[_-]?key/i.test(key) ? "[MASKED]" : sanitize(item),
      ]),
    );
  }
  return value;
}

export class AuditSecurityService {
  private readonly records: SecurityAuditRecord[] = [];

  record(
    event: string,
    actorId: string,
    severity: SecuritySeverity,
    details: Readonly<Record<string, unknown>>,
  ): SecurityAuditRecord {
    const record: SecurityAuditRecord = {
      id: `sec-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      event,
      actorId,
      severity,
      details: sanitize(details) as Readonly<Record<string, unknown>>,
    };
    this.records.push(record);
    return record;
  }

  list(): readonly SecurityAuditRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records.length = 0;
  }
}
