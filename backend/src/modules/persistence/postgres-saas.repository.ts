import fs from "fs/promises";
import path from "path";
import { Pool, type PoolClient } from "pg";
import type { LicenseActivationLog } from "../audit";
import type { Device } from "../devices";
import type { License, Subscription } from "../licenses";
import type { PasswordRecord, RefreshRecord, ResetRecord } from "../security/auth-session.service";
import type { UserSession } from "../sessions";
import type { User } from "../users";
import type { PersistedConnectorSecret, SaasPersistenceRepository, SaasPersistenceSnapshot } from "./saas-persistence.types";

function dbUrl() {
  return process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
}

function shouldEnablePostgresPersistence() {
  if (process.env.SAAS_PERSISTENCE === "memory") return false;
  if (process.env.SAAS_PERSISTENCE === "postgres" || process.env.SAAS_PERSISTENCE_PROVIDER === "postgres") return true;
  if (process.env.SUPABASE_DB_URL) return true;
  return process.env.NODE_ENV === "production" && Boolean(dbUrl());
}

function sslConfig() {
  const value = String(process.env.DATABASE_SSL ?? process.env.SUPABASE_DB_SSL ?? "").toLowerCase();
  if (value === "true" || value === "require") return { rejectUnauthorized: false };
  return false;
}

function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function json(value: unknown) {
  if (value && typeof value === "object") return value as Record<string, string | number | boolean | null>;
  return {};
}

function role(value: unknown): User["role"] {
  const normalized = String(value).toUpperCase();
  if (normalized === "OWNER" || normalized === "ADMIN") return normalized;
  return "USER";
}

async function readMigrationSql() {
  const migrationPath = path.resolve(process.cwd(), "infrastructure", "supabase", "migrations", "001_saas_persistence.sql");
  return fs.readFile(migrationPath, "utf8");
}

export class PostgresSaasRepository implements SaasPersistenceRepository {
  readonly enabled = shouldEnablePostgresPersistence();
  private pool: Pool | null = null;

  async initialize() {
    if (!this.enabled) return;
    const connectionString = dbUrl();
    if (!connectionString) throw new Error("SAAS_PERSISTENCE=postgres requires DATABASE_URL or SUPABASE_DB_URL.");
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      min: Number(process.env.DATABASE_POOL_MIN ?? 0),
      ssl: sslConfig(),
    });
    await this.pool.query("select 1");
    if (process.env.SAAS_DB_AUTO_MIGRATE !== "false") {
      await this.pool.query(await readMigrationSql());
    }
  }

  async loadSnapshot(): Promise<SaasPersistenceSnapshot | null> {
    if (!this.pool) return null;
    const client = await this.pool.connect();
    try {
      const users = await client.query("select * from users order by created_at asc");
      const licenses = await client.query("select * from licenses order by created_at asc");
      const subscriptions = await client.query("select * from subscriptions order by created_at asc");
      const devices = await client.query("select * from devices order by first_seen_at asc");
      const sessions = await client.query("select * from sessions order by created_at asc");
      const auditLogs = await client.query("select * from audit_logs order by timestamp asc");
      const connectorSecrets = await client.query("select * from connector_secrets order by updated_at asc");

      return {
        users: users.rows.map(rowToUser),
        passwords: users.rows.filter(row => row.password_hash).map(rowToPassword),
        refreshTokens: sessions.rows.filter(row => row.session_kind === "AUTH").map(rowToRefreshToken),
        resetTokens: sessions.rows.filter(row => row.session_kind === "PASSWORD_RESET").map(rowToResetToken),
        licenses: licenses.rows.map(rowToLicense),
        subscriptions: subscriptions.rows.map(rowToSubscription),
        devices: devices.rows.map(rowToDevice),
        licenseSessions: sessions.rows.filter(row => row.session_kind === "LICENSE").map(rowToLicenseSession),
        auditLogs: auditLogs.rows.map(rowToAuditLog),
        connectorSecrets: connectorSecrets.rows.map(rowToConnectorSecret),
      };
    } finally {
      client.release();
    }
  }

  async saveSnapshot(snapshot: SaasPersistenceSnapshot) {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await upsertRoles(client);
      for (const user of snapshot.users) await upsertUser(client, user, snapshot.passwords.find(item => item.userId === user.id) ?? null);
      for (const license of snapshot.licenses) await upsertLicense(client, license);
      for (const subscription of snapshot.subscriptions) await upsertSubscription(client, subscription);
      for (const device of snapshot.devices) await upsertDevice(client, device);
      for (const session of snapshot.licenseSessions) await upsertLicenseSession(client, session);
      for (const refresh of snapshot.refreshTokens) await upsertRefreshSession(client, refresh);
      for (const reset of snapshot.resetTokens) await upsertResetSession(client, reset);
      await client.query("delete from connector_secrets");
      for (const secret of snapshot.connectorSecrets) await upsertConnectorSecret(client, secret);
      for (const log of snapshot.auditLogs) await upsertAuditLog(client, log);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool?.end();
    this.pool = null;
  }
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    displayName: String(row.display_name),
    role: role(row.role_id),
    status: String(row.status) === "DISABLED" ? "DISABLED" : "ACTIVE",
    mustChangePassword: Boolean(row.must_change_password),
    firstLoginCompleted: Boolean(row.first_login_completed),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
    lastLoginAt: iso(row.last_login_at),
  };
}

function rowToPassword(row: Record<string, unknown>): PasswordRecord {
  return {
    userId: String(row.id),
    salt: String(row.password_salt),
    hash: String(row.password_hash),
    iterations: Number(row.password_iterations ?? 120000),
    createdAt: iso(row.password_created_at) ?? iso(row.created_at) ?? new Date().toISOString(),
    updatedAt: iso(row.password_updated_at) ?? iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function rowToLicense(row: Record<string, unknown>): License {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    plan: String(row.plan) as License["plan"],
    duration: String(row.duration) as License["duration"],
    status: String(row.status) as License["status"],
    licenseKeyHash: String(row.license_key_hash),
    licenseKeyPreview: String(row.license_key_preview),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    activatedAt: iso(row.activated_at),
    expiresAt: iso(row.expires_at),
    suspendedAt: iso(row.suspended_at),
    revokedAt: iso(row.revoked_at),
    subscriptionId: String(row.subscription_id),
  };
}

function rowToSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    licenseId: String(row.license_id),
    plan: String(row.plan) as Subscription["plan"],
    status: String(row.status) as Subscription["status"],
    startedAt: iso(row.started_at),
    expiresAt: iso(row.expires_at),
    renewedAt: iso(row.renewed_at),
    paymentProvider: "NONE",
  };
}

function rowToDevice(row: Record<string, unknown>): Device {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    licenseId: String(row.license_id),
    label: String(row.label),
    fingerprintHash: String(row.fingerprint_hash),
    firstSeenAt: iso(row.first_seen_at) ?? new Date().toISOString(),
    lastSeenAt: iso(row.last_seen_at) ?? new Date().toISOString(),
    userAgent: row.user_agent ? String(row.user_agent) : null,
    ipHash: row.ip_hash ? String(row.ip_hash) : null,
    revoked: Boolean(row.revoked),
  };
}

function rowToLicenseSession(row: Record<string, unknown>): UserSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    licenseId: String(row.license_id),
    deviceId: String(row.device_id),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    lastSeenAt: iso(row.last_seen_at) ?? new Date().toISOString(),
    userAgent: row.user_agent ? String(row.user_agent) : null,
    ipHash: row.ip_hash ? String(row.ip_hash) : null,
    revoked: Boolean(row.revoked_at),
  };
}

function rowToRefreshToken(row: Record<string, unknown>): RefreshRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    licenseId: row.license_id ? String(row.license_id) : null,
    deviceId: row.device_id ? String(row.device_id) : null,
    tokenHash: String(row.refresh_token_hash),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    expiresAt: iso(row.expires_at) ?? new Date().toISOString(),
    lastSeenAt: iso(row.last_seen_at) ?? new Date().toISOString(),
    revokedAt: iso(row.revoked_at),
    rememberMe: Boolean(row.remember_me),
    userAgent: row.user_agent ? String(row.user_agent) : null,
    ipHash: row.ip_hash ? String(row.ip_hash) : null,
  };
}

function rowToResetToken(row: Record<string, unknown>): ResetRecord {
  return {
    userId: String(row.user_id),
    tokenHash: String(row.refresh_token_hash),
    expiresAt: iso(row.expires_at) ?? new Date().toISOString(),
    usedAt: iso(row.revoked_at),
  };
}

function rowToAuditLog(row: Record<string, unknown>): LicenseActivationLog {
  return {
    id: String(row.id),
    timestamp: iso(row.timestamp) ?? new Date().toISOString(),
    userId: String(row.actor_user_id ?? row.target_user_id ?? "system"),
    licenseId: row.license_id ? String(row.license_id) : null,
    event: String(row.event) as LicenseActivationLog["event"],
    status: String(row.status) as LicenseActivationLog["status"],
    message: String(row.message),
    metadata: json(row.metadata),
  };
}

function rowToConnectorSecret(row: Record<string, unknown>): PersistedConnectorSecret {
  return {
    userId: String(row.user_id),
    connectorId: String(row.connector_id),
    ciphertext: String(row.ciphertext),
    iv: String(row.iv),
    authTag: String(row.auth_tag),
    last4: String(row.last4 ?? row.last_4 ?? ""),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

async function upsertRoles(client: PoolClient) {
  await client.query(
    `insert into roles (id, name, permissions)
     values
       ('OWNER', 'Owner', '{"owner": true, "admin": true}'::jsonb),
       ('ADMIN', 'Administrator', '{"admin": true}'::jsonb),
       ('USER', 'User', '{"admin": false}'::jsonb)
     on conflict (id) do update set name = excluded.name, permissions = excluded.permissions`,
  );
}

async function upsertUser(client: PoolClient, user: User, password: PasswordRecord | null) {
  await client.query(
    `insert into users (
       id, username, email, display_name, role_id, status, must_change_password, first_login_completed,
       password_hash, password_salt, password_iterations, password_created_at, password_updated_at,
       created_at, updated_at, last_login_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     on conflict (id) do update set
       username = excluded.username,
       email = excluded.email,
       display_name = excluded.display_name,
       role_id = excluded.role_id,
       status = excluded.status,
       must_change_password = excluded.must_change_password,
       first_login_completed = excluded.first_login_completed,
       password_hash = coalesce(excluded.password_hash, users.password_hash),
       password_salt = coalesce(excluded.password_salt, users.password_salt),
       password_iterations = coalesce(excluded.password_iterations, users.password_iterations),
       password_created_at = coalesce(excluded.password_created_at, users.password_created_at),
       password_updated_at = coalesce(excluded.password_updated_at, users.password_updated_at),
       updated_at = excluded.updated_at,
       last_login_at = excluded.last_login_at`,
    [
      user.id,
      user.username,
      user.email,
      user.displayName,
      user.role,
      user.status,
      user.mustChangePassword,
      user.firstLoginCompleted,
      password?.hash ?? null,
      password?.salt ?? null,
      password?.iterations ?? null,
      password?.createdAt ?? null,
      password?.updatedAt ?? null,
      user.createdAt,
      user.updatedAt,
      user.lastLoginAt,
    ],
  );
}

async function upsertLicense(client: PoolClient, license: License) {
  await client.query(
    `insert into licenses (
      id, user_id, plan, duration, status, license_key_hash, license_key_preview,
      created_at, activated_at, expires_at, suspended_at, revoked_at, subscription_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    on conflict (id) do update set
      plan = excluded.plan,
      duration = excluded.duration,
      status = excluded.status,
      activated_at = excluded.activated_at,
      expires_at = excluded.expires_at,
      suspended_at = excluded.suspended_at,
      revoked_at = excluded.revoked_at`,
    [
      license.id,
      license.userId,
      license.plan,
      license.duration,
      license.status,
      license.licenseKeyHash,
      license.licenseKeyPreview,
      license.createdAt,
      license.activatedAt,
      license.expiresAt,
      license.suspendedAt,
      license.revokedAt,
      license.subscriptionId,
    ],
  );
}

async function upsertSubscription(client: PoolClient, subscription: Subscription) {
  await client.query(
    `insert into subscriptions (id, user_id, license_id, plan, status, started_at, expires_at, renewed_at, payment_provider)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (id) do update set
       plan = excluded.plan,
       status = excluded.status,
       started_at = excluded.started_at,
       expires_at = excluded.expires_at,
       renewed_at = excluded.renewed_at`,
    [
      subscription.id,
      subscription.userId,
      subscription.licenseId,
      subscription.plan,
      subscription.status,
      subscription.startedAt,
      subscription.expiresAt,
      subscription.renewedAt,
      subscription.paymentProvider,
    ],
  );
}

async function upsertDevice(client: PoolClient, device: Device) {
  await client.query(
    `insert into devices (id, user_id, license_id, label, fingerprint_hash, first_seen_at, last_seen_at, user_agent, ip_hash, revoked)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (id) do update set
       label = excluded.label,
       last_seen_at = excluded.last_seen_at,
       user_agent = excluded.user_agent,
       ip_hash = excluded.ip_hash,
       revoked = excluded.revoked`,
    [
      device.id,
      device.userId,
      device.licenseId,
      device.label,
      device.fingerprintHash,
      device.firstSeenAt,
      device.lastSeenAt,
      device.userAgent ?? null,
      device.ipHash ?? null,
      device.revoked,
    ],
  );
}

async function upsertLicenseSession(client: PoolClient, session: UserSession) {
  await client.query(
    `insert into sessions (id, user_id, license_id, device_id, session_kind, created_at, last_seen_at, user_agent, ip_hash, revoked_at)
     values ($1,$2,$3,$4,'LICENSE',$5,$6,$7,$8,$9)
     on conflict (id) do update set
       last_seen_at = excluded.last_seen_at,
       user_agent = excluded.user_agent,
       ip_hash = excluded.ip_hash,
       revoked_at = excluded.revoked_at`,
    [
      session.id,
      session.userId,
      session.licenseId,
      session.deviceId,
      session.createdAt,
      session.lastSeenAt,
      session.userAgent ?? null,
      session.ipHash ?? null,
      session.revoked ? session.lastSeenAt : null,
    ],
  );
}

async function upsertRefreshSession(client: PoolClient, refresh: RefreshRecord) {
  await client.query(
    `insert into sessions (id, user_id, license_id, device_id, session_kind, refresh_token_hash, remember_me, expires_at, created_at, last_seen_at, user_agent, ip_hash, revoked_at)
     values ($1,$2,$3,$4,'AUTH',$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (id) do update set
       license_id = excluded.license_id,
       device_id = excluded.device_id,
       refresh_token_hash = excluded.refresh_token_hash,
       remember_me = excluded.remember_me,
       expires_at = excluded.expires_at,
       last_seen_at = excluded.last_seen_at,
       user_agent = excluded.user_agent,
       ip_hash = excluded.ip_hash,
       revoked_at = excluded.revoked_at`,
    [
      refresh.id,
      refresh.userId,
      refresh.licenseId ?? null,
      refresh.deviceId ?? null,
      refresh.tokenHash,
      refresh.rememberMe,
      refresh.expiresAt,
      refresh.createdAt,
      refresh.lastSeenAt,
      refresh.userAgent ?? null,
      refresh.ipHash ?? null,
      refresh.revokedAt,
    ],
  );
}

async function upsertResetSession(client: PoolClient, reset: ResetRecord) {
  await client.query(
    `insert into sessions (id, user_id, session_kind, refresh_token_hash, expires_at, created_at, last_seen_at, revoked_at)
     values ($1,$2,'PASSWORD_RESET',$1,$3,now(),now(),$4)
     on conflict (id) do update set expires_at = excluded.expires_at, revoked_at = excluded.revoked_at`,
    [reset.tokenHash, reset.userId, reset.expiresAt, reset.usedAt],
  );
}

async function upsertConnectorSecret(client: PoolClient, secret: PersistedConnectorSecret) {
  await client.query(
    `insert into connector_secrets (id, user_id, connector_id, ciphertext, iv, auth_tag, last4, status, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,'SAVED',$8)
     on conflict (id) do update set
       ciphertext = excluded.ciphertext,
       iv = excluded.iv,
       auth_tag = excluded.auth_tag,
       last4 = excluded.last4,
       status = excluded.status,
       updated_at = excluded.updated_at`,
    [`${secret.userId}:${secret.connectorId}`, secret.userId, secret.connectorId, secret.ciphertext, secret.iv, secret.authTag, secret.last4, secret.updatedAt],
  );
}

async function upsertAuditLog(client: PoolClient, log: LicenseActivationLog) {
  await client.query(
    `insert into audit_logs (id, timestamp, actor_user_id, target_user_id, license_id, event, severity, status, message, metadata)
     values ($1,$2,$3,$3,$4,$5,'INFO',$6,$7,$8)
     on conflict (id) do nothing`,
    [log.id, log.timestamp, log.userId, log.licenseId, log.event, log.status, log.message, log.metadata],
  );
}
