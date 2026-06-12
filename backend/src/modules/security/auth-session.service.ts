import crypto from "crypto";
import { licenseEngineService } from "../licenses";
import { stableUserId, usersService, type User, type UserRole } from "../users";
import type { LicenseStatusSnapshot } from "../licenses";
import { notifySaasMutation } from "../persistence/persistence-bus";

export interface SafeAuthUser {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly status: User["status"];
  readonly mustChangePassword: boolean;
  readonly firstLoginCompleted: boolean;
}

export interface AuthPermissions {
  readonly dashboardAccess: "FULL" | "LIMITED_READ_ONLY" | "ACTIVATION_REQUIRED" | "DENIED";
  readonly canManageLicenses: boolean;
  readonly canManageUsers: boolean;
  readonly canManageConnectors: boolean;
  readonly canReadMarket: boolean;
  readonly canReadJournal: boolean;
  readonly liveExecutionEnabled: false;
  readonly automaticTradingAllowed: false;
}

export interface AuthSessionSnapshot {
  readonly authenticated: true;
  readonly user: SafeAuthUser;
  readonly license: LicenseStatusSnapshot;
  readonly plan: LicenseStatusSnapshot["plan"];
  readonly devices: LicenseStatusSnapshot["devices"];
  readonly sessions: LicenseStatusSnapshot["sessions"];
  readonly permissions: AuthPermissions;
  readonly session: {
    readonly id: string;
    readonly expiresAt: string;
    readonly refreshExpiresAt: string;
    readonly mustRefreshAt: string;
  };
  readonly readOnly: true;
  readonly liveExecutionEnabled: false;
  readonly automaticTradingAllowed: false;
  readonly secretsExposed: false;
}

export interface AccessTokenPayload {
  readonly sub: string;
  readonly sid: string;
  readonly role: UserRole;
  readonly type: "access";
  readonly iat: number;
  readonly exp: number;
}

export interface PasswordRecord {
  readonly userId: string;
  readonly salt: string;
  readonly hash: string;
  readonly iterations: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RefreshRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string;
  readonly revokedAt: string | null;
  readonly rememberMe: boolean;
}

export interface ResetRecord {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: string;
  readonly usedAt: string | null;
}

interface LoginAttemptBucket {
  readonly resetAtMs: number;
  count: number;
}

interface LoginResultOk {
  readonly ok: true;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: string;
  readonly refreshExpiresAt: string;
  readonly snapshot: AuthSessionSnapshot;
}

interface LoginResultFail {
  readonly ok: false;
  readonly status: number;
  readonly code: "INVALID_CREDENTIALS" | "ACCOUNT_DISABLED" | "RATE_LIMITED";
  readonly message: string;
  readonly retryAfterMs?: number;
}

type LoginResult = LoginResultOk | LoginResultFail;

const accessTtlSeconds = Number(process.env.AUTH_ACCESS_TTL_SECONDS ?? 15 * 60);
const refreshTtlSeconds = Number(process.env.AUTH_REFRESH_TTL_SECONDS ?? 8 * 60 * 60);
const rememberRefreshTtlSeconds = Number(process.env.AUTH_REMEMBER_REFRESH_TTL_SECONDS ?? 30 * 24 * 60 * 60);
const resetTtlSeconds = Number(process.env.AUTH_RESET_TTL_SECONDS ?? 15 * 60);
const loginWindowMs = Number(process.env.AUTH_LOGIN_WINDOW_MS ?? 5 * 60 * 1000);
const loginMaxAttempts = Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? 8);

function nowMs() {
  return Date.now();
}

function nowIso() {
  return new Date().toISOString();
}

function addSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseBase64UrlJson<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function authSecret() {
  return process.env.JWT_SECRET || process.env.APP_SECRET_KEY || "razon-local-dev-auth-secret-change-before-production";
}

function signJwt(payload: AccessTokenPayload) {
  const encodedHeader = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const encodedPayload = base64UrlJson(payload);
  const body = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyJwt(token: string): AccessTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = crypto.createHmac("sha256", authSecret()).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return null;

  const payload = parseBase64UrlJson<AccessTokenPayload>(encodedPayload);
  if (!payload || payload.type !== "access") return null;
  if (payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("base64url"), iterations = 120_000) {
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return { salt, hash, iterations };
}

function verifyPassword(password: string, record: PasswordRecord) {
  const candidate = hashPassword(password, record.salt, record.iterations).hash;
  const expectedBuffer = Buffer.from(record.hash);
  const candidateBuffer = Buffer.from(candidate);
  return expectedBuffer.length === candidateBuffer.length && crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
}

function safeUser(user: User): SafeAuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    firstLoginCompleted: user.firstLoginCompleted,
  };
}

function canAdminister(role: UserRole) {
  return role === "OWNER" || role === "ADMIN";
}

function permissionsFor(user: User, license: LicenseStatusSnapshot): AuthPermissions {
  const denied = license.status === "SUSPENDED" || license.status === "REVOKED";
  const activationRequired = license.status === "MISSING" || license.status === "PENDING";
  const limited = license.status === "EXPIRED";

  return {
    dashboardAccess: denied
      ? "DENIED"
      : activationRequired
        ? "ACTIVATION_REQUIRED"
        : limited
          ? "LIMITED_READ_ONLY"
          : "FULL",
    canManageLicenses: canAdminister(user.role),
    canManageUsers: canAdminister(user.role),
    canManageConnectors: !denied && !activationRequired,
    canReadMarket: !denied,
    canReadJournal: !denied,
    liveExecutionEnabled: false,
    automaticTradingAllowed: false,
  };
}

export class AuthSessionService {
  private readonly passwords = new Map<string, PasswordRecord>();
  private readonly refreshTokens = new Map<string, RefreshRecord>();
  private readonly resetTokens = new Map<string, ResetRecord>();
  private readonly loginAttempts = new Map<string, LoginAttemptBucket>();

  constructor() {
    this.ensureBootstrapAccounts();
  }

  provisionUser(input: {
    readonly userId?: string;
    readonly email?: string;
    readonly username?: string;
    readonly displayName?: string;
    readonly role?: UserRole;
    readonly temporaryPassword?: string;
    readonly mustChangePassword?: boolean;
    readonly firstLoginCompleted?: boolean;
  }) {
    const user = usersService.getOrCreate({
      userId: input.userId,
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      role: input.role ?? "USER",
      mustChangePassword: input.mustChangePassword ?? true,
      firstLoginCompleted: input.firstLoginCompleted ?? false,
      status: "ACTIVE",
    });
    const hasPassword = this.passwords.has(user.id);
    const temporaryPassword = input.temporaryPassword ?? (hasPassword ? "" : this.generateTemporaryPassword());
    if (!hasPassword || input.temporaryPassword) {
      this.setPassword(user.id, temporaryPassword);
      usersService.update(user.id, {
        firstLoginCompleted: input.firstLoginCompleted ?? false,
        mustChangePassword: input.mustChangePassword ?? true,
      });
    }

    return {
      user: safeUser(usersService.findById(user.id) ?? user),
      oneTimeTemporaryPassword: temporaryPassword || null,
    };
  }

  login(input: { readonly identifier: string; readonly password: string; readonly rememberMe?: boolean; readonly ip?: string }): LoginResult {
    const attempt = this.checkLoginRate(input.ip ?? "local", input.identifier);
    if (!attempt.allowed) {
      return {
        ok: false,
        status: 429,
        code: "RATE_LIMITED",
        message: "Too many login attempts. Try again later.",
        retryAfterMs: attempt.retryAfterMs,
      };
    }

    const user = usersService.findByIdentifier(input.identifier);
    const password = user ? this.passwords.get(user.id) : null;
    if (!user || !password || !verifyPassword(input.password, password)) {
      this.recordFailedLogin(input.ip ?? "local", input.identifier);
      return {
        ok: false,
        status: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email/username or password.",
      };
    }

    if (user.status !== "ACTIVE") {
      return {
        ok: false,
        status: 403,
        code: "ACCOUNT_DISABLED",
        message: "This account is disabled.",
      };
    }

    this.resetLoginRate(input.ip ?? "local", input.identifier);
    const sessionId = randomToken(18);
    const refreshToken = randomToken(36);
    const refreshExpiresAt = addSeconds(input.rememberMe ? rememberRefreshTtlSeconds : refreshTtlSeconds);
    const record: RefreshRecord = {
      id: sessionId,
      userId: user.id,
      tokenHash: sha256(refreshToken),
      createdAt: nowIso(),
      expiresAt: refreshExpiresAt,
      lastSeenAt: nowIso(),
      revokedAt: null,
      rememberMe: Boolean(input.rememberMe),
    };

    this.refreshTokens.set(sessionId, record);
    usersService.update(user.id, { lastLoginAt: nowIso() });
    const access = this.issueAccessToken(user.id, user.role, sessionId);
    notifySaasMutation("auth:login");

    return {
      ok: true,
      accessToken: access.token,
      refreshToken: `${sessionId}.${refreshToken}`,
      accessExpiresAt: access.expiresAt,
      refreshExpiresAt,
      snapshot: this.snapshot(user.id, sessionId, access.expiresAt, refreshExpiresAt),
    };
  }

  authenticateAccessToken(token: string | null | undefined) {
    if (!token) return null;
    const payload = verifyJwt(token);
    if (!payload) return null;
    const refresh = this.refreshTokens.get(payload.sid);
    if (!refresh || refresh.revokedAt || refresh.userId !== payload.sub) return null;
    const user = usersService.findById(payload.sub);
    if (!user || user.status !== "ACTIVE") return null;
    return { user, sessionId: payload.sid, accessExpiresAt: new Date(payload.exp * 1000).toISOString(), refreshExpiresAt: refresh.expiresAt };
  }

  refresh(refreshCookie: string | null | undefined) {
    const parsed = this.parseRefreshCookie(refreshCookie);
    if (!parsed) return null;
    const record = this.refreshTokens.get(parsed.sessionId);
    if (!record || record.revokedAt || record.tokenHash !== sha256(parsed.token) || new Date(record.expiresAt).getTime() <= Date.now()) {
      if (record) this.refreshTokens.set(record.id, { ...record, revokedAt: nowIso() });
      if (record) notifySaasMutation("auth:refresh-revoke");
      return null;
    }

    const user = usersService.findById(record.userId);
    if (!user || user.status !== "ACTIVE") return null;
    const nextRecord: RefreshRecord = { ...record, lastSeenAt: nowIso() };
    this.refreshTokens.set(nextRecord.id, nextRecord);
    const access = this.issueAccessToken(user.id, user.role, record.id);
    notifySaasMutation("auth:refresh");

    return {
      user,
      sessionId: record.id,
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshExpiresAt: record.expiresAt,
      snapshot: this.snapshot(user.id, record.id, access.expiresAt, record.expiresAt),
    };
  }

  logout(refreshCookie: string | null | undefined) {
    const parsed = this.parseRefreshCookie(refreshCookie);
    if (!parsed) return;
    const record = this.refreshTokens.get(parsed.sessionId);
    if (record) {
      this.refreshTokens.set(record.id, { ...record, revokedAt: nowIso() });
      notifySaasMutation("auth:logout");
    }
  }

  logoutGlobal(userId: string) {
    for (const [id, record] of Array.from(this.refreshTokens.entries())) {
      if (record.userId === userId && !record.revokedAt) {
        this.refreshTokens.set(id, { ...record, revokedAt: nowIso() });
      }
    }
    notifySaasMutation("auth:logout-global");
  }

  changePassword(userId: string, currentPassword: string, nextPassword: string) {
    const user = usersService.findById(userId);
    const record = user ? this.passwords.get(user.id) : null;
    if (!user || !record || !verifyPassword(currentPassword, record)) {
      return { ok: false, status: 400, code: "INVALID_CURRENT_PASSWORD", message: "Current password is invalid." };
    }
    const validation = this.validateNewPassword(nextPassword);
    if (!validation.ok) return validation;

    this.setPassword(user.id, nextPassword);
    usersService.update(user.id, { firstLoginCompleted: true, mustChangePassword: false });
    return { ok: true, status: 200, message: "Password updated." };
  }

  requestPasswordReset(identifier: string) {
    const user = usersService.findByIdentifier(identifier);
    if (!user) {
      return { ok: true, message: "If the account exists, reset instructions were generated." };
    }

    const token = randomToken(32);
    this.resetTokens.set(sha256(token), {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: addSeconds(resetTtlSeconds),
      usedAt: null,
    });
    notifySaasMutation("auth:password-reset-requested");

    return {
      ok: true,
      message: "If the account exists, reset instructions were generated.",
    };
  }

  resetPassword(token: string, nextPassword: string) {
    const hash = sha256(token.trim());
    const record = this.resetTokens.get(hash);
    if (!record || record.usedAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      return { ok: false, status: 400, code: "RESET_TOKEN_INVALID", message: "Reset token is invalid or expired." };
    }
    const validation = this.validateNewPassword(nextPassword);
    if (!validation.ok) return validation;

    this.setPassword(record.userId, nextPassword);
    usersService.update(record.userId, { firstLoginCompleted: true, mustChangePassword: false });
    this.resetTokens.set(hash, { ...record, usedAt: nowIso() });
    this.logoutGlobal(record.userId);
    notifySaasMutation("auth:password-reset");
    return { ok: true, status: 200, message: "Password reset. Please log in again." };
  }

  exportPersistence() {
    return {
      passwords: Array.from(this.passwords.values()),
      refreshTokens: Array.from(this.refreshTokens.values()),
      resetTokens: Array.from(this.resetTokens.values()),
    };
  }

  importPersistence(input: {
    readonly passwords: readonly PasswordRecord[];
    readonly refreshTokens: readonly RefreshRecord[];
    readonly resetTokens: readonly ResetRecord[];
  }) {
    this.passwords.clear();
    this.refreshTokens.clear();
    this.resetTokens.clear();
    for (const password of input.passwords) this.passwords.set(stableUserId(password.userId), password);
    for (const refresh of input.refreshTokens) this.refreshTokens.set(refresh.id, refresh);
    for (const reset of input.resetTokens) this.resetTokens.set(reset.tokenHash, reset);
  }

  snapshot(userId: string, sessionId: string, accessExpiresAt: string, refreshExpiresAt: string): AuthSessionSnapshot {
    const user = usersService.findById(userId) ?? usersService.getOrCreate({ userId });
    const license = licenseEngineService.status(user.id);

    return {
      authenticated: true,
      user: safeUser(user),
      license,
      plan: license.plan,
      devices: license.devices,
      sessions: license.sessions,
      permissions: permissionsFor(user, license),
      session: {
        id: sessionId,
        expiresAt: accessExpiresAt,
        refreshExpiresAt,
        mustRefreshAt: accessExpiresAt,
      },
      readOnly: true,
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
      secretsExposed: false,
    };
  }

  private issueAccessToken(userId: string, role: UserRole, sessionId: string) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = issuedAt + accessTtlSeconds;
    const token = signJwt({
      sub: userId,
      sid: sessionId,
      role,
      type: "access",
      iat: issuedAt,
      exp: expiresAtSeconds,
    });

    return {
      token,
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    };
  }

  private setPassword(userId: string, password: string) {
    const timestamp = nowIso();
    const hashed = hashPassword(password);
    this.passwords.set(stableUserId(userId), {
      userId: stableUserId(userId),
      salt: hashed.salt,
      hash: hashed.hash,
      iterations: hashed.iterations,
      createdAt: this.passwords.get(stableUserId(userId))?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    notifySaasMutation("auth:password-set");
  }

  private generateTemporaryPassword() {
    return `Rzn-${randomToken(6)}-${new Date().getFullYear()}`;
  }

  private parseRefreshCookie(value: string | null | undefined) {
    if (!value) return null;
    const [sessionId, token] = value.split(".");
    if (!sessionId || !token) return null;
    return { sessionId, token };
  }

  private validateNewPassword(password: string) {
    if (password.length < 10) {
      return { ok: false as const, status: 400, code: "PASSWORD_TOO_SHORT", message: "Password must contain at least 10 characters." };
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return { ok: false as const, status: 400, code: "PASSWORD_WEAK", message: "Password must include uppercase, lowercase and a number." };
    }
    return { ok: true as const };
  }

  private checkLoginRate(ip: string, identifier: string) {
    const key = `${ip}:${identifier.trim().toLowerCase()}`;
    const current = this.loginAttempts.get(key);
    const now = nowMs();
    if (!current || current.resetAtMs <= now) return { allowed: true, retryAfterMs: 0 };
    return {
      allowed: current.count < loginMaxAttempts,
      retryAfterMs: Math.max(0, current.resetAtMs - now),
    };
  }

  private recordFailedLogin(ip: string, identifier: string) {
    const key = `${ip}:${identifier.trim().toLowerCase()}`;
    const current = this.loginAttempts.get(key);
    const now = nowMs();
    if (!current || current.resetAtMs <= now) {
      this.loginAttempts.set(key, { resetAtMs: now + loginWindowMs, count: 1 });
      return;
    }
    current.count += 1;
  }

  private resetLoginRate(ip: string, identifier: string) {
    this.loginAttempts.delete(`${ip}:${identifier.trim().toLowerCase()}`);
  }

  private hasOwnerOrAdmin() {
    return usersService.list().some(user => user.role === "OWNER" || user.role === "ADMIN");
  }

  ensureFirstOwner() {
    if (this.hasOwnerOrAdmin()) return false;
    const adminPassword = process.env.RAZON_ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "RazonAdmin!2026");
    if (!adminPassword) return false;

    const admin = this.provisionUser({
      userId: process.env.RAZON_ADMIN_USER_ID || "admin",
      username: process.env.RAZON_ADMIN_USERNAME || "admin",
      email: process.env.RAZON_ADMIN_EMAIL || "admin@razon.local",
      displayName: process.env.RAZON_ADMIN_NAME || "Razon Admin",
      role: "OWNER",
      temporaryPassword: adminPassword,
      mustChangePassword: process.env.RAZON_ADMIN_FORCE_PASSWORD_CHANGE !== "false",
      firstLoginCompleted: false,
    }).user;

    const existingStatus = licenseEngineService.status(admin.id);
    if (existingStatus.status === "MISSING") {
      const created = licenseEngineService.createLicense({
        userId: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        plan: "LIFETIME",
        duration: "LIFETIME",
        expiresAt: null,
      });
      licenseEngineService.activate({
        userId: admin.id,
        licenseKey: created.oneTimeLicenseKey,
        deviceId: "bootstrap-admin-device",
        sessionId: "bootstrap-admin-license-session",
      });
    }

    return true;
  }

  private ensureBootstrapAccounts() {
    this.ensureFirstOwner();
  }
}

export const authSessionService = new AuthSessionService();
