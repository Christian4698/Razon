import type { RuntimeMode } from "../security/security.types";

export type HealthCheckStatus = "ok" | "warning" | "down";

export interface HealthCheck {
  readonly name: string;
  readonly status: HealthCheckStatus;
  readonly latencyMs: number | null;
  readonly message: string;
}

export interface BackendHealth {
  readonly status: HealthCheckStatus;
  readonly runtimeMode: RuntimeMode;
  readonly generatedAt: string;
  readonly checks: readonly HealthCheck[];
}

export class HealthService {
  getBackendHealth(runtimeMode: RuntimeMode, checks: readonly HealthCheck[]): BackendHealth {
    const status = checks.some(check => check.status === "down")
      ? "down"
      : checks.some(check => check.status === "warning")
        ? "warning"
        : "ok";

    return {
      status,
      runtimeMode,
      generatedAt: new Date().toISOString(),
      checks,
    };
  }

  connectorCheck(name: string, connected: boolean, latencyMs: number | null): HealthCheck {
    return {
      name,
      status: connected ? "ok" : "warning",
      latencyMs,
      message: connected ? "Connector is reachable." : "Connector is unavailable or delayed.",
    };
  }

  engineCheck(name: string, ready: boolean): HealthCheck {
    return {
      name,
      status: ready ? "ok" : "down",
      latencyMs: null,
      message: ready ? `${name} is ready.` : `${name} is unavailable.`,
    };
  }
}
