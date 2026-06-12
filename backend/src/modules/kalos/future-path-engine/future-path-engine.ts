import { KALOS_MAX_CONFIDENCE } from "../kalos.constants";
import { clamp } from "../kalos.utils";
import {
  FUTURE_PATH_ENGINE_NAME,
  type FuturePath,
  type FuturePathEngineInput,
  type FuturePathEngineOutput,
  type FuturePathEngineState,
} from "./future-path-engine.types";

const MAX_PATH_PROBABILITY = KALOS_MAX_CONFIDENCE;

function capProbability(value: number) {
  return clamp(Math.round(value), 1, MAX_PATH_PROBABILITY);
}

function determineState(input: FuturePathEngineInput): FuturePathEngineState {
  if (input.dataQuality === "LOW") return "DATA_LOW";
  if (input.conflict) return "INCERTAIN";
  if (input.confidence < 70) return "WAIT";
  return "READY";
}

function estimateTime(volatility: FuturePathEngineInput["volatility"], state: FuturePathEngineState) {
  if (state === "DATA_LOW") return "pending fresh data";
  if (state === "WAIT") return "wait for confirmation";
  if (volatility === "EXTREME") return "not estimated";
  if (volatility === "HIGH") return "3-5 candles";
  if (volatility === "NORMAL") return "5-8 candles";
  return "8-12 candles";
}

function alternativeObjective(input: FuturePathEngineInput) {
  if (input.scenario === "CONTINUE") return "Alternative pullback or delayed retest.";
  if (input.scenario === "REVERSE") return "Alternative continuation before reversal confirmation.";
  if (input.scenario === "WAIT") return "Alternative setup remains unconfirmed.";
  return "Alternative scenario blocked by invalidation.";
}

function mainObjective(input: FuturePathEngineInput, state: FuturePathEngineState) {
  if (state === "DATA_LOW") return "DATA LOW: wait for stronger market data.";
  if (state === "INCERTAIN") return "INCERTAIN: resolve scenario conflict first.";
  if (state === "WAIT") return "WAIT: confidence is below 70.";
  if (input.scenario === "REVERSE") return "Main reversal hypothesis.";
  if (input.scenario === "CANCEL") return "Main path cancelled.";
  return "Main continuation hypothesis.";
}

function buildProbabilities(input: FuturePathEngineInput, state: FuturePathEngineState) {
  if (state === "DATA_LOW") return [34, 33, 33] as const;
  if (state === "INCERTAIN") return [45, 39, 16] as const;
  if (state === "WAIT") return [capProbability(input.confidence), 24, capProbability(76 - input.confidence)] as const;

  const main = capProbability(input.confidence - input.riskScore * 0.15);
  const alternative = capProbability((100 - main) * 0.72);
  const cancelled = capProbability(100 - main - alternative);

  return [main, alternative, cancelled] as const;
}

function buildPath(
  input: FuturePathEngineInput,
  state: FuturePathEngineState,
  probability: number,
  role: FuturePath["role"],
  id: FuturePath["id"],
  label: FuturePath["label"]
): FuturePath {
  const estimatedTime = estimateTime(input.volatility, state);

  if (role === "MAIN") {
    return {
      id,
      label,
      role,
      color: "GREEN",
      probability,
      estimatedTime,
      objective: mainObjective(input, state),
      target: input.target,
      invalidation: input.invalidation,
      displayState: state,
    };
  }

  if (role === "ALTERNATIVE") {
    return {
      id,
      label,
      role,
      color: "BLUE",
      probability,
      estimatedTime,
      objective: alternativeObjective(input),
      target: input.target,
      invalidation: input.invalidation,
      displayState: state,
    };
  }

  return {
    id,
    label,
    role,
    color: "GREY",
    probability,
    estimatedTime: "invalidated if level breaks",
    objective: "Cancelled path if invalidation is hit.",
    target: null,
    invalidation: input.invalidation,
    displayState: state,
  };
}

function buildSummary(state: FuturePathEngineState) {
  if (state === "DATA_LOW") return "DATA LOW: future paths remain visual placeholders until fresh data improves.";
  if (state === "INCERTAIN") return "INCERTAIN: conflicting structure keeps the visual timeline defensive.";
  if (state === "WAIT") return "WAIT: confidence below 70 prevents a directional visual timeline.";
  return "Future paths are probabilistic visual scenarios, not execution instructions.";
}

export function buildFuturePathEngine(input: FuturePathEngineInput): FuturePathEngineOutput {
  const state = determineState(input);
  const [pathAProbability, pathBProbability, pathCProbability] = buildProbabilities(input, state);

  return {
    module: FUTURE_PATH_ENGINE_NAME,
    state,
    paths: [
      buildPath(input, state, pathAProbability, "MAIN", "A", "Path A"),
      buildPath(input, state, pathBProbability, "ALTERNATIVE", "B", "Path B"),
      buildPath(input, state, pathCProbability, "CANCELLED", "C", "Path C"),
    ],
    summary: buildSummary(state),
    confidence: capProbability(input.confidence),
    liveExecutionAllowed: false,
    disclaimer: "Visual probability paths only. No real execution.",
  };
}
