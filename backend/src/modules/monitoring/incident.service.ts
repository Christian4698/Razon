import type { FailSafeState, RuntimeMode, SecuritySeverity } from "../security/security.types";

export interface IncidentRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly severity: SecuritySeverity;
  readonly state: FailSafeState;
  readonly title: string;
  readonly details: readonly string[];
  readonly runtimeMode: RuntimeMode;
  readonly resolvedAt?: string;
}

export class IncidentService {
  private readonly incidents: IncidentRecord[] = [];

  logIncident(input: Omit<IncidentRecord, "id" | "createdAt">): IncidentRecord {
    const incident: IncidentRecord = {
      id: `incident-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...input,
    };
    this.incidents.push(incident);
    return incident;
  }

  resolveIncident(id: string): IncidentRecord | null {
    const incident = this.incidents.find(item => item.id === id);
    if (!incident) return null;
    const resolved = { ...incident, resolvedAt: new Date().toISOString() };
    const index = this.incidents.findIndex(item => item.id === id);
    this.incidents[index] = resolved;
    return resolved;
  }

  listIncidents(): readonly IncidentRecord[] {
    return [...this.incidents];
  }

  listOpenIncidents(): readonly IncidentRecord[] {
    return this.incidents.filter(incident => !incident.resolvedAt);
  }
}
