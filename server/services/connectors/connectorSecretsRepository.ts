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
  readonly connected?: boolean;
  readonly lastTestAt?: string | null;
  readonly accountType?: "DEMO" | "REAL" | "UNKNOWN" | null;
  readonly connectionStatus?: "CONNECTED" | "DISCONNECTED" | "INVALID";
  readonly source?: "PERSONAL_DERIV_DEMO" | null;
  readonly loginid?: string | null;
}

interface StoredSecretRecord {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
  readonly last4: string;
  readonly updatedAt: string;
}

const connectorIds = new Set<ConnectorId>(["deriv-demo", "deriv-real", "mt5-demo", "mt5-real", "forex-api", "future-providers"]);
const runtimeSecret = process.env.CONNECTOR_SECRET_KEY ?? process.env.APP_SECRET_KEY ?? process.env.JWT_SECRET ?? "razon-local-dev-connector-secret";
const runtimeKey = crypto.createHash("sha256").update(runtimeSecret).digest();
const secretStore = new Map<string, StoredSecretRecord>();

interface SecretPayload {
  readonly token: string;
  readonly connected: boolean;
  readonly lastTestAt: string | null;
  readonly accountType: "DEMO" | "REAL" | "UNKNOWN" | null;
  readonly status: "CONNECTED" | "DISCONNECTED" | "INVALID";
  readonly source: "PERSONAL_DERIV_DEMO" | null;
  readonly loginid: string | null;
}

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

function encryptValue(value: string, last4: string): StoredSecretRecord {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", runtimeKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    last4,
    updatedAt: now(),
  };
}

function encryptPayload(payload: SecretPayload): StoredSecretRecord {
  return encryptValue(JSON.stringify(payload), payload.token.slice(-4));
}

function decryptRecord(record: StoredSecretRecord): string | null {
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", runtimeKey, Buffer.from(record.iv, "base64"));
    decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function parsePayload(record: StoredSecretRecord): SecretPayload | null {
  const decrypted = decryptRecord(record);
  if (!decrypted) return null;

  try {
    const parsed = JSON.parse(decrypted) as Partial<SecretPayload>;
    if (typeof parsed.token !== "string" || parsed.token.trim().length === 0) return null;

    return {
      token: parsed.token,
      connected: parsed.connected === true,
      lastTestAt: typeof parsed.lastTestAt === "string" ? parsed.lastTestAt : null,
      accountType: parsed.accountType === "DEMO" || parsed.accountType === "REAL" || parsed.accountType === "UNKNOWN" ? parsed.accountType : null,
      status: parsed.status === "CONNECTED" || parsed.status === "INVALID" ? parsed.status : "DISCONNECTED",
      source: parsed.source === "PERSONAL_DERIV_DEMO" ? "PERSONAL_DERIV_DEMO" : null,
      loginid: typeof parsed.loginid === "string" ? parsed.loginid : null,
    };
  } catch {
    return {
      token: decrypted,
      connected: false,
      lastTestAt: null,
      accountType: null,
      status: "DISCONNECTED",
      source: null,
      loginid: null,
    };
  }
}

export function isConnectorId(value: string): value is ConnectorId {
  return connectorIds.has(value as ConnectorId);
}

export function getCurrentUserScope(req: Request): CurrentUserScope {
  const auth = (req as Request & {
    auth?: {
      userId?: string;
      snapshot?: {
        user?: {
          displayName?: string;
          email?: string;
          username?: string;
        };
      };
    };
  }).auth;
  const authUserId = auth?.userId;
  const rawUserId = authUserId ?? req.header("x-razon-user-id");
  const userId = stableUserId(rawUserId);
  const displayName =
    auth?.snapshot?.user?.displayName ||
    auth?.snapshot?.user?.email ||
    auth?.snapshot?.user?.username ||
    (userId === "demo-current-user" ? "Current user" : userId);

  return {
    scope: "CURRENT_USER",
    userId,
    displayName,
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
    const payload = parsePayload(record);

    return {
      status: payload?.status === "INVALID" ? "INVALID" : "SAVED",
      saved: true,
      lastUpdatedAt: record.updatedAt,
      maskedPreview: `****${record.last4}`,
      connected: payload?.connected ?? false,
      lastTestAt: payload?.lastTestAt ?? null,
      accountType: payload?.accountType ?? null,
      connectionStatus: payload?.status ?? "DISCONNECTED",
      source: payload?.source ?? null,
      loginid: payload?.loginid ?? null,
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

  secretStore.set(storeKey(user.userId, connectorId), encryptPayload({
    token: trimmed,
    connected: false,
    lastTestAt: null,
    accountType: null,
    status: "DISCONNECTED",
    source: connectorId === "deriv-demo" ? "PERSONAL_DERIV_DEMO" : null,
    loginid: null,
  }));
  notifySaasMutation("connector-secret:save");
  return getSecretMetadata(user, connectorId);
}

export function readConnectorSecret(user: CurrentUserScope, connectorId: ConnectorId): string | null {
  const record = secretStore.get(storeKey(user.userId, connectorId));
  if (!record) return null;

  return parsePayload(record)?.token ?? null;
}

export function markConnectorSecretTest(
  user: CurrentUserScope,
  connectorId: ConnectorId,
  result: {
    readonly connected: boolean;
    readonly accountType: "DEMO" | "REAL" | "UNKNOWN" | null;
    readonly status: "CONNECTED" | "DISCONNECTED" | "INVALID";
    readonly source?: "PERSONAL_DERIV_DEMO" | null;
    readonly loginid?: string | null;
  }
): SafeSecretMetadata {
  const token = readConnectorSecret(user, connectorId);
  if (!token) return getSecretMetadata(user, connectorId);

  secretStore.set(storeKey(user.userId, connectorId), encryptPayload({
    token,
    connected: result.connected,
    lastTestAt: now(),
    accountType: result.accountType,
    status: result.status,
    source: result.source ?? (connectorId === "deriv-demo" ? "PERSONAL_DERIV_DEMO" : null),
    loginid: result.loginid ?? null,
  }));
  notifySaasMutation("connector-secret:test");
  return getSecretMetadata(user, connectorId);
}

export function disconnectConnectorSecret(user: CurrentUserScope, connectorId: ConnectorId): SafeSecretMetadata {
  const record = secretStore.get(storeKey(user.userId, connectorId));
  const payload = record ? parsePayload(record) : null;
  if (!payload?.token) return getSecretMetadata(user, connectorId);

  secretStore.set(storeKey(user.userId, connectorId), encryptPayload({
    token: payload.token,
    connected: false,
    lastTestAt: payload.lastTestAt,
    accountType: payload.accountType,
    status: "DISCONNECTED",
    source: connectorId === "deriv-demo" ? "PERSONAL_DERIV_DEMO" : null,
    loginid: payload.loginid ?? null,
  }));
  notifySaasMutation("connector-secret:disconnect");
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
