import type { SyntheticIndexMarketSpec } from "./synthetic-indices.types";

export const TARGET_SYNTHETIC_INDICES: readonly SyntheticIndexMarketSpec[] = [
  {
    name: "Boom 500",
    family: "BOOM",
    derivSymbol: "BOOM_500",
    description: "Deriv Boom 500 synthetic index for upward spike behavior.",
    defaultRiskProfile: "EXTREME",
  },
  {
    name: "Boom 1000",
    family: "BOOM",
    derivSymbol: "BOOM_1000",
    description: "Deriv Boom 1000 synthetic index for upward spike behavior.",
    defaultRiskProfile: "EXTREME",
  },
  {
    name: "Crash 500",
    family: "CRASH",
    derivSymbol: "CRASH_500",
    description: "Deriv Crash 500 synthetic index for downward spike behavior.",
    defaultRiskProfile: "EXTREME",
  },
  {
    name: "Crash 1000",
    family: "CRASH",
    derivSymbol: "CRASH_1000",
    description: "Deriv Crash 1000 synthetic index for downward spike behavior.",
    defaultRiskProfile: "EXTREME",
  },
  {
    name: "Volatility 10",
    family: "VOLATILITY",
    derivSymbol: "R_10",
    description: "Deriv Volatility 10 synthetic index.",
    defaultRiskProfile: "HIGH",
  },
  {
    name: "Volatility 25",
    family: "VOLATILITY",
    derivSymbol: "R_25",
    description: "Deriv Volatility 25 synthetic index.",
    defaultRiskProfile: "HIGH",
  },
  {
    name: "Volatility 50",
    family: "VOLATILITY",
    derivSymbol: "R_50",
    description: "Deriv Volatility 50 synthetic index.",
    defaultRiskProfile: "HIGH",
  },
  {
    name: "Volatility 75",
    family: "VOLATILITY",
    derivSymbol: "R_75",
    description: "Deriv Volatility 75 synthetic index.",
    defaultRiskProfile: "EXTREME",
  },
  {
    name: "Volatility 100",
    family: "VOLATILITY",
    derivSymbol: "R_100",
    description: "Deriv Volatility 100 synthetic index.",
    defaultRiskProfile: "EXTREME",
  },
] as const;

export type {
  SyntheticIndexAnalysisContext,
  SyntheticIndexDerivSymbol,
  SyntheticIndexFamily,
  SyntheticIndexMarketName,
  SyntheticIndexMarketSpec,
  SyntheticIndexRiskEnvelope,
} from "./synthetic-indices.types";
