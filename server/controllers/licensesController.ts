import type { Request, Response } from "express";
import { licenseEngineService, type LicenseDuration, type LicensePlan } from "../../backend/src/modules/licenses";
import { authSessionService } from "../../backend/src/modules/security/auth-session.service";
import { usersService, type UserRole, type UserStatus } from "../../backend/src/modules/users";
import { getCurrentUserScope } from "../services/connectors/connectorSecretsRepository";
import { sendJson } from "../utils/http";

const licensePlans = new Set<LicensePlan>(["STARTER", "PRO", "ELITE", "LIFETIME"]);
const licenseDurations = new Set<LicenseDuration>(["1_MONTH", "2_MONTHS", "3_MONTHS", "6_MONTHS", "1_YEAR", "LIFETIME"]);
const userRoles = new Set<UserRole>(["OWNER", "ADMIN", "USER"]);
const userStatuses = new Set<UserStatus>(["ACTIVE", "DISABLED"]);

function body(req: Request) {
  return (req.body ?? {}) as Record<string, unknown>;
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function planField(value: unknown): LicensePlan {
  const candidate = stringField(value).toUpperCase() as LicensePlan;
  return licensePlans.has(candidate) ? candidate : "STARTER";
}

function durationField(value: unknown, plan: LicensePlan): LicenseDuration {
  const candidate = stringField(value).toUpperCase() as LicenseDuration;
  if (licenseDurations.has(candidate)) return candidate;
  return plan === "LIFETIME" ? "LIFETIME" : "1_MONTH";
}

function roleField(value: unknown): UserRole {
  const candidate = stringField(value).toUpperCase() as UserRole;
  return userRoles.has(candidate) ? candidate : "USER";
}

function statusField(value: unknown): UserStatus {
  const candidate = stringField(value).toUpperCase() as UserStatus;
  return userStatuses.has(candidate) ? candidate : "ACTIVE";
}

function currentUserId(req: Request) {
  return getCurrentUserScope(req).userId;
}

export function getLicenseStatus(req: Request, res: Response) {
  return sendJson(res, licenseEngineService.status(currentUserId(req)));
}

export function createLicense(req: Request, res: Response) {
  const payload = body(req);
  const plan = planField(payload.plan);
  const duration = durationField(payload.duration, plan);
  const targetUserId = stringField(payload.userId) || currentUserId(req);
  const result = licenseEngineService.createLicense({
    userId: targetUserId,
    email: stringField(payload.email) || undefined,
    displayName: stringField(payload.displayName) || undefined,
    plan,
    duration,
    expiresAt: stringField(payload.expiresAt) || undefined,
  });
  const account = authSessionService.provisionUser({
    userId: result.license.userId,
    email: stringField(payload.email) || `${result.license.userId}@local.razon`,
    username: stringField(payload.username) || result.license.userId,
    displayName: stringField(payload.displayName) || result.license.userId,
    role: roleField(payload.role),
    mustChangePassword: true,
  });

  return res.status(201).json({
    ...result,
    account: {
      user: account.user,
      oneTimeTemporaryPassword: account.oneTimeTemporaryPassword,
      warning: account.oneTimeTemporaryPassword ? "TEMPORARY_PASSWORD_VISIBLE_ONCE" : "ACCOUNT_ALREADY_PROVISIONED",
    },
    readOnly: true as const,
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}

export function activateLicense(req: Request, res: Response) {
  const role = (req as Request & { auth?: { role?: string } }).auth?.role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return res.status(403).json({
      ok: false,
      error: "SELF_LICENSE_ACTIVATION_DISABLED",
      message: "License assignment is managed by an administrator.",
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
      secretsExposed: false,
    });
  }

  const payload = body(req);
  const licenseKey = stringField(payload.licenseKey);
  if (!licenseKey) {
    return res.status(400).json({
      ok: false,
      error: "LICENSE_KEY_REQUIRED",
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
    });
  }

  return sendJson(res, licenseEngineService.activate({
    userId: currentUserId(req),
    licenseKey,
    deviceId: stringField(payload.deviceId) || req.header("x-razon-device-id") || undefined,
    deviceLabel: stringField(payload.deviceLabel) || undefined,
    sessionId: stringField(payload.sessionId) || req.header("x-razon-session-id") || undefined,
  }));
}

export function renewLicense(req: Request, res: Response) {
  const payload = body(req);
  const duration = stringField(payload.duration).toUpperCase() as LicenseDuration;
  return sendJson(res, licenseEngineService.renew({
    userId: stringField(payload.userId) || currentUserId(req),
    licenseId: stringField(payload.licenseId) || undefined,
    duration: licenseDurations.has(duration) ? duration : undefined,
    reason: stringField(payload.reason) || undefined,
  }));
}

export function suspendLicense(req: Request, res: Response) {
  const payload = body(req);
  return sendJson(res, licenseEngineService.suspend({
    userId: stringField(payload.userId) || currentUserId(req),
    licenseId: stringField(payload.licenseId) || undefined,
    reason: stringField(payload.reason) || "manual suspension",
  }));
}

export function revokeLicense(req: Request, res: Response) {
  const payload = body(req);
  return sendJson(res, licenseEngineService.revoke({
    userId: stringField(payload.userId) || currentUserId(req),
    licenseId: stringField(payload.licenseId) || undefined,
    reason: stringField(payload.reason) || "manual revocation",
  }));
}

export function listAdminLicenses(_req: Request, res: Response) {
  return sendJson(res, {
    licenses: licenseEngineService.listLicenses(),
    audit: licenseEngineService.listAudit(),
    readOnly: true as const,
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}

export function listAdminUsers(_req: Request, res: Response) {
  return sendJson(res, {
    users: licenseEngineService.listUsers(),
    readOnly: true as const,
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}

export function createAdminUser(req: Request, res: Response) {
  const payload = body(req);
  const account = authSessionService.provisionUser({
    userId: stringField(payload.userId) || stringField(payload.username) || stringField(payload.email) || undefined,
    username: stringField(payload.username) || undefined,
    email: stringField(payload.email) || undefined,
    displayName: stringField(payload.displayName) || undefined,
    role: roleField(payload.role),
    temporaryPassword: stringField(payload.temporaryPassword) || undefined,
    mustChangePassword: payload.mustChangePassword === false ? false : true,
    firstLoginCompleted: false,
  });

  return res.status(201).json({
    user: account.user,
    oneTimeTemporaryPassword: account.oneTimeTemporaryPassword,
    warning: account.oneTimeTemporaryPassword ? "TEMPORARY_PASSWORD_VISIBLE_ONCE" : "ACCOUNT_ALREADY_PROVISIONED",
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}

export function updateAdminUser(req: Request, res: Response) {
  const userId = stringField(req.params.id);
  const payload = body(req);
  const updated = usersService.update(userId, {
    username: stringField(payload.username) || undefined,
    email: stringField(payload.email) || undefined,
    displayName: stringField(payload.displayName) || undefined,
    role: payload.role ? roleField(payload.role) : undefined,
    status: payload.status ? statusField(payload.status) : undefined,
    firstLoginCompleted: typeof payload.firstLoginCompleted === "boolean" ? payload.firstLoginCompleted : undefined,
    mustChangePassword: typeof payload.mustChangePassword === "boolean" ? payload.mustChangePassword : undefined,
  });
  if (!updated) {
    return res.status(404).json({ error: "USER_NOT_FOUND", liveExecutionEnabled: false, automaticTradingAllowed: false, secretsExposed: false });
  }

  return sendJson(res, {
    user: updated,
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}

export function suspendAdminUser(req: Request, res: Response) {
  const updated = usersService.update(stringField(req.params.id), { status: "DISABLED" });
  if (!updated) {
    return res.status(404).json({ error: "USER_NOT_FOUND", liveExecutionEnabled: false, automaticTradingAllowed: false, secretsExposed: false });
  }
  authSessionService.logoutGlobal(updated.id);
  return sendJson(res, {
    user: updated,
    message: "User suspended and sessions revoked.",
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}

export function deleteAdminUser(req: Request, res: Response) {
  const updated = usersService.update(stringField(req.params.id), { status: "DISABLED" });
  if (!updated) {
    return res.status(404).json({ error: "USER_NOT_FOUND", liveExecutionEnabled: false, automaticTradingAllowed: false, secretsExposed: false });
  }
  authSessionService.logoutGlobal(updated.id);
  return sendJson(res, {
    ok: true,
    user: updated,
    message: "User disabled. Hard deletion is intentionally avoided to preserve audit history.",
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}

export function forceLogoutAdminUser(req: Request, res: Response) {
  const userId = stringField(req.params.id);
  authSessionService.logoutGlobal(userId);
  return sendJson(res, {
    ok: true,
    userId,
    message: "User sessions revoked.",
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}

export function listAdminDevices(_req: Request, res: Response) {
  const snapshot = licenseEngineService.exportPersistence();
  return sendJson(res, {
    devices: snapshot.devices,
    sessions: snapshot.licenseSessions,
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}

export function listAdminAuditLogs(_req: Request, res: Response) {
  return sendJson(res, {
    auditLogs: licenseEngineService.listAudit(),
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}
