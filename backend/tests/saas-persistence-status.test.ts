import { afterEach, describe, expect, it, vi } from "vitest";

const envBackup = { ...process.env };

describe("SaaS persistence status", () => {
  afterEach(() => {
    process.env = { ...envBackup };
    vi.resetModules();
  });

  it("does not report postgres as enabled when the runtime URL is missing", async () => {
    vi.resetModules();
    delete process.env.SUPABASE_DB_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL;
    process.env.SAAS_PERSISTENCE = "postgres";
    process.env.SAAS_PERSISTENCE_PROVIDER = "postgres";

    const { initializeSaasPersistence } = await import("../src/modules/persistence/saas-persistence.repository");
    const status = await initializeSaasPersistence();

    expect(status).toMatchObject({
      enabled: false,
      provider: "memory",
      configuredProvider: "postgres",
      initialized: true,
    });
    expect(status.lastError).toContain("requires DATABASE_URL or SUPABASE_DB_URL");
  });
});
