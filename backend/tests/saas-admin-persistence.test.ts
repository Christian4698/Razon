import { describe, expect, it } from "vitest";
import { createLicenseEngineService, licenseEngineService } from "../src/modules/licenses";
import { authSessionService } from "../src/modules/security/auth-session.service";
import {
  deleteConnectorSecret,
  exportConnectorSecretsPersistence,
  getSecretMetadata,
  importConnectorSecretsPersistence,
  markConnectorSecretTest,
  readConnectorSecret,
  saveConnectorSecret,
  type CurrentUserScope,
} from "../../server/services/connectors/connectorSecretsRepository";

describe("SaaS admin persistence contracts", () => {
  function provisionLicensedUser(userId: string, password: string, role: "OWNER" | "ADMIN" | "USER" = "USER") {
    const created = licenseEngineService.createLicense({
      userId,
      email: `${userId}@example.com`,
      displayName: userId,
      plan: "LIFETIME",
      duration: "LIFETIME",
    });
    authSessionService.provisionUser({
      userId,
      email: `${userId}@example.com`,
      username: userId,
      displayName: userId,
      role,
      temporaryPassword: password,
      mustChangePassword: false,
      firstLoginCompleted: true,
    });
    expect(licenseEngineService.activate({
      userId,
      licenseKey: created.oneTimeLicenseKey,
      deviceId: `${userId}-activation-device`,
      sessionId: `${userId}-activation-session`,
    }).ok).toBe(true);
  }

  it("exports and restores licenses, subscriptions, devices, sessions and audit logs", () => {
    const source = createLicenseEngineService();
    const created = source.createLicense({
      userId: "persist-user-a",
      email: "persist-a@example.com",
      displayName: "Persist A",
      plan: "PRO",
      duration: "2_MONTHS",
    });
    expect(source.activate({
      userId: "persist-user-a",
      licenseKey: created.oneTimeLicenseKey,
      deviceId: "persist-device",
      sessionId: "persist-session",
    }).ok).toBe(true);

    const restored = createLicenseEngineService();
    restored.importPersistence(source.exportPersistence());
    const snapshot = restored.status("persist-user-a");

    expect(snapshot.status).toBe("ACTIVE");
    expect(snapshot.plan).toBe("PRO");
    expect(snapshot.activeDevices).toBe(1);
    expect(snapshot.activeSessions).toBe(1);
    expect(restored.listAudit().some(log => log.event === "LICENSE_ACTIVATED")).toBe(true);
    expect(JSON.stringify(restored.listLicenses())).not.toContain(created.oneTimeLicenseKey);
  });

  it("keeps temporary password login server-side and requires password change flag", () => {
    const userId = `temp-user-${Date.now()}`;
    const provisioned = authSessionService.provisionUser({
      userId,
      email: `${userId}@example.com`,
      username: userId,
      displayName: "Temporary User",
      temporaryPassword: "TempPass1234",
      mustChangePassword: true,
    });
    const login = authSessionService.login({
      identifier: userId,
      password: "TempPass1234",
      rememberMe: false,
      ip: "test",
    });

    expect(provisioned.oneTimeTemporaryPassword).toBe("TempPass1234");
    expect(login.ok).toBe(true);
    if (login.ok) {
      expect(login.snapshot.user.mustChangePassword).toBe(true);
      expect(login.snapshot.liveExecutionEnabled).toBe(false);
      expect(login.snapshot.automaticTradingAllowed).toBe(false);
      expect(JSON.stringify(login.snapshot)).not.toContain("TempPass1234");
    }
  });

  it("generates a one-time temporary password for new admin-created users without persisting the raw value", () => {
    const userId = `generated-temp-user-${Date.now()}`;
    const provisioned = authSessionService.provisionUser({
      userId,
      email: `${userId}@example.com`,
      username: userId,
      displayName: "Generated Temporary User",
      mustChangePassword: true,
      firstLoginCompleted: false,
    });

    expect(provisioned.oneTimeTemporaryPassword).toMatch(/^Rzn-/);
    expect(provisioned.user.mustChangePassword).toBe(true);
    expect(provisioned.user.firstLoginCompleted).toBe(false);

    const temporaryPassword = provisioned.oneTimeTemporaryPassword ?? "";
    const login = authSessionService.login({
      identifier: userId,
      password: temporaryPassword,
      rememberMe: false,
      ip: "generated-temp-test",
    });

    expect(login.ok).toBe(true);
    if (login.ok) {
      expect(login.snapshot.user.mustChangePassword).toBe(true);
      expect(login.snapshot.user.firstLoginCompleted).toBe(false);
    }

    expect(JSON.stringify(authSessionService.exportPersistence())).not.toContain(temporaryPassword);
  });

  it("can rotate an existing admin-created user to a new temporary password without exposing the raw value in persistence", () => {
    const userId = `rotated-temp-user-${Date.now()}`;
    const first = authSessionService.provisionUser({
      userId,
      username: userId,
      temporaryPassword: "InitialPass1234",
      mustChangePassword: false,
      firstLoginCompleted: true,
    });
    const rotated = authSessionService.provisionUser({
      userId,
      username: userId,
      forceTemporaryPassword: true,
      mustChangePassword: true,
      firstLoginCompleted: false,
    });

    expect(first.oneTimeTemporaryPassword).toBe("InitialPass1234");
    expect(rotated.oneTimeTemporaryPassword).toMatch(/^Rzn-/);
    expect(rotated.oneTimeTemporaryPassword).not.toBe(first.oneTimeTemporaryPassword);

    const oldLogin = authSessionService.login({
      identifier: userId,
      password: "InitialPass1234",
      rememberMe: false,
      ip: "rotated-temp-old",
    });
    const newLogin = authSessionService.login({
      identifier: userId,
      password: rotated.oneTimeTemporaryPassword ?? "",
      rememberMe: false,
      ip: "rotated-temp-new",
    });

    expect(oldLogin.ok).toBe(false);
    expect(newLogin.ok).toBe(true);
    expect(JSON.stringify(authSessionService.exportPersistence())).not.toContain(rotated.oneTimeTemporaryPassword);
  });

  it("persists connector secret metadata without exposing raw secrets", () => {
    const user: CurrentUserScope = {
      scope: "CURRENT_USER",
      userId: "secret-user-a",
      displayName: "Secret User A",
    };

    const saved = saveConnectorSecret(user, "deriv-demo", "pat_secret_demo_token_1234");
    const exported = exportConnectorSecretsPersistence();
    deleteConnectorSecret(user, "deriv-demo");
    importConnectorSecretsPersistence(exported);
    const restored = getSecretMetadata(user, "deriv-demo");

    expect(saved.saved).toBe(true);
    expect(restored.saved).toBe(true);
    expect(restored.maskedPreview).toBe("****1234");
    expect(JSON.stringify(exported)).not.toContain("pat_secret_demo_token_1234");
  });

  it("persists Deriv personal connector test state without exposing the raw token", () => {
    const user: CurrentUserScope = {
      scope: "CURRENT_USER",
      userId: "secret-user-deriv-demo",
      displayName: "Secret User Deriv Demo",
    };

    saveConnectorSecret(user, "deriv-demo", "pat_personal_demo_token_9876");
    markConnectorSecretTest(user, "deriv-demo", {
      connected: true,
      accountType: "DEMO",
      status: "CONNECTED",
      source: "PERSONAL_DERIV_DEMO",
    });

    const exported = exportConnectorSecretsPersistence();
    deleteConnectorSecret(user, "deriv-demo");
    importConnectorSecretsPersistence(exported);

    const metadata = getSecretMetadata(user, "deriv-demo");

    expect(metadata.saved).toBe(true);
    expect(metadata.connected).toBe(true);
    expect(metadata.accountType).toBe("DEMO");
    expect(metadata.source).toBe("PERSONAL_DERIV_DEMO");
    expect(readConnectorSecret(user, "deriv-demo")).toBe("pat_personal_demo_token_9876");
    expect(JSON.stringify(exported)).not.toContain("pat_personal_demo_token_9876");
    expect(JSON.stringify(metadata)).not.toContain("pat_personal_demo_token_9876");
  });

  it("marks expired licenses read-only after restore", () => {
    const source = createLicenseEngineService();
    source.createLicense({
      userId: "expired-persist-user",
      plan: "STARTER",
      duration: "1_MONTH",
      expiresAt: "2020-01-01T00:00:00.000Z",
    });

    const restored = createLicenseEngineService();
    restored.importPersistence(source.exportPersistence());
    const snapshot = restored.status("expired-persist-user");

    expect(snapshot.status).toBe("EXPIRED");
    expect(snapshot.limitedReadOnly).toBe(true);
    expect(snapshot.liveExecutionEnabled).toBe(false);
  });

  it("tracks admin and Zeus auth sessions globally while keeping current-user license counts scoped", () => {
    const suffix = Date.now();
    const adminId = `session-admin-${suffix}`;
    const zeusId = `session-zeus-${suffix}`;
    provisionLicensedUser(adminId, "AdminPass1234", "ADMIN");
    provisionLicensedUser(zeusId, "ZeusPass1234", "USER");

    const before = authSessionService.listSessionActivity();
    const adminLogin = authSessionService.login({
      identifier: adminId,
      password: "AdminPass1234",
      rememberMe: false,
      ip: "203.0.113.10",
      userAgent: "Admin Test Browser",
      deviceId: "admin-device-a",
    });
    const zeusLogin = authSessionService.login({
      identifier: zeusId,
      password: "ZeusPass1234",
      rememberMe: false,
      ip: "203.0.113.11",
      userAgent: "Zeus Test Browser",
      deviceId: "zeus-device-b",
    });

    expect(adminLogin.ok).toBe(true);
    expect(zeusLogin.ok).toBe(true);

    const activity = authSessionService.listSessionActivity();
    expect(activity.activeSessions).toBeGreaterThanOrEqual(before.activeSessions + 2);
    expect(activity.activeDevices).toBeGreaterThanOrEqual(before.activeDevices + 2);
    expect(activity.byUser.find(user => user.userId === adminId)?.activeSessions).toBe(1);
    expect(activity.byUser.find(user => user.userId === zeusId)?.activeSessions).toBe(1);
    expect(JSON.stringify(activity)).not.toContain("203.0.113.10");
    expect(JSON.stringify(activity)).toContain("Admin Test Browser");
    expect(activity.byUser.find(user => user.userId === adminId)?.sessions[0]?.ipHash).toMatch(/^[a-f0-9]{12}\.\.\.$/);

    const adminLicense = licenseEngineService.status(adminId);
    const zeusLicense = licenseEngineService.status(zeusId);
    expect(adminLicense.userId).toBe(adminId);
    expect(zeusLicense.userId).toBe(zeusId);
    expect(adminLicense.activeDevices).toBeGreaterThanOrEqual(1);
    expect(zeusLicense.activeDevices).toBeGreaterThanOrEqual(1);
  });

  it("expires inactive sessions after five minutes and heartbeat restores current activity", () => {
    const userId = `session-timeout-${Date.now()}`;
    provisionLicensedUser(userId, "TimeoutPass1234");
    const login = authSessionService.login({
      identifier: userId,
      password: "TimeoutPass1234",
      rememberMe: false,
      ip: "198.51.100.20",
      userAgent: "Timeout Test Browser",
      deviceId: "timeout-device",
    });
    expect(login.ok).toBe(true);
    if (!login.ok) return;

    const stale = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    expect(authSessionService.setSessionLastSeenForTest(login.snapshot.session.id, stale)).toBe(true);
    const expired = authSessionService.listSessionActivity().sessions.find(session => session.id === login.snapshot.session.id);
    expect(expired?.status).toBe("EXPIRED");

    const heartbeat = authSessionService.heartbeat(userId, login.snapshot.session.id);
    expect(heartbeat?.status).toBe("ACTIVE");
  });

  it("force logout revokes user auth sessions and license sessions", () => {
    const userId = `session-revoke-${Date.now()}`;
    provisionLicensedUser(userId, "RevokePass1234");
    const login = authSessionService.login({
      identifier: userId,
      password: "RevokePass1234",
      rememberMe: false,
      ip: "198.51.100.30",
      userAgent: "Revoke Test Browser",
      deviceId: "revoke-device",
    });
    expect(login.ok).toBe(true);
    if (!login.ok) return;

    authSessionService.logoutGlobal(userId);
    const activity = authSessionService.listSessionActivity();
    const session = activity.sessions.find(item => item.id === login.snapshot.session.id);
    expect(session?.status).toBe("REVOKED");
    expect(activity.byUser.find(user => user.userId === userId)?.activeSessions).toBe(0);
    expect(licenseEngineService.status(userId).sessions.every(item => item.revoked)).toBe(true);
  });
});
