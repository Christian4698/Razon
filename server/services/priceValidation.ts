import type { MarketSnapshot } from "./market/marketAggregator";
import type { RazonSignalDecision, RazonSignalOutput } from "../types/razon";

export const INVALID_SIGNAL_PRICE_RELATION = "INVALID_SIGNAL_PRICE_RELATION" as const;

export interface SignalPriceValidationInput {
  readonly signal: RazonSignalOutput;
  readonly snapshot: MarketSnapshot;
  readonly symbol: string;
  readonly timeframe: string;
  readonly source: string;
}

export interface SignalPriceValidationResult {
  readonly valid: boolean;
  readonly reasonCode: typeof INVALID_SIGNAL_PRICE_RELATION | null;
  readonly reasons: readonly string[];
  readonly entry: number | null;
  readonly currentPrice: number | null;
  readonly tp: number | null;
  readonly sl: number | null;
  readonly invalidation: number | null;
  readonly symbol: string;
  readonly timeframe: string;
  readonly source: string;
  readonly decimals: number;
}

function decimalPlaces(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const text = value.toString().toLowerCase();
  if (text.includes("e-")) {
    const [, exponent] = text.split("e-");
    return Number(exponent) || 0;
  }
  const [, decimals = ""] = text.split(".");
  return decimals.length;
}

function marketDecimals(snapshot: MarketSnapshot) {
  const values = [
    snapshot.ticker.price,
    ...snapshot.candles.slice(-20).flatMap(candle => [candle.open, candle.high, candle.low, candle.close]),
  ];

  return Math.min(8, Math.max(0, ...values.map(decimalPlaces)));
}

function isFinitePrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDirectional(decision: RazonSignalDecision) {
  return decision === "BUY" || decision === "SELL";
}

function nearlyEqual(a: number, b: number, decimals: number) {
  const tickTolerance = Math.pow(10, -Math.max(decimals, 0)) * 2;
  const relativeTolerance = Math.max(Math.abs(b) * 0.005, tickTolerance);
  return Math.abs(a - b) <= relativeTolerance;
}

function hasSupportedPrecision(value: number, decimals: number) {
  return Number(value.toFixed(decimals)) === value;
}

export function validateSignalPriceRelation(input: SignalPriceValidationInput): SignalPriceValidationResult {
  const decision = input.signal.decision ?? input.signal.signal;
  const entry = input.signal.entry;
  const currentPrice = input.snapshot.ticker.price;
  const tp = input.signal.tp;
  const sl = input.signal.sl;
  const invalidation = input.signal.invalidationLevel ?? null;
  const decimals = marketDecimals(input.snapshot);
  const reasons: string[] = [];
  const candleSymbols = new Set(input.snapshot.candles.map(candle => candle.symbol));
  const directional = isDirectional(decision);

  if (!directional) {
    return {
      valid: true,
      reasonCode: null,
      reasons,
      entry,
      currentPrice,
      tp,
      sl,
      invalidation,
      symbol: input.symbol,
      timeframe: input.timeframe,
      source: input.source,
      decimals,
    };
  }

  if (input.snapshot.symbol !== input.symbol || input.snapshot.ticker.symbol !== input.symbol) {
    reasons.push("Snapshot and ticker symbol do not match the displayed symbol.");
  }

  if (candleSymbols.size > 0 && (candleSymbols.size !== 1 || !candleSymbols.has(input.symbol))) {
    reasons.push("Candle symbols do not match the displayed symbol.");
  }

  if (input.snapshot.fallback === "MOCK_DATA" || input.snapshot.observability.source === "MOCK") {
    reasons.push("Directional signal uses MOCK_DATA/fallback pricing.");
  }

  if (!isFinitePrice(currentPrice)) reasons.push("Current market price is missing or invalid.");
  if (!isFinitePrice(entry)) reasons.push("Entry price is missing or invalid.");
  if (!isFinitePrice(tp)) reasons.push("TP is missing or invalid.");
  if (!isFinitePrice(sl)) reasons.push("SL is missing or invalid.");
  if (!isFinitePrice(invalidation)) reasons.push("Invalidation price is missing or invalid.");

  if (isFinitePrice(entry) && isFinitePrice(currentPrice) && !nearlyEqual(entry, currentPrice, decimals)) {
    reasons.push("Entry is not an absolute price near the current market feed.");
  }

  for (const [label, value] of [
    ["entry", entry],
    ["currentPrice", currentPrice],
    ["tp", tp],
    ["sl", sl],
    ["invalidation", invalidation],
  ] as const) {
    if (isFinitePrice(value) && !hasSupportedPrecision(value, decimals)) {
      reasons.push(`${label} precision exceeds market feed precision.`);
    }
  }

  if (decision === "BUY" && isFinitePrice(tp) && isFinitePrice(entry) && isFinitePrice(sl)) {
    if (!(tp > entry && entry > sl)) reasons.push("BUY relation must be TP > ENTRY > SL.");
  }

  if (decision === "SELL" && isFinitePrice(tp) && isFinitePrice(entry) && isFinitePrice(sl)) {
    if (!(tp < entry && entry < sl)) reasons.push("SELL relation must be TP < ENTRY < SL.");
  }

  if (decision === "BUY" && isFinitePrice(invalidation) && isFinitePrice(sl) && !(invalidation <= sl)) {
    reasons.push("BUY invalidation must be at or below SL.");
  }

  if (decision === "SELL" && isFinitePrice(invalidation) && isFinitePrice(sl) && !(invalidation >= sl)) {
    reasons.push("SELL invalidation must be at or above SL.");
  }

  return {
    valid: reasons.length === 0,
    reasonCode: reasons.length === 0 ? null : INVALID_SIGNAL_PRICE_RELATION,
    reasons,
    entry,
    currentPrice,
    tp,
    sl,
    invalidation,
    symbol: input.symbol,
    timeframe: input.timeframe,
    source: input.source,
    decimals,
  };
}

export function rejectInvalidPriceSignal(
  signal: RazonSignalOutput,
  validation: SignalPriceValidationResult
): RazonSignalOutput {
  if (validation.valid) return signal;

  return {
    ...signal,
    signal: "INVALID",
    decision: "INVALID",
    confidence: 0,
    probability: 0,
    risk: "high",
    entry: validation.entry,
    sl: validation.sl,
    tp: validation.tp,
    invalidationLevel: validation.invalidation,
    reasons: [INVALID_SIGNAL_PRICE_RELATION, ...validation.reasons, ...signal.reasons],
    whyWait: [INVALID_SIGNAL_PRICE_RELATION, ...validation.reasons, ...(signal.whyWait ?? [])],
    priceValidation: validation,
  };
}
