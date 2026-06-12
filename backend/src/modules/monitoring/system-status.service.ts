import type { RuntimeMode } from "../security/security.types";
import type { BackendHealth, HealthCheck } from "./health.service";
import { HealthService } from "./health.service";
import type { FailSafeInput, FailSafeResult } from "./fail-safe.service";
import { FailSafeService } from "./fail-safe.service";

export interface ConnectorMonitoringStatus {
  readonly id: string;
  readonly connected: boolean;
  readonly latencyMs: number | null;
  readonly runtimeMode: RuntimeMode;
}

export interface EngineMonitoringStatus {
  readonly kalos: boolean;
  readonly riskEngine: boolean;
  readonly noTradeEngine: boolean;
  readonly executionEngine: boolean;
  readonly journal: boolean;
}

export interface ApiMonitoringStatus {
  readonly errorsLastHour: number;
  readonly averageLatencyMs: number;
}

export interface SystemStatusInput {
  readonly runtimeMode: RuntimeMode;
  readonly connectors: readonly ConnectorMonitoringStatus[];
  readonly engines: EngineMonitoringStatus;
  readonly api: ApiMonitoringStatus;
  readonly failSafe: FailSafeInput;
}

export interface SystemStatus {
  readonly generatedAt: string;
  readonly runtimeMode: RuntimeMode;
  readonly backendHealth: BackendHealth;
  readonly failSafe: FailSafeResult;
  readonly connectors: readonly ConnectorMonitoringStatus[];
  readonly engines: EngineMonitoringStatus;
  readonly api: ApiMonitoringStatus;
}

export class SystemStatusService {
  private readonly health = new HealthService();
  private readonly failSafe = new FailSafeService();

  getSystemStatus(input: SystemStatusInput): SystemStatus {
    const connectorChecks: HealthCheck[] = input.connectors.map(connector =>
      this.health.connectorCheck(connector.id, connector.connected, connector.latencyMs)
    );
    const engineChecks: HealthCheck[] = [
      this.health.engineCheck("KALOS", input.engines.kalos),
      this.health.engineCheck("Risk Engine", input.engines.riskEngine),
      this.health.engineCheck("No-Trade Engine", input.engines.noTradeEngine),
      this.health.engineCheck("Execution Engine", input.engines.executionEngine),
      this.health.engineCheck("Journal", input.engines.journal),
    ];
    const apiCheck: HealthCheck = {
      name: "API",
      status: input.api.errorsLastHour > 25 ? "warning" : "ok",
      latencyMs: input.api.averageLatencyMs,
      message: `${input.api.errorsLastHour} errors in last hour.`,
    };

    return {
      generatedAt: new Date().toISOString(),
      runtimeMode: input.runtimeMode,
      backendHealth: this.health.getBackendHealth(input.runtimeMode, [...connectorChecks, ...engineChecks, apiCheck]),
      failSafe: this.failSafe.evaluate(input.failSafe),
      connectors: input.connectors,
      engines: input.engines,
      api: input.api,
    };
  }
}
