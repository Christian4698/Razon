import { describe, expect, it } from "vitest";
import { ApiKeyVaultService } from "../src/modules/security/api-key-vault.service";
import { AuditSecurityService } from "../src/modules/security/audit-security.service";
import { PermissionsGuard } from "../src/modules/security/permissions.guard";
import { RateLimitService } from "../src/modules/security/rate-limit.service";
import { createSecurityService } from "../src/modules/security/security.service";
import { FailSafeService } from "../src/modules/monitoring/fail-safe.service";
import { IncidentService } from "../src/modules/monitoring/incident.service";
import { SystemStatusService } from "../src/modules/monitoring/system-status.service";

const masterKey = "production-master-key-demo-value";

describe("Security hardening", () => {
  it("encrypts API keys and exposes only masked metadata", async () => {
    const vault = new ApiKeyVaultService(masterKey);

    const metadata = await vault.storeApiKey({
      provider: "deriv",
      keyName: "DERIV_API_TOKEN",
      plaintext: "super-secret-token",
      purpose: "connector-auth",
      actorId: "admin-1",
    });

    expect(metadata.maskedValue).toBe("su****en");
    expect(JSON.stringify(vault.listApiKeys())).not.toContain("super-secret-token");

    const revealed = await vault.revealForServerUse(metadata.id, "connector request");
    expect(revealed).toBe("super-secret-token");
  });

  it("rejects frontend-prefixed secret names", async () => {
    const vault = new ApiKeyVaultService(masterKey);

    await expect(vault.storeApiKey({
      provider: "mt5",
      keyName: "VITE_MT5_PASSWORD",
      plaintext: "unsafe",
      purpose: "test",
      actorId: "admin-1",
    })).rejects.toThrow("public frontend prefixes");
  });

  it("masks sensitive audit payloads", () => {
    const audit = new AuditSecurityService();

    const record = audit.record("SECRET_USED", "service", "info", {
      token: "raw-token-value",
      nested: { password: "raw-password-value" },
    });

    expect(JSON.stringify(record)).not.toContain("raw-token-value");
    expect(JSON.stringify(record)).not.toContain("raw-password-value");
    expect(JSON.stringify(record)).toContain("[MASKED]");
  });

  it("enforces role permissions", () => {
    const guard = new PermissionsGuard();

    const viewer = {
      id: "viewer-1",
      role: "VIEWER" as const,
      permissions: [],
    };

    expect(guard.requirePermission(viewer, "READ_MARKET").status).toBe("ALLOW");
    expect(guard.requirePermission(viewer, "ROTATE_SECRETS").status).toBe("DENY");
  });

  it("applies rate limiting", () => {
    const rateLimit = new RateLimitService({ windowMs: 1000, maxRequests: 2 });

    expect(rateLimit.checkLimit("ip:/api").allowed).toBe(true);
    expect(rateLimit.checkLimit("ip:/api").allowed).toBe(true);
    expect(rateLimit.checkLimit("ip:/api").allowed).toBe(false);
  });

  it("validates environment and trading safety defaults", () => {
    const security = createSecurityService();

    const env = security.validateEnvironment({
      APP_SECRET_KEY: "change-me",
      JWT_SECRET: "secret-value",
      ENCRYPTION_KEY: "encryption-value",
      DATABASE_URL: "postgresql://razon",
      ENABLE_LIVE_TRADING: "false",
      MODE_SIMULATION: "true",
    });
    const safety = security.evaluateTradingSafety({
      runtimeMode: "LIVE",
      enableLiveTrading: false,
      liveConfirmationReceived: false,
      emergencyStopActive: false,
      killSwitchActive: false,
      dataSource: "MOCK",
      dataCoherent: true,
      spread: 0.1,
      maxSpread: 0.5,
      slippage: 0.05,
      maxSlippage: 0.2,
      drawdownPercent: 1,
      maxDrawdownPercent: 5,
      journalAvailable: true,
    });

    expect(env.valid).toBe(false);
    expect(env.placeholders).toContain("APP_SECRET_KEY");
    expect(safety.allowed).toBe(false);
    expect(safety.failSafeState).toBe("DANGER");
    expect(safety.blocks.map(block => block.reason)).toContain("Execution is blocked when data source is MOCK.");
  });
});

describe("Monitoring fail-safe", () => {
  it("returns STOPPED when emergency stop is active", () => {
    const failSafe = new FailSafeService();

    const result = failSafe.evaluate({
      runtimeMode: "DEMO",
      emergencyStopActive: true,
      killSwitchActive: false,
      connectorConnected: true,
      dataSource: "DEMO",
      dataCoherent: true,
      spreadDangerous: false,
      slippageDangerous: false,
      drawdownLimitReached: false,
      journalAvailable: true,
      riskEngineOk: true,
      noTradeEngineOk: true,
      executionEngineOk: true,
      kalosOk: true,
      openCriticalIncidents: 0,
    });

    expect(result.state).toBe("STOPPED");
    expect(result.reasons).toContain("Emergency Stop active.");
  });

  it("aggregates system status and incidents", () => {
    const incidents = new IncidentService();
    incidents.logIncident({
      severity: "critical",
      state: "DANGER",
      title: "Journal unavailable",
      details: ["journal storage timeout"],
      runtimeMode: "MOCK",
    });

    const status = new SystemStatusService().getSystemStatus({
      runtimeMode: "MOCK",
      connectors: [{ id: "mock", connected: true, latencyMs: 5, runtimeMode: "MOCK" }],
      engines: {
        kalos: true,
        riskEngine: true,
        noTradeEngine: true,
        executionEngine: true,
        journal: false,
      },
      api: {
        errorsLastHour: 2,
        averageLatencyMs: 33,
      },
      failSafe: {
        runtimeMode: "MOCK",
        emergencyStopActive: false,
        killSwitchActive: false,
        connectorConnected: true,
        dataSource: "MOCK",
        dataCoherent: true,
        spreadDangerous: false,
        slippageDangerous: false,
        drawdownLimitReached: false,
        journalAvailable: false,
        riskEngineOk: true,
        noTradeEngineOk: true,
        executionEngineOk: true,
        kalosOk: true,
        openCriticalIncidents: incidents.listOpenIncidents().length,
      },
    });

    expect(status.backendHealth.status).toBe("down");
    expect(status.failSafe.state).toBe("DANGER");
    expect(status.failSafe.reasons).toContain("Journal unavailable.");
  });
});
