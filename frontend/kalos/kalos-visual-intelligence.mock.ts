export const kalosMarketStructureFeatures = [
  "HH",
  "HL",
  "LH",
  "LL",
  "BOS",
  "CHoCH",
  "Breakout",
  "Retest",
  "Support",
  "Resistance",
] as const;

export const kalosSmartMoneyFeatures = [
  "Liquidity Sweep",
  "Buy Side Liquidity",
  "Sell Side Liquidity",
  "Order Block",
  "Fair Value Gap",
  "Strong High",
  "Weak Low",
  "Supply Zone",
  "Demand Zone",
] as const;

export const kalosModes = [
  "SCALPING",
  "SHORT_TERM",
  "LONG_TERM",
  "MANUAL",
  "SEMI_AUTO",
  "AUTO",
] as const;

export const kalosOutputFields = [
  "decision",
  "confidence",
  "reasons",
  "rejectedReasons",
  "sl",
  "tp",
  "invalidation",
  "trend",
  "volatility",
  "riskScore",
  "overlayObjects",
  "marketBrain",
  "futurePath",
  "marketReplay",
] as const;

export const kalosSafetyRules = [
  "No gain promise",
  "No 100% certainty",
  "Block confidence < 80",
  "Block missing SL",
  "Block missing TP",
  "Block chaotic market",
  "Block stale data",
  "LIVE always OFF",
] as const;
