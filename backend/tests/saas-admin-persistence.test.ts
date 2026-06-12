import { describe, expect, it } from "vitest";
import { createLicenseEngineService } from "../src/modules/licenses";
import { authSessionService } from "../src/modules/security/auth-session.service";
import {
  deleteConnectorSecret,
  exportConnectorSecretsPersistence,
  getSecretMetadata,
  importConnectorSecretsPersistence,
  saveConnectorSecret,
  type CurrentUserScope,
} from "../../server/services/connectors/connectorSecretsRepository";

describe("SaaS admin persistence contracts", () => {
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
});
