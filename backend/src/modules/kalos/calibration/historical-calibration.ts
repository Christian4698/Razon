import { clamp } from "../kalos.utils";
import type {
  KalosMode,
  KalosSignal,
  HistoricalCalibration,
  HistoricalCalibrationSample,
} from "../kalos.types";

function isWinningOutcome(sample: HistoricalCalibrationSample) {
  return sample.outcome === "WIN";
}

/**
 * Historical calibration adjusts confidence modestly.
 * It cannot bypass the KALOS confidence cap.
 */
export function calibrateHistorically(
  samples: readonly HistoricalCalibrationSample[] | undefined,
  signal: KalosSignal,
  mode: KalosMode
): HistoricalCalibration {
  const relevant = (samples ?? []).filter(sample => {
    const signalMatches = sample.signal === signal;
    const modeMatches = !sample.mode || sample.mode === mode;
    return signalMatches && modeMatches && sample.outcome !== "NO_TRADE";
  });

  if (relevant.length === 0) {
    return {
      sampleSize: 0,
      winRate: null,
      reliability: "LOW",
      confidenceAdjustment: -4,
      reasons: ["No historical calibration sample is available for this signal and mode."],
    };
  }

  const wins = relevant.filter(isWinningOutcome).length;
  const winRate = wins / relevant.length;
  const reliability = relevant.length >= 80 ? "HIGH" : relevant.length >= 30 ? "MEDIUM" : "LOW";
  const samplePenalty = reliability === "LOW" ? -3 : reliability === "MEDIUM" ? 0 : 1;
  const performanceAdjustment = clamp((winRate - 0.5) * 18, -8, 6);
  const confidenceAdjustment = clamp(Math.round(performanceAdjustment + samplePenalty), -10, 7);

  return {
    sampleSize: relevant.length,
    winRate: Number(winRate.toFixed(4)),
    reliability,
    confidenceAdjustment,
    reasons: [
      `Historical sample size: ${relevant.length}.`,
      `Historical win rate: ${Math.round(winRate * 100)}%.`,
      `Calibration reliability: ${reliability}.`,
    ],
  };
}
