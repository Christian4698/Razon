import type { RiskAssessment } from "../types/risk.types";
import type { TradeOrder, TradeOrderDraft, TradePosition } from "../types/trade.types";

export interface ExecutionRequest {
  readonly order: TradeOrderDraft;
  readonly riskAssessment: RiskAssessment;
}

export interface PositionUpdateRequest {
  readonly positionId: string;
  readonly sl?: number;
  readonly tp?: number;
  readonly reason: string;
}

/**
 * Contract for controlled execution.
 * Implementations must receive an approved risk assessment before placement.
 */
export interface ExecutionGateway {
  readonly placeOrder: (request: ExecutionRequest) => Promise<TradeOrder>;
  readonly closePosition: (positionId: string, reason: string) => Promise<TradePosition>;
  readonly updatePosition: (request: PositionUpdateRequest) => Promise<TradePosition>;
  readonly listOpenPositions: () => Promise<readonly TradePosition[]>;
}
