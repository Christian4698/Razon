import type { OhlcCandle } from "../../core/types/market.types";

export type SyntheticIndexMarketName =
  | "Boom 500"
  | "Boom 1000"
  | "Crash 500"
  | "Crash 1000"
  | "Volatility 10"
  | "Volatility 25"
  | "Volatility 50"
  | "Volatility 75"
  | "Volatility 100";

export type SyntheticIndexFamily = "BOOM" | "CRASH" | "VOLATILITY";

export type SyntheticIndexDerivSymbol =
  | "BOOM_500"
  | "BOOM_1000"
  | "CRASH_500"
  | "CRASH_1000"
  | "R_10"
  | "R_25"
  | "R_50"
  | "R_75"
  | "R_100";

export interface SyntheticIndexMarketSpec {
  readonly name: SyntheticIndexMarketName;
  readonly family: SyntheticIndexFamily;
  readonly derivSymbol: SyntheticIndexDerivSymbol;
  readonly description: string;
  readonly defaultRiskProfile: "HIGH" | "EXTREME";
}

export interface SyntheticIndexAnalysisContext {
  readonly market: SyntheticIndexMarketSpec;
  readonly candles: readonly OhlcCandle[];
  readonly source: "MOCK" | "DEMO";
  readonly dataFresh: boolean;
  readonly readable: boolean;
  readonly capturedAt: string;
}

export interface SyntheticIndexRiskEnvelope {
  readonly maxSpread: number;
  readonly maxSlippage: number;
  readonly minStopDistance: number;
  readonly minTakeProfitDistance: number;
  readonly allowLiveAutoExecution: false;
}
