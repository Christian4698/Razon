import { clamp, round } from "../kalos.utils";
import {
  KALOS_MARKET_REPLAY_NAME,
  type MarketReplayActualResult,
  type MarketReplayDifference,
  type MarketReplayDirection,
  type MarketReplayFrame,
  type MarketReplayInput,
  type MarketReplayMetrics,
  type MarketReplayOutcome,
  type MarketReplayOutput,
} from "./market-replay.types";

const REPLAY_CONTROLS = ["PLAY", "REWIND", "FAST_FORWARD", "PAUSE"] as const;
const MAX_REPLAY_FRAMES = 12;

function expectedDirection(prediction: MarketReplayInput["prediction"]): MarketReplayDirection {
  if (prediction === "BUY") return "UP";
  if (prediction === "SELL") return "DOWN";
  return "FLAT";
}

function actualDirection(delta: number, referencePrice: number): MarketReplayDirection {
  const threshold = Math.max(referencePrice * 0.00005, 0.00001);
  if (delta > threshold) return "UP";
  if (delta < -threshold) return "DOWN";
  return "FLAT";
}

function outcomeFor(expected: MarketReplayDirection, actual: MarketReplayDirection): MarketReplayOutcome {
  if (expected === "FLAT") return actual === "FLAT" ? "WIN_SIMULATION" : "NO_TRADE_SIMULATION";
  return expected === actual ? "WIN_SIMULATION" : "LOSS_SIMULATION";
}

function buildActualResult(currentClose: number, nextClose: number, expected: MarketReplayDirection): MarketReplayActualResult {
  const movement = round(nextClose - currentClose, currentClose >= 100 ? 3 : 6);
  const direction = actualDirection(movement, currentClose);

  return {
    closePrice: nextClose,
    movement,
    direction,
    outcome: outcomeFor(expected, direction),
  };
}

function buildDifference(
  expected: MarketReplayDirection,
  actualResult: MarketReplayActualResult
): MarketReplayDifference {
  const matched = actualResult.outcome === "WIN_SIMULATION";

  return {
    expectedDirection: expected,
    actualDirection: actualResult.direction,
    matched,
    priceDelta: actualResult.movement,
    note: matched
      ? "Prediction and actual result aligned in replay simulation."
      : "Replay shows a difference between KALOS context and actual movement.",
  };
}

function buildFrame(
  input: MarketReplayInput,
  index: number,
  timestamp: string,
  currentClose: number,
  nextClose: number
): MarketReplayFrame {
  const expected = expectedDirection(input.prediction);
  const actualResult = buildActualResult(currentClose, nextClose, expected);

  return {
    index,
    timestamp,
    prediction: {
      signal: input.prediction,
      confidence: clamp(Math.round(input.confidence), 0, 95),
      seenPrice: currentClose,
      seenTrend: input.trend,
      seenVolatility: input.volatility,
      kalosSaw: [
        `Trend ${input.trend}`,
        `Volatility ${input.volatility}`,
        `Risk ${input.riskScore}`,
        ...input.reasons.slice(0, 2),
      ],
    },
    actualResult,
    difference: buildDifference(expected, actualResult),
  };
}

function calculateMetrics(frames: readonly MarketReplayFrame[]): MarketReplayMetrics {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let winSimulation = 0;
  let lossSimulation = 0;

  for (const frame of frames) {
    if (frame.actualResult.outcome === "WIN_SIMULATION") {
      winSimulation += 1;
      equity += 1;
    }

    if (frame.actualResult.outcome === "LOSS_SIMULATION") {
      lossSimulation += 1;
      equity -= 1;
    }

    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  const resolved = winSimulation + lossSimulation;
  const precision = resolved === 0 ? 0 : Math.round((winSimulation / resolved) * 100);

  return {
    winSimulation,
    lossSimulation,
    drawdown: maxDrawdown,
    precision,
  };
}

export function buildMarketReplay(input: MarketReplayInput): MarketReplayOutput {
  const sample = input.candles.slice(-MAX_REPLAY_FRAMES);
  const frames = sample.slice(0, -1).map((candle, index) => {
    const nextCandle = sample[index + 1] ?? candle;
    return buildFrame(input, index, candle.timestamp, candle.close, nextCandle.close);
  });

  return {
    module: KALOS_MARKET_REPLAY_NAME,
    symbol: input.symbol,
    timeframe: input.timeframe,
    controls: REPLAY_CONTROLS,
    frames,
    metrics: calculateMetrics(frames),
    liveExecutionAllowed: false,
    disclaimer: "Replay simulation only. No real execution.",
  };
}
