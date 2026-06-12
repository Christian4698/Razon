import type { CreateLicenseActivationLogInput, LicenseActivationLog } from "./license-audit.types";
import { notifySaasMutation } from "../persistence/persistence-bus";

function now() {
  return new Date().toISOString();
}

function createId() {
  return `lic-audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class LicenseAuditService {
  private readonly logs: LicenseActivationLog[] = [];

  log(input: CreateLicenseActivationLogInput): LicenseActivationLog {
    const entry: LicenseActivationLog = {
      id: createId(),
      timestamp: now(),
      userId: input.userId,
      licenseId: input.licenseId ?? null,
      event: input.event,
      status: input.status,
      message: input.message,
      metadata: input.metadata ?? {},
    };

    this.logs.push(entry);
    notifySaasMutation("audit:license-log");
    return entry;
  }

  list(): readonly LicenseActivationLog[] {
    return [...this.logs];
  }

  listByUser(userId: string): readonly LicenseActivationLog[] {
    return this.logs.filter(log => log.userId === userId);
  }

  reset() {
    this.logs.length = 0;
    notifySaasMutation("audit:reset");
  }

  exportPersistence(): readonly LicenseActivationLog[] {
    return this.list();
  }

  importPersistence(logs: readonly LicenseActivationLog[]) {
    this.logs.length = 0;
    this.logs.push(...logs);
  }
}

export function createLicenseAuditService() {
  return new LicenseAuditService();
}
