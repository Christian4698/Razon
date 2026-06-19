import crypto from "crypto";
import type { StartUserSessionInput, UserSession } from "./session.types";
import { notifySaasMutation } from "../persistence/persistence-bus";

function now() {
  return new Date().toISOString();
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export class SessionsService {
  private readonly sessions = new Map<string, UserSession>();

  start(input: StartUserSessionInput): UserSession {
    const rawSessionId = input.sessionId?.trim() || `${input.userId}:default-session`;
    const id = hash(`${input.userId}:${input.licenseId}:${input.deviceId}:${rawSessionId}`).slice(0, 24);
    const existing = this.sessions.get(id);
    const timestamp = now();

    if (existing) {
      const updated: UserSession = {
        ...existing,
        lastSeenAt: timestamp,
        userAgent: input.userAgent ?? existing.userAgent ?? null,
        ipHash: input.ipHash ?? existing.ipHash ?? null,
      };
      this.sessions.set(id, updated);
      notifySaasMutation("license-sessions:update");
      return updated;
    }

    const session: UserSession = {
      id,
      userId: input.userId,
      licenseId: input.licenseId,
      deviceId: input.deviceId,
      createdAt: timestamp,
      lastSeenAt: timestamp,
      userAgent: input.userAgent ?? null,
      ipHash: input.ipHash ?? null,
      revoked: false,
    };

    this.sessions.set(id, session);
    notifySaasMutation("license-sessions:start");
    return session;
  }

  listByLicense(licenseId: string): readonly UserSession[] {
    return Array.from(this.sessions.values()).filter(session => session.licenseId === licenseId && !session.revoked);
  }

  touchByRawSessionId(input: { readonly userId: string; readonly licenseId: string; readonly deviceId: string; readonly sessionId: string }) {
    const id = hash(`${input.userId}:${input.licenseId}:${input.deviceId}:${input.sessionId}`).slice(0, 24);
    const existing = this.sessions.get(id);
    if (!existing || existing.revoked) return null;
    const updated: UserSession = { ...existing, lastSeenAt: now() };
    this.sessions.set(id, updated);
    notifySaasMutation("license-sessions:heartbeat");
    return updated;
  }

  revokeByRawSessionId(input: { readonly userId: string; readonly licenseId: string; readonly deviceId: string; readonly sessionId: string }) {
    const id = hash(`${input.userId}:${input.licenseId}:${input.deviceId}:${input.sessionId}`).slice(0, 24);
    const existing = this.sessions.get(id);
    if (!existing || existing.revoked) return false;
    this.sessions.set(id, { ...existing, lastSeenAt: now(), revoked: true });
    notifySaasMutation("license-sessions:revoke");
    return true;
  }

  revokeByUser(userId: string) {
    let changed = false;
    for (const [id, session] of Array.from(this.sessions.entries())) {
      if (session.userId === userId && !session.revoked) {
        this.sessions.set(id, { ...session, lastSeenAt: now(), revoked: true });
        changed = true;
      }
    }
    if (changed) notifySaasMutation("license-sessions:revoke-user");
    return changed;
  }

  reset() {
    this.sessions.clear();
    notifySaasMutation("license-sessions:reset");
  }

  exportPersistence(): readonly UserSession[] {
    return Array.from(this.sessions.values());
  }

  importPersistence(sessions: readonly UserSession[]) {
    this.sessions.clear();
    for (const session of sessions) this.sessions.set(session.id, session);
  }
}

export function createSessionsService() {
  return new SessionsService();
}
