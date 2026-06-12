/**
 * Confidence is a bounded score. Values do not represent certainty.
 */
export const CONFIDENCE_MIN = 0;

export const CONFIDENCE_MAX = 100;

export const NO_TRADE_CONFIDENCE_THRESHOLD = 80;

export const PREMIUM_CONFIDENCE_THRESHOLD = 95;

export const MAX_CONFIDENCE_WITHOUT_CERTAINTY = 99;

export const CONFIDENCE_LABELS = {
  NO_TRADE: "NO_TRADE",
  CAUTIOUS: "CAUTIOUS",
  PREMIUM: "PREMIUM",
} as const;
