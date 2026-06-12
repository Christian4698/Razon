import type {
  MultiTimeframeStep,
  Timeframe,
  TimeframePolicy,
} from "../types/timeframe.types";

/**
 * Canonical timeframe list used by market data, analysis, and UI filters.
 */
export const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"] as const satisfies readonly Timeframe[];

/**
 * Trading horizon policies defined by the RAZON specification.
 */
export const TIMEFRAME_POLICIES = [
  {
    horizon: "SCALPING",
    allowedTimeframes: ["M1", "M5", "M15"],
    primaryTimeframe: "M5",
  },
  {
    horizon: "SHORT_TERM",
    allowedTimeframes: ["M15", "M30", "H1"],
    primaryTimeframe: "M30",
  },
  {
    horizon: "LONG_TERM",
    allowedTimeframes: ["H1", "H4", "D1"],
    primaryTimeframe: "H4",
  },
] as const satisfies readonly TimeframePolicy[];

/**
 * Top-down read order. This is a contract, not analysis logic.
 */
export const MULTI_TIMEFRAME_SEQUENCE = [
  { timeframe: "D1", role: "CONTEXT" },
  { timeframe: "H4", role: "DIRECTION" },
  { timeframe: "H1", role: "STRUCTURE" },
  { timeframe: "M15", role: "SETUP" },
  { timeframe: "M5", role: "ENTRY" },
  { timeframe: "M1", role: "ADJUSTMENT" },
] as const satisfies readonly MultiTimeframeStep[];
