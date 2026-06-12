import type { OhlcCandle } from "../../core/types/market.types";
import type { SyntheticIndexMarketSpec } from "../synthetic-indices";

export type FrappeDollarSignalType = "BOOM" | "CRASH" | "VOLATILITY_MOVE";

export type FrappeDollarDirection = "BUY" | "SELL" | "WAIT";

export type FrappeDollarVisualMarkerKind =
  | "IMPULSE_BALL"
  | "BOS_LABEL"
  | "CHOCH_LABEL"
  | "LIQUIDITY_SWEEP"
  | "ENTRY_ZONE"
  | "TP_ZONE"
  | "SL_ZONE"
  | "INVALIDATION";

export interface FrappeDollarVisualMarker {
  readonly kind: FrappeDollarVisualMarkerKind;
  readonly label: string;
  readonly color: string;
  readonly timestamp?: string;
  readonly price?: number;
  readonly status: "ACCEPTED" | "REJECTED" | "WAITING";
}

export interface FrappeDollarAnalysisInput {
  readonly market: SyntheticIndexMarketSpec;
  readonly candles: readonly OhlcCandle[];
  readonly source: "MOCK" | "DEMO";
  readonly liveEnabled: false;
  readonly journalReady: boolean;
  readonly features: {
    readonly strongImpulse: boolean;
    readonly candleAcceleration: boolean;
    readonly bosBreak: boolean;
    readonly chochConfirmation: boolean;
    readonly liquiditySweep: boolean;
    readonly probableContinuation: boolean;
    readonly slTpDistanceOk: boolean;
    readonly falseSignalRisk: "LOW" | "MEDIUM" | "HIGH";
    readonly readableMarket: boolean;
  };
}

export interface FrappeDollarSignalOutput {
  readonly signalType: FrappeDollarSignalType;
  readonly direction: FrappeDollarDirection;
  readonly confidence: number;
  readonly entryZone: readonly [number, number] | null;
  readonly stopLoss: number | null;
  readonly takeProfit: number | null;
  readonly invalidation: number | null;
  readonly reason: string;
  readonly visualMarker: FrappeDollarVisualMarker;
  readonly journalRequired: true;
  readonly liveAutoExecutionAllowed: false;
}

export interface FrappeDollarSafetyDecision {
  readonly accepted: boolean;
  readonly blocks: readonly string[];
}
