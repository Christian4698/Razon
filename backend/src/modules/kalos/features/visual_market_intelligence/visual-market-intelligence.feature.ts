import { biasDirectionValue, calculateAtr, latestPrice, round } from "../../kalos.utils";
import type {
  KalosBias,
  KalosInput,
  KalosLayerAnalysis,
  KalosLayerInput,
  KalosMarketStructureDetection,
  KalosOverlayObject,
  KalosOutput,
  KalosSignal,
  KalosSmartMoneyDetection,
  NoTradeReading,
} from "../../kalos.types";

function confidence(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 95);
}

function lastTimestamp(input: KalosLayerInput) {
  return input.candles.at(-1)?.timestamp ?? new Date(0).toISOString();
}

function detectionPricePrecision(price: number) {
  if (price >= 1000) return 2;
  if (price >= 100) return 3;
  if (price >= 1) return 5;
  return 6;
}

export function detectMarketStructure(input: KalosLayerInput): readonly KalosMarketStructureDetection[] {
  const candles = input.candles;
  const recent = candles.slice(-10);
  const previous = candles.slice(-20, -10);
  const last = candles.at(-1);

  if (!last || recent.length < 5 || previous.length < 5) {
    return [];
  }

  const timestamp = last.timestamp;
  const previousHigh = Math.max(...previous.map(candle => candle.high));
  const previousLow = Math.min(...previous.map(candle => candle.low));
  const recentHigh = Math.max(...recent.map(candle => candle.high));
  const recentLow = Math.min(...recent.map(candle => candle.low));
  const atr = calculateAtr(candles) ?? Math.abs(recentHigh - recentLow) / 4;
  const tolerance = Math.max(atr * 0.25, Math.abs(last.close) * 0.0002);
  const detections: KalosMarketStructureDetection[] = [];

  if (recentHigh > previousHigh) {
    detections.push({
      type: "HH",
      layer: input.layer,
      timestamp,
      price: recentHigh,
      bias: "BULLISH",
      confidence: confidence(72),
      reason: "Recent swing printed a higher high.",
    });
  } else {
    detections.push({
      type: "LH",
      layer: input.layer,
      timestamp,
      price: recentHigh,
      bias: "BEARISH",
      confidence: confidence(66),
      reason: "Recent swing failed below the previous high.",
    });
  }

  if (recentLow > previousLow) {
    detections.push({
      type: "HL",
      layer: input.layer,
      timestamp,
      price: recentLow,
      bias: "BULLISH",
      confidence: confidence(68),
      reason: "Recent pullback held a higher low.",
    });
  } else {
    detections.push({
      type: "LL",
      layer: input.layer,
      timestamp,
      price: recentLow,
      bias: "BEARISH",
      confidence: confidence(68),
      reason: "Recent pullback printed a lower low.",
    });
  }

  if (last.close > previousHigh) {
    detections.push({
      type: "BOS",
      layer: input.layer,
      timestamp,
      price: last.close,
      bias: "BULLISH",
      confidence: confidence(78),
      reason: "Close broke above prior structure resistance.",
    });
    detections.push({
      type: "Breakout",
      layer: input.layer,
      timestamp,
      price: last.close,
      bias: "BULLISH",
      confidence: confidence(74),
      reason: "Breakout confirmed above prior high.",
    });
  }

  if (last.close < previousLow) {
    detections.push({
      type: "BOS",
      layer: input.layer,
      timestamp,
      price: last.close,
      bias: "BEARISH",
      confidence: confidence(78),
      reason: "Close broke below prior structure support.",
    });
    detections.push({
      type: "Breakout",
      layer: input.layer,
      timestamp,
      price: last.close,
      bias: "BEARISH",
      confidence: confidence(74),
      reason: "Breakout confirmed below prior low.",
    });
  }

  if (recentHigh > previousHigh && recentLow < previousLow) {
    detections.push({
      type: "CHoCH",
      layer: input.layer,
      timestamp,
      price: last.close,
      bias: last.close >= previousHigh ? "BULLISH" : "BEARISH",
      confidence: confidence(70),
      reason: "Both sides of prior structure were challenged; character may be shifting.",
    });
  }

  if (Math.abs(last.low - previousHigh) <= tolerance || Math.abs(last.high - previousLow) <= tolerance) {
    detections.push({
      type: "Retest",
      layer: input.layer,
      timestamp,
      price: last.close,
      bias: last.close >= last.open ? "BULLISH" : "BEARISH",
      confidence: confidence(64),
      reason: "Price is retesting a prior structure boundary.",
    });
  }

  detections.push(
    {
      type: "Support",
      layer: input.layer,
      timestamp,
      price: previousLow,
      bias: "BULLISH",
      confidence: confidence(62),
      reason: "Previous range low is marked as support.",
    },
    {
      type: "Resistance",
      layer: input.layer,
      timestamp,
      price: previousHigh,
      bias: "BEARISH",
      confidence: confidence(62),
      reason: "Previous range high is marked as resistance.",
    }
  );

  return detections;
}

export function detectSmartMoney(input: KalosLayerInput): readonly KalosSmartMoneyDetection[] {
  const candles = input.candles;
  const last = candles.at(-1);
  const previous = candles.slice(-16, -1);

  if (!last || previous.length < 8) {
    return [];
  }

  const previousHigh = Math.max(...previous.map(candle => candle.high));
  const previousLow = Math.min(...previous.map(candle => candle.low));
  const atr = calculateAtr(candles) ?? Math.abs(previousHigh - previousLow) / 4;
  const decimals = detectionPricePrecision(last.close);
  const detections: KalosSmartMoneyDetection[] = [
    {
      type: "Buy Side Liquidity",
      layer: input.layer,
      timestamp: last.timestamp,
      price: previousHigh,
      bias: "BEARISH",
      confidence: confidence(66),
      reason: "Resting buy-side liquidity is expected above the recent high.",
    },
    {
      type: "Sell Side Liquidity",
      layer: input.layer,
      timestamp: last.timestamp,
      price: previousLow,
      bias: "BULLISH",
      confidence: confidence(66),
      reason: "Resting sell-side liquidity is expected below the recent low.",
    },
    {
      type: "Strong High",
      layer: input.layer,
      timestamp: last.timestamp,
      price: previousHigh,
      bias: "BEARISH",
      confidence: confidence(last.close < previousHigh ? 70 : 52),
      reason: "Prior high is tracked as a potential strong high.",
    },
    {
      type: "Weak Low",
      layer: input.layer,
      timestamp: last.timestamp,
      price: previousLow,
      bias: "BULLISH",
      confidence: confidence(last.close > previousLow ? 70 : 52),
      reason: "Prior low is tracked as a potential weak low.",
    },
    {
      type: "Supply Zone",
      layer: input.layer,
      timestamp: last.timestamp,
      price: round(previousHigh, decimals),
      priceTo: round(previousHigh - atr * 0.6, decimals),
      bias: "BEARISH",
      confidence: confidence(62),
      reason: "Supply zone prepared around the recent range high.",
    },
    {
      type: "Demand Zone",
      layer: input.layer,
      timestamp: last.timestamp,
      price: round(previousLow, decimals),
      priceTo: round(previousLow + atr * 0.6, decimals),
      bias: "BULLISH",
      confidence: confidence(62),
      reason: "Demand zone prepared around the recent range low.",
    },
  ];

  if (last.high > previousHigh && last.close < previousHigh) {
    detections.push({
      type: "Liquidity Sweep",
      layer: input.layer,
      timestamp: last.timestamp,
      price: last.high,
      bias: "BEARISH",
      confidence: confidence(78),
      reason: "Buy-side liquidity was swept and rejected back into range.",
    });
  }

  if (last.low < previousLow && last.close > previousLow) {
    detections.push({
      type: "Liquidity Sweep",
      layer: input.layer,
      timestamp: last.timestamp,
      price: last.low,
      bias: "BULLISH",
      confidence: confidence(78),
      reason: "Sell-side liquidity was swept and recovered back into range.",
    });
  }

  const imbalanceBase = candles.at(-3);
  if (imbalanceBase && last.low > imbalanceBase.high) {
    detections.push({
      type: "Fair Value Gap",
      layer: input.layer,
      timestamp: last.timestamp,
      price: imbalanceBase.high,
      priceTo: last.low,
      bias: "BULLISH",
      confidence: confidence(70),
      reason: "Bullish fair value gap detected between recent candles.",
    });
  }

  if (imbalanceBase && last.high < imbalanceBase.low) {
    detections.push({
      type: "Fair Value Gap",
      layer: input.layer,
      timestamp: last.timestamp,
      price: last.high,
      priceTo: imbalanceBase.low,
      bias: "BEARISH",
      confidence: confidence(70),
      reason: "Bearish fair value gap detected between recent candles.",
    });
  }

  const orderBlock = [...previous].reverse().find(candle => candle.close !== candle.open);
  if (orderBlock) {
    const bullish = last.close >= last.open;
    detections.push({
      type: "Order Block",
      layer: input.layer,
      timestamp: orderBlock.timestamp,
      price: orderBlock.open,
      priceTo: orderBlock.close,
      bias: bullish ? "BULLISH" : "BEARISH",
      confidence: confidence(64),
      reason: "Nearest displacement candle is marked as a provisional order block.",
    });
  }

  return detections;
}

export function determineKalosTrend(mode: KalosInput["mode"], analysis: readonly KalosLayerAnalysis[]): KalosBias {
  const weights: Record<KalosInput["mode"], Record<string, number>> = {
    SCALPING: { HTF: 0.15, MTF: 0.3, LTF: 0.55 },
    SHORT_TERM: { HTF: 0.25, MTF: 0.35, LTF: 0.4 },
    LONG_TERM: { HTF: 0.5, MTF: 0.3, LTF: 0.2 },
  };
  const directionalValue = analysis.reduce((total, item) => {
    return total + biasDirectionValue(item.entryScore.bias) * item.entryScore.score * (weights[mode][item.layer] ?? 0);
  }, 0);

  if (directionalValue > 18) return "BULLISH";
  if (directionalValue < -18) return "BEARISH";
  return "NEUTRAL";
}

function overlayColor(status: KalosOverlayObject["status"], signal: KalosSignal) {
  if (status === "REJECTED") return "#f4c86a";
  if (signal === "BUY") return "#63e6a6";
  if (signal === "SELL") return "#ff7777";
  return "#8ad7ff";
}

function overlayStatus(signal: KalosSignal, confidenceValue: number, levels: Pick<KalosOutput, "tp" | "sl" | "invalidation">) {
  if ((signal === "BUY" || signal === "SELL") && confidenceValue >= 80 && levels.tp !== null && levels.sl !== null) {
    return "ACCEPTED";
  }

  if (signal === "NO_TRADE") return "REJECTED";
  return "NEUTRAL";
}

export function buildRejectedReasons(
  signal: KalosSignal,
  confidenceValue: number,
  levels: Pick<KalosOutput, "tp" | "sl" | "invalidation">,
  volatilityLevel: string,
  globalNoTrade: NoTradeReading,
  staleReasons: readonly string[]
): readonly string[] {
  const reasons = new Set<string>();

  if (confidenceValue < 80) reasons.add("Confidence below 80 blocks any executable signal.");
  if (levels.sl === null) reasons.add("SL is absent; KALOS blocks execution.");
  if (levels.tp === null) reasons.add("TP is absent; KALOS blocks execution.");
  if (volatilityLevel === "EXTREME") reasons.add("Market is too chaotic for execution.");
  for (const reason of staleReasons) reasons.add(reason);
  for (const reason of globalNoTrade.reasons) reasons.add(reason);
  if (signal === "WAIT") reasons.add("KALOS is waiting because directional confirmation is incomplete.");

  return [...reasons];
}

export function buildKalosOverlayObjects(
  signal: KalosSignal,
  confidenceValue: number,
  levels: Pick<KalosOutput, "tp" | "sl" | "invalidation">,
  analysis: readonly KalosLayerAnalysis[]
): readonly KalosOverlayObject[] {
  const ltf = analysis.find(item => item.layer === "LTF") ?? analysis.at(-1);
  if (!ltf) return [];

  const status = overlayStatus(signal, confidenceValue, levels);
  const color = overlayColor(status, signal);
  const timestamp = ltf.smartMoneyDetections.at(-1)?.timestamp ?? ltf.structureDetections.at(-1)?.timestamp;
  const price = latestPrice([], ltf.price ?? undefined);
  const objects: KalosOverlayObject[] = [];
  let index = 0;
  const nextId = (label: string) => `kalos-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index++}`;

  for (const detection of ltf.structureDetections.filter(item => item.type === "BOS" || item.type === "CHoCH")) {
    objects.push({
      id: nextId(detection.type),
      type: "LABEL",
      label: detection.type,
      layer: detection.layer,
      timestamp: detection.timestamp,
      price: detection.price,
      status,
      color,
      reason: detection.reason,
    });
  }

  for (const detection of ltf.smartMoneyDetections.filter(item =>
    item.type === "Liquidity Sweep" || item.type === "Buy Side Liquidity" || item.type === "Sell Side Liquidity"
  )) {
    objects.push({
      id: nextId(detection.type),
      type: detection.priceTo === undefined ? "LEVEL" : "ZONE",
      label: detection.type,
      layer: detection.layer,
      timestamp: detection.timestamp,
      price: detection.price,
      toPrice: detection.priceTo,
      status,
      color: detection.type === "Liquidity Sweep" ? "#f4c86a" : color,
      reason: detection.reason,
    });
  }

  for (const detection of ltf.smartMoneyDetections.filter(item =>
    item.type === "Supply Zone" || item.type === "Demand Zone" || item.type === "Fair Value Gap" || item.type === "Order Block"
  )) {
    objects.push({
      id: nextId(detection.type),
      type: "ZONE",
      label: detection.type,
      layer: detection.layer,
      timestamp: detection.timestamp,
      fromPrice: detection.price,
      toPrice: detection.priceTo,
      status,
      color,
      reason: detection.reason,
    });
  }

  if (levels.tp !== null) {
    objects.push({
      id: nextId("TP"),
      type: "ZONE",
      label: "TP",
      timestamp,
      price: levels.tp,
      status,
      color: "#63e6a6",
      reason: "Take-profit zone prepared by KALOS analysis.",
    });
  }

  if (levels.sl !== null) {
    objects.push({
      id: nextId("SL"),
      type: "ZONE",
      label: "SL",
      timestamp,
      price: levels.sl,
      status,
      color: "#ff7777",
      reason: "Stop-loss zone prepared by KALOS analysis.",
    });
  }

  if (levels.invalidation !== null) {
    objects.push({
      id: nextId("Invalidation"),
      type: "ZONE",
      label: "Invalidation",
      timestamp,
      price: levels.invalidation,
      status,
      color: "#f4c86a",
      reason: "Invalidation zone prepared by KALOS analysis.",
    });
  }

  if ((signal === "BUY" || signal === "SELL") && typeof price === "number") {
    objects.push(
      {
        id: nextId(`${signal} Arrow`),
        type: "ARROW",
        label: `${signal} Arrow`,
        timestamp,
        price,
        direction: signal,
        status,
        color,
        reason: "Directional arrow is visual analysis only.",
      },
      {
        id: nextId("KALOS Signal Ball"),
        type: "SIGNAL_BALL",
        label: "KALOS Signal Ball",
        timestamp,
        price,
        direction: signal,
        status,
        color,
        reason: "Signal ball marks the current KALOS decision point.",
      },
      {
        id: nextId("Projection"),
        type: "PROJECTION",
        label: "Projection probable",
        timestamp,
        price,
        toPrice: levels.tp ?? price,
        direction: signal,
        status,
        color,
        reason: "Projection is probabilistic and not a prediction.",
      }
    );
  }

  return objects;
}
