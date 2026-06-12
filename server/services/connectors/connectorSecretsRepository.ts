import crypto from "crypto";
import type { Request } from "express";
import { licenseEngineService } from "../../../backend/src/modules/licenses";
import { notifySaasMutation } from "../../../backend/src/modules/persistence/persistence-bus";
import type { PersistedConnectorSecret } from "../../../backend/src/modules/persistence/saas-persistence.types";

export type ConnectorSecretStatus = "MISSING" | "SAVED" | "ROTATION_REQUIRED" | "INVALID";
export type LicenseStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED" | "MISSING";
export type ConnectorId = "deriv-demo" | "deriv-real" | "mt5-demo" | "mt5-real" | "forex-api" | "future-providers";

export interface CurrentUserScope {
  readonly scope: "CURRENT_USER";
  readonly userId: string;
  readonly displayName: string;
}

export interface LicenseSnapshot {
  readonly status: LicenseStatus;
  readonly plan: string;
  readonly expiryDate: string | null;
  readonly deviceLimit: number | null;
  readonly activeDevices: number | null;
  readonly sessionLimit: number | null;
  readonly activeSessions: number | null;
  readonly engineStatus: "PENDING" | "READY";
  readonly message: string;
}

export interface SafeSecretMetadata {
  readonly status: ConnectorSecretStatus;
  readonly saved: boolean;
  readonly lastUpdatedAt: string | null;
  readonly maskedPreview?: string;
}

interface StoredSecretRecord {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
  readonly last4: string;
  readonly updatedAt: string;
}

const connectorIds = new Set<ConnectorId>(["deriv-demo", "deriv-real", "mt5-demo", "mt5-real", "forex-api", "future-providers"]);
const runtimeKey = crypto.randomBytes(32);
const secretStore = new Map<string, StoredSecretRecord>();

function now() {
  return new Date().toISOString();
}

function stableUserId(value: unknown) {
  if (typeof value !== "string") return "demo-current-user";
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 64);
  return normalized || "demo-current-user";
}

function storeKey(userId: string, connectorId: ConnectorId) {
  return `${userId}:${connectorId}`;
}

function encryptSecret(secret: string): StoredSecretRecord {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", runtimeKey, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    last4: secret.slice(-4),
    updatedAt: now(),
  };
}

export function isConnectorId(value: string): value is ConnectorId {
  return connectorIds.has(value as ConnectorId);
}

export function getCurrentUserScope(req: Request): CurrentUserScope {
  const authUserId = (req as Request & { auth?: { userId?: string } }).auth?.userId;
  const rawUserId = authUserId ?? req.header("x-razon-user-id");
  const userId = stableUserId(rawUserId);

  return {
    scope: "CURRENT_USER",
    userId,
    displayName: userId === "demo-current-user" ? "Current user" : userId,
  };
}

export function getLicenseSnapshot(_user: CurrentUserScope): LicenseSnapshot {
  const snapshot = licenseEngineService.status(_user.userId);

  return {
    status: snapshot.status,
    plan: snapshot.plan,
    expiryDate: snapshot.expiryDate,
    deviceLimit: snapshot.deviceLimit,
    activeDevices: snapshot.activeDevices,
    sessionLimit: snapshot.sessionLimit,
    activeSessions: snapshot.activeSessions,
    engineStatus: "READY",
    message: snapshot.message,
  };
}

export function getSecretMetadata(user: CurrentUserScope, connectorId: ConnectorId, envConfigured = false): SafeSecretMetadata {
  const record = secretStore.get(storeKey(user.userId, connectorId));
  if (record) {
    return {
      status: "SAVED",
      saved: true,
      lastUpdatedAt: record.updatedAt,
      maskedPreview: `****${record.last4}`,
    };
  }

  if (envConfigured) {
    return {
      status: "SAVED",
      saved: true,
      lastUpdatedAt: null,
    };
  }

  return {
    status: "MISSING",
    saved: false,
    lastUpdatedAt: null,
  };
}

export function saveConnectorSecret(user: CurrentUserScope, connectorId: ConnectorId, secret: string): SafeSecretMetadata {
  const trimmed = secret.trim();
  if (trimmed.length < 6) {
    return {
      status: "INVALID",
      saved: false,
      lastUpdatedAt: null,
    };
  }

  secretStore.set(storeKey(user.userId, connectorId), encryptSecret(trimmed));
  notifySaasMutation("connector-secret:save");
  return getSecretMetadata(user, connectorId);
}

export function deleteConnectorSecret(user: CurrentUserScope, connectorId: ConnectorId): SafeSecretMetadata {
  secretStore.delete(storeKey(user.userId, connectorId));
  notifySaasMutation("connector-secret:delete");
  return getSecretMetadata(user, connectorId);
}

export function exportConnectorSecretsPersistence(): readonly PersistedConnectorSecret[] {
  return Array.from(secretStore.entries()).map(([key, record]) => {
    const [userId, connectorId] = key.split(":");
    return {
      userId,
      connectorId,
      ciphertext: record.ciphertext,
      iv: record.iv,
      authTag: record.authTag,
      last4: record.last4,
      updatedAt: record.updatedAt,
    };
  });
}

export function importConnectorSecretsPersistence(secrets: readonly PersistedConnectorSecret[]) {
  secretStore.clear();
  for (const secret of secrets) {
    if (!isConnectorId(secret.connectorId)) continue;
    secretStore.set(storeKey(secret.userId, secret.connectorId), {
      ciphertext: secret.ciphertext,
      iv: secret.iv,
      authTag: secret.authTag,
      last4: secret.last4,
      updatedAt: secret.updatedAt,
    });
  }
}
