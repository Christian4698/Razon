import crypto from "crypto";
import { createDevicesService, type DevicesService } from "../devices";
import { createLicenseAuditService, type LicenseAuditService } from "../audit";
import { createSessionsService, type SessionsService } from "../sessions";
import { usersService, type UsersService } from "../users";
import { notifySaasMutation } from "../persistence/persistence-bus";
import type {
  ActivateLicenseInput,
  CreateLicenseInput,
  CreateLicenseResult,
  License,
  LicenseActionInput,
  LicenseActionResult,
  LicenseDuration,
  LicensePlan,
  LicensePlanDefinition,
  LicenseStatus,
  LicenseStatusSnapshot,
  SafeLicense,
  Subscription,
} from "./license.types";

const PLAN_DEFINITIONS: Readonly<Record<LicensePlan, LicensePlanDefinition>> = {
  STARTER: { plan: "STARTER", label: "Starter", deviceLimit: 1, sessionLimit: 1 },
  PRO: { plan: "PRO", label: "Pro", deviceLimit: 2, sessionLimit: 3 },
  ELITE: { plan: "ELITE", label: "Elite", deviceLimit: 5, sessionLimit: 8 },
  LIFETIME: { plan: "LIFETIME", label: "Lifetime", deviceLimit: 10, sessionLimit: 20 },
};
const ACTIVE_SESSION_WINDOW_MS = Number(process.env.AUTH_ACTIVE_SESSION_WINDOW_MS ?? 5 * 60 * 1000);

const DURATION_MONTHS: Readonly<Record<Exclude<LicenseDuration, "LIFETIME">, number>> = {
  "1_MONTH": 1,
  "2_MONTHS": 2,
  "3_MONTHS": 3,
  "6_MONTHS": 6,
  "1_YEAR": 12,
};

function nowDate() {
  return new Date();
}

function iso(date: Date | string | null | undefined) {
  if (!date) return null;
  return typeof date === "string" ? new Date(date).toISOString() : date.toISOString();
}

function nowIso() {
  return nowDate().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeUserAgent(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 180);
}

function generateLicenseKey(plan: LicensePlan) {
  const secret = crypto.randomBytes(24).toString("base64url").toUpperCase();
  return `RZN-${plan}-${secret}`;
}

function previewLicenseKey(key: string) {
  return `****${key.slice(-4)}`;
}

function addDuration(start: Date, duration: LicenseDuration) {
  if (duration === "LIFETIME") return null;
  const next = new Date(start);
  next.setMonth(next.getMonth() + DURATION_MONTHS[duration]);
  return next;
}

function toSafeLicense(license: License): SafeLicense {
  return {
    id: license.id,
    userId: license.userId,
    plan: license.plan,
    duration: license.duration,
    status: license.status,
    licenseKeyPreview: license.licenseKeyPreview,
    createdAt: license.createdAt,
    activatedAt: license.activatedAt,
    expiresAt: license.expiresAt,
    suspendedAt: license.suspendedAt,
    revokedAt: license.revokedAt,
    subscriptionId: license.subscriptionId,
  };
}

function isExpired(license: License, at = nowDate()) {
  return Boolean(license.expiresAt && new Date(license.expiresAt).getTime() <= at.getTime());
}

function isRecentlySeen(lastSeenAt: string, at = nowDate()) {
  return new Date(lastSeenAt).getTime() > at.getTime() - ACTIVE_SESSION_WINDOW_MS;
}

export class LicenseEngineService {
  private readonly licenses = new Map<string, License>();
  private readonly subscriptions = new Map<string, Subscription>();

  constructor(
    private readonly users: UsersService = usersService,
    private readonly devices: DevicesService = createDevicesService(),
    private readonly sessions: SessionsService = createSessionsService(),
    private readonly audit: LicenseAuditService = createLicenseAuditService(),
  ) {}

  plans(): readonly LicensePlanDefinition[] {
    return Object.values(PLAN_DEFINITIONS);
  }

  createLicense(input: CreateLicenseInput): CreateLicenseResult {
    const user = this.users.getOrCreate({
      userId: input.userId,
      email: input.email,
      displayName: input.displayName,
    });
    const timestamp = nowIso();
    const startsAt = input.startsAt ? new Date(input.startsAt) : nowDate();
    const licenseKey = generateLicenseKey(input.plan);
    const licenseId = createId("license");
    const subscriptionId = createId("sub");
    const expiresAt = input.expiresAt === undefined ? addDuration(startsAt, input.duration) : input.expiresAt ? new Date(input.expiresAt) : null;
    const license: License = {
      id: licenseId,
      userId: user.id,
      plan: input.plan,
      duration: input.duration,
      status: "PENDING",
      licenseKeyHash: sha256(licenseKey),
      licenseKeyPreview: previewLicenseKey(licenseKey),
      createdAt: timestamp,
      activatedAt: null,
      expiresAt: iso(expiresAt),
      suspendedAt: null,
      revokedAt: null,
      subscriptionId,
    };
    const subscription: Subscription = {
      id: subscriptionId,
      userId: user.id,
      licenseId,
      plan: input.plan,
      status: "PENDING",
      startedAt: null,
      expiresAt: license.expiresAt,
      renewedAt: null,
      paymentProvider: "NONE",
    };

    this.licenses.set(licenseId, license);
    this.subscriptions.set(subscriptionId, subscription);
    notifySaasMutation("licenses:create");
    this.audit.log({
      userId: user.id,
      licenseId,
      event: "LICENSE_CREATED",
      status: "PENDING",
      message: "License key generated server-side and stored as hash only.",
      metadata: { plan: input.plan, duration: input.duration },
    });

    return {
      license: toSafeLicense(license),
      oneTimeLicenseKey: licenseKey,
      warning: "LICENSE_KEY_VISIBLE_ONCE",
    };
  }

  activate(input: ActivateLicenseInput): LicenseActionResult {
    const user = this.users.getOrCreate({ userId: input.userId });
    const hash = sha256(input.licenseKey.trim());
    const license = Array.from(this.licenses.values()).find(item => item.licenseKeyHash === hash);

    if (!license || license.userId !== user.id) {
      this.audit.log({
        userId: user.id,
        licenseId: license?.id ?? null,
        event: "LICENSE_ACTIVATION_FAILED",
        status: license?.status ?? "MISSING",
        message: "License activation failed for current user scope.",
      });
      return this.actionResult(user.id, null, false, "License required or does not belong to current user.");
    }

    const current = this.refreshLicenseStatus(license);
    if (current.status === "EXPIRED" || current.status === "SUSPENDED" || current.status === "REVOKED") {
      return this.actionResult(user.id, current, false, `License ${current.status.toLowerCase()}.`);
    }

    const plan = PLAN_DEFINITIONS[current.plan];
    const existingDevices = this.devices.listByLicense(current.id);
    const activeExistingDevices = existingDevices.filter(device => isRecentlySeen(device.lastSeenAt));
    const requestedDeviceId = input.deviceId?.trim() || `${user.id}:default-device`;
    const deviceAlreadyRegistered = existingDevices.some(device => device.fingerprintHash === sha256(requestedDeviceId));
    if (!deviceAlreadyRegistered && activeExistingDevices.length >= plan.deviceLimit) {
      this.audit.log({
        userId: user.id,
        licenseId: current.id,
        event: "DEVICE_LIMIT_REACHED",
        status: current.status,
        message: "Device limit reached during license activation.",
        metadata: { deviceLimit: plan.deviceLimit, activeDevices: activeExistingDevices.length },
      });
      return this.actionResult(user.id, current, false, "Device limit reached.");
    }

    const device = this.devices.register({
      userId: user.id,
      licenseId: current.id,
      deviceId: requestedDeviceId,
      label: input.deviceLabel,
    });
    const existingSessions = this.sessions.listByLicense(current.id);
    const activeExistingSessions = existingSessions.filter(session => isRecentlySeen(session.lastSeenAt));
    const requestedSessionId = input.sessionId?.trim() || `${user.id}:default-session`;
    const sessionAlreadyRegistered = existingSessions.some(session => session.id === sha256(`${user.id}:${current.id}:${device.id}:${requestedSessionId}`).slice(0, 24));
    if (!sessionAlreadyRegistered && activeExistingSessions.length >= plan.sessionLimit) {
      this.audit.log({
        userId: user.id,
        licenseId: current.id,
        event: "SESSION_LIMIT_REACHED",
        status: current.status,
        message: "Session limit reached during license activation.",
        metadata: { sessionLimit: plan.sessionLimit, activeSessions: activeExistingSessions.length },
      });
      return this.actionResult(user.id, current, false, "Session limit reached.");
    }

    this.sessions.start({
      userId: user.id,
      licenseId: current.id,
      deviceId: device.id,
      sessionId: requestedSessionId,
    });

    const activatedAt = current.activatedAt ?? nowIso();
    const nextLicense: License = { ...current, status: "ACTIVE", activatedAt };
    const subscription = this.subscriptions.get(current.subscriptionId);
    this.licenses.set(nextLicense.id, nextLicense);
    if (subscription) {
      this.subscriptions.set(subscription.id, {
        ...subscription,
        status: "ACTIVE",
        startedAt: subscription.startedAt ?? activatedAt,
        expiresAt: nextLicense.expiresAt,
      });
    }
    notifySaasMutation("licenses:activate");
    this.audit.log({
      userId: user.id,
      licenseId: nextLicense.id,
      event: "LICENSE_ACTIVATED",
      status: "ACTIVE",
      message: "License activated for current user.",
      metadata: { deviceId: device.id, sessionId: requestedSessionId },
    });

    return this.actionResult(user.id, nextLicense, true, "License active.");
  }

  status(userId: string): LicenseStatusSnapshot {
    const user = this.users.getOrCreate({ userId });
    const license = this.currentLicenseForUser(user.id);
    if (!license) return this.snapshot(user.id, null, "License required.");
    return this.snapshot(user.id, this.refreshLicenseStatus(license));
  }

  bindAuthSession(input: {
    readonly userId: string;
    readonly sessionId: string;
    readonly deviceId?: string;
    readonly userAgent?: string | null;
    readonly ipHash?: string | null;
  }) {
    const user = this.users.getOrCreate({ userId: input.userId });
    const license = this.currentLicenseForUser(user.id);
    const refreshed = license ? this.refreshLicenseStatus(license) : null;
    if (!refreshed || refreshed.status === "REVOKED" || refreshed.status === "SUSPENDED") {
      return { licenseId: null, deviceId: null };
    }

    const rawDeviceId = input.deviceId?.trim() || `${user.id}:${safeUserAgent(input.userAgent) ?? "unknown-device"}`;
    const device = this.devices.register({
      userId: user.id,
      licenseId: refreshed.id,
      deviceId: rawDeviceId,
      label: safeUserAgent(input.userAgent) ?? "Current device",
      userAgent: safeUserAgent(input.userAgent),
      ipHash: input.ipHash ?? null,
    });
    this.sessions.start({
      userId: user.id,
      licenseId: refreshed.id,
      deviceId: device.id,
      sessionId: input.sessionId,
      userAgent: safeUserAgent(input.userAgent),
      ipHash: input.ipHash ?? null,
    });

    return { licenseId: refreshed.id, deviceId: device.id };
  }

  heartbeatAuthSession(userId: string, sessionId: string, deviceId?: string | null) {
    const license = this.currentLicenseForUser(userId);
    const refreshed = license ? this.refreshLicenseStatus(license) : null;
    if (!refreshed || !deviceId) return false;
    this.devices.touch(deviceId);
    return Boolean(this.sessions.touchByRawSessionId({ userId, licenseId: refreshed.id, deviceId, sessionId }));
  }

  revokeAuthSession(userId: string, sessionId: string, deviceId?: string | null) {
    const license = this.currentLicenseForUser(userId);
    const refreshed = license ? this.refreshLicenseStatus(license) : null;
    if (!refreshed || !deviceId) return false;
    return this.sessions.revokeByRawSessionId({ userId, licenseId: refreshed.id, deviceId, sessionId });
  }

  revokeUserSessions(userId: string) {
    return this.sessions.revokeByUser(userId);
  }

  renew(input: LicenseActionInput): LicenseActionResult {
    const license = this.findLicense(input);
    if (!license) return this.actionResult(input.userId ?? "demo-current-user", null, false, "License required.");

    const duration = input.duration ?? license.duration;
    const start = license.expiresAt && new Date(license.expiresAt).getTime() > Date.now() ? new Date(license.expiresAt) : nowDate();
    const expiresAt = addDuration(start, duration);
    const next: License = {
      ...license,
      duration,
      status: "ACTIVE",
      expiresAt: iso(expiresAt),
      revokedAt: null,
      suspendedAt: null,
    };
    const subscription = this.subscriptions.get(next.subscriptionId);
    this.licenses.set(next.id, next);
    if (subscription) {
      this.subscriptions.set(subscription.id, {
        ...subscription,
        status: "ACTIVE",
        expiresAt: next.expiresAt,
        renewedAt: nowIso(),
      });
    }
    notifySaasMutation("licenses:renew");
    this.audit.log({
      userId: next.userId,
      licenseId: next.id,
      event: "LICENSE_RENEWED",
      status: "ACTIVE",
      message: "License renewed without payment integration.",
      metadata: { duration },
    });

    return this.actionResult(next.userId, next, true, "License renewed.");
  }

  suspend(input: LicenseActionInput): LicenseActionResult {
    return this.setStatus(input, "SUSPENDED", "LICENSE_SUSPENDED", "License suspended.");
  }

  revoke(input: LicenseActionInput): LicenseActionResult {
    return this.setStatus(input, "REVOKED", "LICENSE_REVOKED", "License revoked.");
  }

  listLicenses(): readonly SafeLicense[] {
    return Array.from(this.licenses.values()).map(license => toSafeLicense(this.refreshLicenseStatus(license)));
  }

  listUsers() {
    return this.users.list().map(user => ({
      ...user,
      license: this.status(user.id).license,
    }));
  }

  listAudit() {
    return this.audit.list();
  }

  exportPersistence() {
    return {
      licenses: Array.from(this.licenses.values()),
      subscriptions: Array.from(this.subscriptions.values()),
      devices: this.devices.exportPersistence(),
      licenseSessions: this.sessions.exportPersistence(),
      auditLogs: this.audit.exportPersistence(),
    };
  }

  importPersistence(input: {
    readonly licenses: readonly License[];
    readonly subscriptions: readonly Subscription[];
    readonly devices: readonly import("../devices").Device[];
    readonly licenseSessions: readonly import("../sessions").UserSession[];
    readonly auditLogs: readonly import("../audit").LicenseActivationLog[];
  }) {
    this.licenses.clear();
    this.subscriptions.clear();
    for (const license of input.licenses) this.licenses.set(license.id, license);
    for (const subscription of input.subscriptions) this.subscriptions.set(subscription.id, subscription);
    this.devices.importPersistence(input.devices);
    this.sessions.importPersistence(input.licenseSessions);
    this.audit.importPersistence(input.auditLogs);
  }

  reset() {
    this.licenses.clear();
    this.subscriptions.clear();
    this.users.reset();
    this.devices.reset();
    this.sessions.reset();
    this.audit.reset();
    notifySaasMutation("licenses:reset");
  }

  private currentLicenseForUser(userId: string) {
    return Array.from(this.licenses.values())
      .filter(license => license.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }

  private findLicense(input: LicenseActionInput) {
    if (input.licenseId) return this.licenses.get(input.licenseId) ?? null;
    if (input.userId) return this.currentLicenseForUser(input.userId);
    return null;
  }

  private refreshLicenseStatus(license: License) {
    if ((license.status === "ACTIVE" || license.status === "PENDING") && isExpired(license)) {
      const next: License = { ...license, status: "EXPIRED" };
      this.licenses.set(next.id, next);
      const subscription = this.subscriptions.get(next.subscriptionId);
      if (subscription) this.subscriptions.set(subscription.id, { ...subscription, status: "EXPIRED" });
      notifySaasMutation("licenses:expired");
      this.audit.log({
        userId: next.userId,
        licenseId: next.id,
        event: "LICENSE_EXPIRED",
        status: "EXPIRED",
        message: "License expired server-side.",
      });
      return next;
    }

    return license;
  }

  private setStatus(
    input: LicenseActionInput,
    status: Extract<LicenseStatus, "SUSPENDED" | "REVOKED">,
    event: "LICENSE_SUSPENDED" | "LICENSE_REVOKED",
    message: string,
  ): LicenseActionResult {
    const license = this.findLicense(input);
    if (!license) return this.actionResult(input.userId ?? "demo-current-user", null, false, "License required.");
    const timestamp = nowIso();
    const next: License = {
      ...license,
      status,
      suspendedAt: status === "SUSPENDED" ? timestamp : license.suspendedAt,
      revokedAt: status === "REVOKED" ? timestamp : license.revokedAt,
    };
    const subscription = this.subscriptions.get(next.subscriptionId);
    this.licenses.set(next.id, next);
    if (subscription) this.subscriptions.set(subscription.id, { ...subscription, status });
    notifySaasMutation(`licenses:${status.toLowerCase()}`);
    this.audit.log({
      userId: next.userId,
      licenseId: next.id,
      event,
      status,
      message,
      metadata: { reason: input.reason ?? "not provided" },
    });

    return this.actionResult(next.userId, next, true, message);
  }

  private actionResult(userId: string, license: License | null, ok: boolean, message: string): LicenseActionResult {
    const snapshot = this.snapshot(userId, license, message);
    return {
      ok,
      status: snapshot.status,
      message,
      snapshot,
    };
  }

  private snapshot(userId: string, license: License | null, overrideMessage?: string): LicenseStatusSnapshot {
    const refreshed = license ? this.refreshLicenseStatus(license) : null;
    const subscription = refreshed ? this.subscriptions.get(refreshed.subscriptionId) ?? null : null;
    const plan = refreshed ? PLAN_DEFINITIONS[refreshed.plan] : null;
    const devices = refreshed ? this.devices.listByLicense(refreshed.id) : [];
    const sessions = refreshed ? this.sessions.listByLicense(refreshed.id) : [];
    const activeDevices = devices.filter(device => isRecentlySeen(device.lastSeenAt));
    const activeSessions = sessions.filter(session => isRecentlySeen(session.lastSeenAt));
    const status = refreshed?.status ?? "MISSING";
    const dashboardBlocked = status === "MISSING" || status === "EXPIRED" || status === "SUSPENDED" || status === "REVOKED";
    const warnings: string[] = [];

    if (status === "MISSING") warnings.push("LICENSE REQUIRED");
    if (status === "EXPIRED") warnings.push("LICENSE EXPIRED");
    if (status === "SUSPENDED") warnings.push("LICENSE SUSPENDED");
    if (status === "REVOKED") warnings.push("LICENSE REVOKED");
    if (plan && activeDevices.length >= plan.deviceLimit) warnings.push("DEVICE LIMIT REACHED");
    if (plan && activeSessions.length >= plan.sessionLimit) warnings.push("SESSION LIMIT REACHED");

    return {
      userId,
      license: refreshed ? toSafeLicense(refreshed) : null,
      subscription,
      plan: refreshed?.plan ?? "NONE",
      status,
      expiryDate: refreshed?.expiresAt ?? null,
      deviceLimit: plan?.deviceLimit ?? null,
      activeDevices: activeDevices.length,
      sessionLimit: plan?.sessionLimit ?? null,
      activeSessions: activeSessions.length,
      devices,
      sessions,
      dashboardBlocked,
      limitedReadOnly: dashboardBlocked,
      readOnly: true,
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
      message: overrideMessage ?? (dashboardBlocked ? "License required for full dashboard access." : "License active."),
      warnings,
    };
  }
}

export function createLicenseEngineService() {
  return new LicenseEngineService();
}

export const licenseEngineService = createLicenseEngineService();
