import type { FailSafeState, RuntimeMode } from "../security/security.types";

export interface FailSafeInput {
  readonly runtimeMode: RuntimeMode;
  readonly emergencyStopActive: boolean;
  readonly killSwitchActive: boolean;
  readonly connectorConnected: boolean;
  readonly dataSource: RuntimeMode;
  readonly dataCoherent: boolean;
  readonly spreadDangerous: boolean;
  readonly slippageDangerous: boolean;
  readonly drawdownLimitReached: boolean;
  readonly journalAvailable: boolean;
  readonly riskEngineOk: boolean;
  readonly noTradeEngineOk: boolean;
  readonly executionEngineOk: boolean;
  readonly kalosOk: boolean;
  readonly openCriticalIncidents: number;
}

export interface FailSafeResult {
  readonly state: FailSafeState;
  readonly reasons: readonly string[];
  readonly runtimeMode: RuntimeMode;
  readonly generatedAt: string;
}

export class FailSafeService {
  evaluate(input: FailSafeInput): FailSafeResult {
    const reasons: string[] = [];

    if (input.emergencyStopActive) reasons.push("Emergency Stop active.");
    if (input.killSwitchActive) reasons.push("Persistent Kill Switch active.");
    if (!input.connectorConnected) reasons.push("Connector disconnected.");
    if (input.dataSource === "MOCK" && input.runtimeMode === "LIVE") reasons.push("MOCK source cannot be used in LIVE.");
    if (!input.dataCoherent) reasons.push("Market data incoherent.");
    if (input.spreadDangerous) reasons.push("Spread dangerous.");
    if (input.slippageDangerous) reasons.push("Slippage dangerous.");
    if (input.drawdownLimitReached) reasons.push("Drawdown limit reached.");
    if (!input.journalAvailable) reasons.push("Journal unavailable.");
    if (!input.riskEngineOk) reasons.push("Risk Engine unavailable.");
    if (!input.noTradeEngineOk) reasons.push("No-Trade Engine unavailable.");
    if (!input.executionEngineOk) reasons.push("Execution Engine unavailable.");
    if (!input.kalosOk) reasons.push("KALOS unavailable.");
    if (input.openCriticalIncidents > 0) reasons.push(`${input.openCriticalIncidents} critical incident(s) open.`);

    const stopped = input.emergencyStopActive || input.killSwitchActive;
    const danger =
      input.drawdownLimitReached ||
      !input.riskEngineOk ||
      !input.noTradeEngineOk ||
      !input.journalAvailable ||
      input.openCriticalIncidents > 0;
    const warning = reasons.length > 0;

    return {
      state: stopped ? "STOPPED" : danger ? "DANGER" : warning ? "WARNING" : "SAFE",
      reasons,
      runtimeMode: input.runtimeMode,
      generatedAt: new Date().toISOString(),
    };
  }
}
