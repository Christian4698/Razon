import type {
  MarketDataStatus,
  NormalizedCandle,
  NormalizedTicker,
} from "../market/marketProvider";
import type {
  KalosDataGuardOutput,
  MarketDataQualityState,
  MarketDataSourceMode,
  MarketDataSourceStatus,
  MarketDataSyncStatus,
} from "../market/marketObservability";
import { calculateIndicators, type IndicatorSnapshot, type IndicatorSeries } from "./indicators";

export type KalosDecision = "BUY" | "SELL" | "WAIT" | "NO_TRADE" | "DATA_LOW" | "INVALID";
export type KalosRisk = "low" | "medium" | "high";

export interface KalosOutput {
  symbol: string;
  decision: KalosDecision;
  confidence: number;
  probability: number;
  risk: KalosRisk;
  explanation: string;
  whyBuy: string[];
  whySell: string[];
  whyWait: string[];
  entryZone: [number, number] | null;
  sl: number | null;
  tp: number | null;
  invalidationLevel: number | null;
  technicalReasons: string[];
  indicators: IndicatorSnapshot;
  indicatorSeries: IndicatorSeries;
  status: MarketDataStatus;
  source?: string;
  dataSource?: MarketDataSourceMode;
  sourceStatus?: MarketDataSourceStatus;
  syncStatus?: MarketDataSyncStatus;
  freshnessSeconds?: number | null;
  latencyMs?: number | null;
  dataQuality?: MarketDataQualityState;
  lastTickAt?: string | null;
  lastCandleAt?: string | null;
  dataGuard?: KalosDataGuardOutput;
  disclaimer: "Probability-based analysis, not financial advice.";
  generatedAt: string;
}

function round(value: number, decimals = 5): number {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function addScore(condition: boolean, score: number) {
  return condition ? score : 0;
}

function riskFromIndicators(indicators: IndicatorSnapshot): KalosRisk {
  if (indicators.volatility === "high") return "high";
  if (indicators.volatility === "low" && indicators.marketStrength >= 60) return "low";
  return "medium";
}

function pricePrecision(price: number) {
  if (price >= 1000) return 2;
  if (price >= 100) return 3;
  if (price >= 1) return 5;
  return 6;
}

function buildTradeLevels(
  decision: KalosDecision,
  price: number | null,
  atr: number | null
): Pick<KalosOutput, "entryZone" | "sl" | "tp" | "invalidationLevel"> {
  if ((decision !== "BUY" && decision !== "SELL") || typeof price !== "number" || typeof atr !== "number" || atr <= 0) {
    return {
      entryZone: null,
      sl: null,
      tp: null,
      invalidationLevel: null,
    };
  }

  const decimals = pricePrecision(price);
  const zone = atr * 0.2;

  if (decision === "BUY") {
    return {
      entryZone: [round(price - zone, decimals), round(price + zone, decimals)],
      sl: round(price - atr * 1.8, decimals),
      tp: round(price + atr * 2.8, decimals),
      invalidationLevel: round(price - atr * 2, decimals),
    };
  }

  return {
    entryZone: [round(price - zone, decimals), round(price + zone, decimals)],
    sl: round(price + atr * 1.8, decimals),
    tp: round(price - atr * 2.8, decimals),
    invalidationLevel: round(price + atr * 2, decimals),
  };
}

export const kalosEngine = {
  evaluate(ticker: NormalizedTicker, candles: NormalizedCandle[]): KalosOutput {
    const { snapshot: indicators, series: indicatorSeries } = calculateIndicators(candles);
    const price = ticker.price ?? candles.at(-1)?.close ?? null;
    const enoughCandles = candles.length >= 30;
    const whyBuy: string[] = [];
    const whySell: string[] = [];
    const whyWait: string[] = [];
    const technicalReasons: string[] = [];

    if (!enoughCandles || typeof price !== "number") {
      whyWait.push("Provider data is insufficient for a high-quality probability reading.");
      whyWait.push("RAZON needs live price and enough candles before producing directional analysis.");

      return {
        symbol: ticker.symbol,
        decision: "WAIT",
        confidence: 0,
        probability: 0,
        risk: "high",
        explanation:
          "Kalos is waiting because the connected provider did not return enough normalized market data.",
        whyBuy,
        whySell,
        whyWait,
        ...buildTradeLevels("WAIT", price, indicators.atr),
        technicalReasons: whyWait,
        indicators,
        indicatorSeries,
        status: ticker.status,
        disclaimer: "Probability-based analysis, not financial advice.",
        generatedAt: new Date().toISOString(),
      };
    }

    const emaBullish =
      typeof indicators.ema20 === "number" &&
      typeof indicators.ema50 === "number" &&
      price > indicators.ema20 &&
      indicators.ema20 > indicators.ema50;
    const emaBearish =
      typeof indicators.ema20 === "number" &&
      typeof indicators.ema50 === "number" &&
      price < indicators.ema20 &&
      indicators.ema20 < indicators.ema50;
    const rsiBullish = typeof indicators.rsi === "number" && indicators.rsi >= 52 && indicators.rsi <= 70;
    const rsiBearish = typeof indicators.rsi === "number" && indicators.rsi <= 48 && indicators.rsi >= 30;
    const macdBullish =
      typeof indicators.macd.histogram === "number" && indicators.macd.histogram > 0;
    const macdBearish =
      typeof indicators.macd.histogram === "number" && indicators.macd.histogram < 0;
    const momentumBullish = typeof indicators.momentum === "number" && indicators.momentum > 0;
    const momentumBearish = typeof indicators.momentum === "number" && indicators.momentum < 0;
    const volumeConfirmed =
      typeof indicators.volume.relative === "number" && indicators.volume.relative >= 0.85;
    const strongMarket = indicators.marketStrength >= 55;

    let buyScore = 0;
    buyScore += addScore(emaBullish, 22);
    buyScore += addScore(rsiBullish, 16);
    buyScore += addScore(macdBullish, 14);
    buyScore += addScore(momentumBullish, 12);
    buyScore += addScore(indicators.bos === "bullish" || indicators.choch === "bullish", 12);
    buyScore += addScore(volumeConfirmed, 10);
    buyScore += addScore(strongMarket, 8);
    buyScore += addScore(indicators.volatility !== "high", 6);

    let sellScore = 0;
    sellScore += addScore(emaBearish, 22);
    sellScore += addScore(rsiBearish, 16);
    sellScore += addScore(macdBearish, 14);
    sellScore += addScore(momentumBearish, 12);
    sellScore += addScore(indicators.bos === "bearish" || indicators.choch === "bearish", 12);
    sellScore += addScore(volumeConfirmed, 10);
    sellScore += addScore(strongMarket, 8);
    sellScore += addScore(indicators.volatility !== "high", 6);

    if (emaBullish) whyBuy.push("EMA 20 is above EMA 50 and price is holding above the short-term average.");
    if (rsiBullish) whyBuy.push("RSI supports upside pressure without being overextended.");
    if (macdBullish) whyBuy.push("MACD histogram is positive, showing bullish momentum.");
    if (momentumBullish) whyBuy.push("Momentum is positive over the recent candle window.");
    if (indicators.bos === "bullish" || indicators.choch === "bullish") {
      whyBuy.push("Market structure shows bullish BOS/CHOCH behavior.");
    }

    if (emaBearish) whySell.push("EMA 20 is below EMA 50 and price is trading under the short-term average.");
    if (rsiBearish) whySell.push("RSI supports downside pressure without being oversold.");
    if (macdBearish) whySell.push("MACD histogram is negative, showing bearish momentum.");
    if (momentumBearish) whySell.push("Momentum is negative over the recent candle window.");
    if (indicators.bos === "bearish" || indicators.choch === "bearish") {
      whySell.push("Market structure shows bearish BOS/CHOCH behavior.");
    }

    if (!volumeConfirmed) whyWait.push("Volume confirmation is weak or unavailable.");
    if (indicators.volatility === "high") whyWait.push("Volatility is elevated, increasing analysis risk.");
    if (Math.abs(buyScore - sellScore) < 12) {
      whyWait.push("Directional evidence is balanced, so waiting has the better risk profile.");
    }
    if (typeof indicators.rsi === "number" && (indicators.rsi > 72 || indicators.rsi < 28)) {
      whyWait.push("RSI is extended, so chasing the move is avoided.");
    }

    const decision: KalosDecision =
      buyScore >= 58 && buyScore - sellScore >= 12
        ? "BUY"
        : sellScore >= 58 && sellScore - buyScore >= 12
          ? "SELL"
          : "WAIT";
    const dominantScore = decision === "BUY" ? buyScore : decision === "SELL" ? sellScore : Math.max(buyScore, sellScore);
    const confidence = decision === "WAIT" ? clamp(Math.round(100 - Math.abs(buyScore - sellScore) * 2), 35, 72) : clamp(Math.round(dominantScore), 1, 100);
    const probability = decision === "WAIT" ? clamp(Math.round(50 + Math.abs(buyScore - sellScore) * 0.25), 35, 68) : clamp(Math.round(50 + dominantScore * 0.42), 51, 92);
    const risk = riskFromIndicators(indicators);

    technicalReasons.push(
      `EMA trend: ${indicators.trend}`,
      `RSI: ${indicators.rsi ?? "unavailable"}`,
      `ATR: ${indicators.atr ?? "unavailable"}`,
      `Market strength: ${indicators.marketStrength}`,
      `Volatility: ${indicators.volatility}`,
      `Volume relative: ${indicators.volume.relative ?? "unavailable"}`
    );

    if (indicators.candlestickPatterns.length > 0) {
      technicalReasons.push(`Candlestick patterns: ${indicators.candlestickPatterns.join(", ")}`);
    }

    return {
      symbol: ticker.symbol,
      decision,
      confidence,
      probability,
      risk,
      explanation:
        decision === "WAIT"
          ? "Kalos does not see enough directional alignment for a probability-based BUY or SELL."
          : `Kalos favors ${decision} because multiple technical inputs are aligned. This is probability-based analysis, not a prediction.`,
      whyBuy,
      whySell,
      whyWait,
      ...buildTradeLevels(decision, price, indicators.atr),
      technicalReasons,
      indicators,
      indicatorSeries,
      status: ticker.status,
      disclaimer: "Probability-based analysis, not financial advice.",
      generatedAt: new Date().toISOString(),
    };
  },
};
