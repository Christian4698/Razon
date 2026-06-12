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
      const updated: UserSession = { ...existing, lastSeenAt: timestamp };
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
      revoked: false,
    };

    this.sessions.set(id, session);
    notifySaasMutation("license-sessions:start");
    return session;
  }

  listByLicense(licenseId: string): readonly UserSession[] {
    return Array.from(this.sessions.values()).filter(session => session.licenseId === licenseId && !session.revoked);
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
