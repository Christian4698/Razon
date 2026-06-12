import type { ControlAuditEvent, CreateControlAuditEventInput } from "./audit.types";

function createId() {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

export class ControlAuditService {
  private readonly events: ControlAuditEvent[] = [];

  log(input: CreateControlAuditEventInput): ControlAuditEvent {
    const event: ControlAuditEvent = {
      id: createId(),
      timestamp: now(),
      eventType: input.eventType,
      severity: input.severity ?? "info",
      message: input.message,
      actor: input.actor,
      metadata: input.metadata ?? {},
    };

    this.events.push(event);
    return event;
  }

  list(): readonly ControlAuditEvent[] {
    return [...this.events];
  }
}

export function createControlAuditService() {
  return new ControlAuditService();
}
