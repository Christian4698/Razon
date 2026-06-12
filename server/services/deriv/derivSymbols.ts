export const DERIV_SYNTHETIC_SYMBOLS = {
  "Boom 500": "BOOM500",
  "Boom 1000": "BOOM1000",
  "Crash 500": "CRASH500",
  "Crash 1000": "CRASH1000",
  "Volatility 10": "R_10",
  "Volatility 25": "R_25",
  "Volatility 50": "R_50",
  "Volatility 75": "R_75",
  "Volatility 100": "R_100",
  "Crash 300": "CRASH300N",
  "Boom 300": "BOOM300N",
  "Step Index": "STPRNG",
  "Jump Index": "JD10",
} as const;

export type DerivSyntheticDisplaySymbol = keyof typeof DERIV_SYNTHETIC_SYMBOLS;
export type DerivSyntheticProviderSymbol = (typeof DERIV_SYNTHETIC_SYMBOLS)[DerivSyntheticDisplaySymbol];

export function isConfiguredDerivSyntheticSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  return Object.values(DERIV_SYNTHETIC_SYMBOLS).some(value => value.toUpperCase() === normalized);
}
