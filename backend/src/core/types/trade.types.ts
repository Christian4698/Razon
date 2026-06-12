import type { SignalAction } from "./signal.types";
import type { TradingMode } from "./timeframe.types";

export type OrderSide = Extract<SignalAction, "BUY" | "SELL">;

export type OrderType = "MARKET" | "LIMIT" | "STOP";

export type OrderStatus =
  | "DRAFT"
  | "PENDING_RISK_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUBMITTED"
  | "FILLED"
  | "PARTIALLY_FILLED"
  | "CANCELLED"
  | "FAILED";

export type PositionStatus = "OPEN" | "CLOSED" | "PARTIALLY_CLOSED";

export interface TradePrice {
  readonly value: number;
  readonly symbol: string;
}

export interface TradeOrderDraft {
  readonly symbol: string;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly volume: number;
  readonly mode: TradingMode;
  readonly entry?: TradePrice;
  readonly sl?: TradePrice;
  readonly tp?: TradePrice;
  readonly signalId?: string;
}

export interface TradeOrder {
  readonly id: string;
  readonly connectorOrderId?: string;
  readonly draft: TradeOrderDraft;
  readonly status: OrderStatus;
  readonly reason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TradePosition {
  readonly id: string;
  readonly symbol: string;
  readonly side: OrderSide;
  readonly status: PositionStatus;
  readonly volume: number;
  readonly openPrice: number;
  readonly closePrice?: number;
  readonly sl?: number;
  readonly tp?: number;
  readonly openedAt: string;
  readonly closedAt?: string;
  readonly realizedPnl?: number;
  readonly unrealizedPnl?: number;
}
