import { describe, expect, it } from "vitest";
import { createLicenseEngineService } from "./license-engine.service";

describe("LicenseEngineService", () => {
  it("activates a server-generated license without exposing the stored hash", () => {
    const service = createLicenseEngineService();
    const created = service.createLicense({
      userId: "user-a",
      plan: "PRO",
      duration: "1_MONTH",
    });

    expect(created.oneTimeLicenseKey).toMatch(/^RZN-PRO-/);
    expect(JSON.stringify(service.listLicenses())).not.toContain(created.oneTimeLicenseKey);

    const activated = service.activate({
      userId: "user-a",
      licenseKey: created.oneTimeLicenseKey,
      deviceId: "device-a",
      sessionId: "session-a",
    });

    expect(activated.ok).toBe(true);
    expect(activated.snapshot.status).toBe("ACTIVE");
    expect(activated.snapshot.liveExecutionEnabled).toBe(false);
    expect(activated.snapshot.automaticTradingAllowed).toBe(false);
  });

  it("marks expired licenses as limited read-only", () => {
    const service = createLicenseEngineService();
    service.createLicense({
      userId: "expired-user",
      plan: "STARTER",
      duration: "1_MONTH",
      expiresAt: "2020-01-01T00:00:00.000Z",
    });

    const snapshot = service.status("expired-user");

    expect(snapshot.status).toBe("EXPIRED");
    expect(snapshot.dashboardBlocked).toBe(true);
    expect(snapshot.limitedReadOnly).toBe(true);
    expect(snapshot.warnings).toContain("LICENSE EXPIRED");
  });

  it("enforces device limits per license", () => {
    const service = createLicenseEngineService();
    const created = service.createLicense({
      userId: "device-user",
      plan: "STARTER",
      duration: "1_MONTH",
    });

    expect(service.activate({
      userId: "device-user",
      licenseKey: created.oneTimeLicenseKey,
      deviceId: "device-1",
      sessionId: "session-1",
    }).ok).toBe(true);

    const secondDevice = service.activate({
      userId: "device-user",
      licenseKey: created.oneTimeLicenseKey,
      deviceId: "device-2",
      sessionId: "session-1",
    });

    expect(secondDevice.ok).toBe(false);
    expect(secondDevice.message).toBe("Device limit reached.");
    expect(secondDevice.snapshot.warnings).toContain("DEVICE LIMIT REACHED");
  });

  it("enforces simultaneous session limits per license", () => {
    const service = createLicenseEngineService();
    const created = service.createLicense({
      userId: "session-user",
      plan: "STARTER",
      duration: "1_MONTH",
    });

    expect(service.activate({
      userId: "session-user",
      licenseKey: created.oneTimeLicenseKey,
      deviceId: "device-1",
      sessionId: "session-1",
    }).ok).toBe(true);

    const secondSession = service.activate({
      userId: "session-user",
      licenseKey: created.oneTimeLicenseKey,
      deviceId: "device-1",
      sessionId: "session-2",
    });

    expect(secondSession.ok).toBe(false);
    expect(secondSession.message).toBe("Session limit reached.");
    expect(secondSession.snapshot.warnings).toContain("SESSION LIMIT REACHED");
  });

  it("keeps user A licenses isolated from user B", () => {
    const service = createLicenseEngineService();
    const created = service.createLicense({
      userId: "user-a",
      plan: "ELITE",
      duration: "3_MONTHS",
    });

    expect(service.activate({
      userId: "user-a",
      licenseKey: created.oneTimeLicenseKey,
      deviceId: "device-a",
      sessionId: "session-a",
    }).ok).toBe(true);

    const userBStatus = service.status("user-b");
    const userBActivation = service.activate({
      userId: "user-b",
      licenseKey: created.oneTimeLicenseKey,
      deviceId: "device-b",
      sessionId: "session-b",
    });

    expect(userBStatus.status).toBe("MISSING");
    expect(userBActivation.ok).toBe(false);
    expect(userBActivation.snapshot.status).toBe("MISSING");
  });
});
