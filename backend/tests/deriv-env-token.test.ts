import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("Deriv DEMO env and token validation", () => {
  it("loads .env before Deriv config and accepts pat_ personal access tokens", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "razon-deriv-env-"));
    const envPath = path.join(tempDir, ".env");

    fs.writeFileSync(
      envPath,
      [
        "DERIV_ENABLED=true",
        "DERIV_WS_APP_ID=1089",
        "DERIV_APP_ID=33zqe4Br9GlyBlnkDwxbC",
        "DERIV_API_TOKEN=pat_test_personal_access_token",
        "DERIV_ENDPOINT=wss://ws.derivws.com/websockets/v3",
        "DERIV_ACCOUNT_TYPE=demo",
        "DERIV_ALLOW_ORDER_PLACEMENT=false",
      ].join("\n")
    );

    delete process.env.DERIV_ENABLED;
    delete process.env.DERIV_WS_APP_ID;
    delete process.env.DERIV_APP_ID;
    delete process.env.DERIV_API_TOKEN;
    delete process.env.DERIV_ENDPOINT;
    delete process.env.DERIV_ACCOUNT_TYPE;
    delete process.env.DERIV_ALLOW_ORDER_PLACEMENT;

    const { loadServerEnv } = await import("../../server/config/loadEnv");
    loadServerEnv(envPath);

    const { getDerivDemoConfig, isDerivApiTokenConfigured } = await import(
      "../../server/services/deriv/DerivDemoReadOnlyClient"
    );
    const config = getDerivDemoConfig();

    expect(isDerivApiTokenConfigured("pat_test_personal_access_token")).toBe(true);
    expect(config.enabled).toBe(true);
    expect(config.wsAppId).toBe("1089");
    expect(config.wsAppIdPresent).toBe(true);
    expect(config.appId).toBe("33zqe4Br9GlyBlnkDwxbC");
    expect(config.apiTokenConfigured).toBe(true);
    expect(config.allowOrderPlacement).toBe(false);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("does not treat non-PAT Deriv token strings as configured", async () => {
    const { isDerivApiTokenConfigured } = await import(
      "../../server/services/deriv/DerivDemoReadOnlyClient"
    );

    expect(isDerivApiTokenConfigured(undefined)).toBe(false);
    expect(isDerivApiTokenConfigured("")).toBe(false);
    expect(isDerivApiTokenConfigured("demo-token-secret")).toBe(false);
    expect(isDerivApiTokenConfigured(" pat_valid_after_trim")).toBe(true);
  });

  it("reports tokenConfigured without exposing the token in health", async () => {
    const { DerivDemoReadOnlyClient, getDerivDemoConfig } = await import(
      "../../server/services/deriv/DerivDemoReadOnlyClient"
    );

    process.env.DERIV_ENABLED = "true";
    delete process.env.DERIV_WS_APP_ID;
    process.env.DERIV_APP_ID = "33zqe4Br9GlyBlnkDwxbC";
    process.env.DERIV_API_TOKEN = "pat_backend_only_secret";
    process.env.DERIV_ENDPOINT = "wss://ws.derivws.com/websockets/v3";
    process.env.DERIV_ACCOUNT_TYPE = "demo";
    process.env.DERIV_ALLOW_ORDER_PLACEMENT = "false";

    const client = new DerivDemoReadOnlyClient(getDerivDemoConfig(), async (_endpoint, payload) => {
      if ("active_symbols" in payload) return { active_symbols: [] };
      return {};
    });
    const health = await client.connect();
    const serialized = JSON.stringify(health);

    expect(health.tokenConfigured).toBe(true);
    expect(health.appIdConfigured).toBe(true);
    expect(health.tokenVisible).toBe(false);
    expect(health.orderPlacementAllowed).toBe(false);
    expect(serialized).not.toContain("pat_backend_only_secret");
  });
});
