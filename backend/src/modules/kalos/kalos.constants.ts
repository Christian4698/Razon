/**
 * KALOS may never output a confidence above this value.
 * This prevents certainty claims and promises above 95%.
 */
export const KALOS_MAX_CONFIDENCE = 95;

export const KALOS_MIN_DIRECTIONAL_CONFIDENCE = 62;

export const KALOS_MIN_ACCEPTED_CONFIDENCE = 80;

export const KALOS_MIN_ENTRY_SCORE = 58;

export const KALOS_REQUIRED_LAYERS = ["HTF", "MTF", "LTF"] as const;
