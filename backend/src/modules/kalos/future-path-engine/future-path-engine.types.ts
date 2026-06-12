import type { KalosSignal, KalosVolatilityLevel } from "../kalos.types";
import type { KalosMarketBrainScenario } from "../market-brain";

export const FUTURE_PATH_ENGINE_NAME = "future-path-engine" as const;

export type FuturePathEngineState = "READY" | "WAIT" | "INCERTAIN" | "DATA_LOW";

export type FuturePathRole = "MAIN" | "ALTERNATIVE" | "CANCELLED";

export type FuturePathColor = "GREEN" | "BLUE" | "GREY";

export type FuturePathId = "A" | "B" | "C";

export interface FuturePathEngineInput {
  readonly signal: KalosSignal;
  readonly confidence: number;
  readonly scenario: KalosMarketBrainScenario;
  readonly target: number | null;
  readonly invalidation: number | null;
  readonly volatility: KalosVolatilityLevel;
  readonly riskScore: number;
  readonly conflict?: boolean;
  readonly dataQuality?: "OK" | "LOW";
}

export interface FuturePath {
  readonly id: FuturePathId;
  readonly label: "Path A" | "Path B" | "Path C";
  readonly role: FuturePathRole;
  readonly color: FuturePathColor;
  readonly probability: number;
  readonly estimatedTime: string;
  readonly objective: string;
  readonly target: number | null;
  readonly invalidation: number | null;
  readonly displayState: FuturePathEngineState;
}

export interface FuturePathEngineOutput {
  readonly module: typeof FUTURE_PATH_ENGINE_NAME;
  readonly state: FuturePathEngineState;
  readonly paths: readonly [FuturePath, FuturePath, FuturePath];
  readonly summary: string;
  readonly confidence: number;
  readonly liveExecutionAllowed: false;
  readonly disclaimer: "Visual probability paths only. No real execution.";
}
