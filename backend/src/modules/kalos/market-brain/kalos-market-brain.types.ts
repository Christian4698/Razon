import type {
  KalosBias,
  KalosCandle,
  KalosMarketStructureDetection,
  KalosSignal,
  KalosSmartMoneyDetection,
  KalosVolatilityLevel,
} from "../kalos.types";

export const KALOS_MARKET_BRAIN_NAME = "kalos-market-brain" as const;

export type KalosMarketBrainPipelineStep =
  | "READ_MARKET"
  | "BUILD_STRUCTURE"
  | "DETECT_INTENTION"
  | "VERIFY_LIQUIDITY"
  | "GENERATE_SCENARIO";

export type KalosMarketBrainIntention =
  | "ACCUMULATION"
  | "DISTRIBUTION"
  | "MANIPULATION"
  | "EXPANSION"
  | "CONSOLIDATION";

export type KalosMarketBrainScenario = "CONTINUE" | "REVERSE" | "WAIT" | "CANCEL";

export type KalosMarketBrainPathStep =
  | "LIQUIDITY_TEST"
  | "RETEST"
  | "EXPANSION"
  | "REVERSAL_CHECK"
  | "WAIT_CONFIRMATION"
  | "INVALIDATION";

export interface KalosMarketBrainInput {
  readonly symbol: string;
  readonly candles: readonly KalosCandle[];
  readonly trend?: KalosBias;
  readonly volatilityLevel?: KalosVolatilityLevel;
  readonly impulseScore?: number;
  readonly confidenceHint?: number;
  readonly riskScoreHint?: number;
  readonly dataFresh?: boolean;
  readonly sl?: number | null;
  readonly tp?: number | null;
  readonly invalidation?: number | null;
  readonly structureDetections?: readonly KalosMarketStructureDetection[];
  readonly smartMoneyDetections?: readonly KalosSmartMoneyDetection[];
}

export interface KalosLiquidityInterpretation {
  readonly buySideLiquidity: boolean;
  readonly sellSideLiquidity: boolean;
  readonly sweep: boolean;
  readonly grab: boolean;
  readonly fakeBreakout: boolean;
  readonly explanation: string;
}

export interface KalosMarketBrainExpectedPath {
  readonly step: KalosMarketBrainPathStep;
  readonly hypothesis: string;
  readonly probability: number;
  readonly price?: number;
}

export interface KalosMarketBrainOutput {
  readonly module: typeof KALOS_MARKET_BRAIN_NAME;
  readonly signal: KalosSignal;
  readonly confidence: number;
  readonly scenario: KalosMarketBrainScenario;
  readonly explanation: string;
  readonly invalidation: number | null;
  readonly expectedPath: readonly KalosMarketBrainExpectedPath[];
  readonly timingScore: number;
  readonly riskScore: number;
  readonly structure: KalosBias;
  readonly intention: KalosMarketBrainIntention;
  readonly volatility: KalosVolatilityLevel;
  readonly liquidity: KalosLiquidityInterpretation;
  readonly pipeline: readonly KalosMarketBrainPipelineStep[];
  readonly rejectedReasons: readonly string[];
  readonly liveExecutionAllowed: false;
  readonly disclaimer: "Probabilistic hypothesis only. No real execution.";
}
