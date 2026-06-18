export interface DerivMarketRegistryItem {
  readonly displayName: string;
  readonly symbol: string;
  readonly family: "boom_crash" | "volatility" | "volatility_1s" | "step" | "jump";
  readonly decimals?: number;
}

export const DERIV_MARKET_REGISTRY: readonly DerivMarketRegistryItem[] = [
  { displayName: "Boom 300", symbol: "BOOM300N", family: "boom_crash" },
  { displayName: "Boom 500", symbol: "BOOM500", family: "boom_crash" },
  { displayName: "Boom 1000", symbol: "BOOM1000", family: "boom_crash" },
  { displayName: "Crash 300", symbol: "CRASH300N", family: "boom_crash" },
  { displayName: "Crash 500", symbol: "CRASH500", family: "boom_crash" },
  { displayName: "Crash 1000", symbol: "CRASH1000", family: "boom_crash" },
  { displayName: "Volatility 10", symbol: "R_10", family: "volatility" },
  { displayName: "Volatility 25", symbol: "R_25", family: "volatility" },
  { displayName: "Volatility 50", symbol: "R_50", family: "volatility" },
  { displayName: "Volatility 75", symbol: "R_75", family: "volatility" },
  { displayName: "Volatility 100", symbol: "R_100", family: "volatility" },
  { displayName: "Volatility 10 1s", symbol: "1HZ10V", family: "volatility_1s" },
  { displayName: "Volatility 25 1s", symbol: "1HZ25V", family: "volatility_1s" },
  { displayName: "Volatility 50 1s", symbol: "1HZ50V", family: "volatility_1s" },
  { displayName: "Volatility 75 1s", symbol: "1HZ75V", family: "volatility_1s" },
  { displayName: "Volatility 100 1s", symbol: "1HZ100V", family: "volatility_1s" },
  { displayName: "Step Index", symbol: "STPRNG", family: "step" },
  { displayName: "Jump 10", symbol: "JD10", family: "jump" },
  { displayName: "Jump 25", symbol: "JD25", family: "jump" },
  { displayName: "Jump 50", symbol: "JD50", family: "jump" },
  { displayName: "Jump 75", symbol: "JD75", family: "jump" },
  { displayName: "Jump 100", symbol: "JD100", family: "jump" },
] as const;

export const DERIV_SYNTHETIC_SYMBOLS = Object.fromEntries(
  DERIV_MARKET_REGISTRY.map(item => [item.displayName, item.symbol])
) as Record<string, string>;

export type DerivSyntheticDisplaySymbol = keyof typeof DERIV_SYNTHETIC_SYMBOLS;
export type DerivSyntheticProviderSymbol = (typeof DERIV_SYNTHETIC_SYMBOLS)[DerivSyntheticDisplaySymbol];

export function isConfiguredDerivSyntheticSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  return DERIV_MARKET_REGISTRY.some(item => item.symbol.toUpperCase() === normalized);
}
