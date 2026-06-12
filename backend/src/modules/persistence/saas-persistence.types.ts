import type { LicenseActivationLog } from "../audit";
import type { Device } from "../devices";
import type { License, Subscription } from "../licenses";
import type { PasswordRecord, RefreshRecord, ResetRecord } from "../security/auth-session.service";
import type { UserSession } from "../sessions";
import type { User } from "../users";

export interface PersistedConnectorSecret {
  readonly userId: string;
  readonly connectorId: string;
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
  readonly last4: string;
  readonly updatedAt: string;
}

export interface SaasPersistenceSnapshot {
  readonly users: readonly User[];
  readonly passwords: readonly PasswordRecord[];
  readonly refreshTokens: readonly RefreshRecord[];
  readonly resetTokens: readonly ResetRecord[];
  readonly licenses: readonly License[];
  readonly subscriptions: readonly Subscription[];
  readonly devices: readonly Device[];
  readonly licenseSessions: readonly UserSession[];
  readonly auditLogs: readonly LicenseActivationLog[];
  readonly connectorSecrets: readonly PersistedConnectorSecret[];
}

export interface SaasPersistenceRepository {
  readonly enabled: boolean;
  initialize(): Promise<void>;
  loadSnapshot(): Promise<SaasPersistenceSnapshot | null>;
  saveSnapshot(snapshot: SaasPersistenceSnapshot): Promise<void>;
  close(): Promise<void>;
}
