import type { Request, Response } from "express";
import { razonJournalService } from "../services/razonJournalService";
import { getCurrentUserScope } from "../services/connectors/connectorSecretsRepository";
import { executionEngineState, parseTradingMode } from "../services/execution/executionEngine";
import { marketAggregator } from "../services/market/marketAggregator";
import type { MarketTimeframe } from "../services/market/marketProvider";
import { rejectInvalidPriceSignal, validateSignalPriceRelation } from "../services/priceValidation";
import { sendJson } from "../utils/http";
import type { RazonSignalDirection } from "../types/razon";

const timeframes: MarketTimeframe[] = ["1m", "5m", "15m", "1h", "1d"];
const timeframeAliases: Record<string, MarketTimeframe> = {
  M1: "1m",
  M5: "5m",
  M15: "15m",
  H1: "1h",
  D1: "1d",
};

function parseTimeframe(req: Request): MarketTimeframe {
  const value = Array.isArray(req.query.timeframe)
    ? req.query.timeframe[0]
    : req.query.timeframe;

  if (typeof value !== "string") return "5m";
  const normalized = value.trim();
  const alias = timeframeAliases[normalized.toUpperCase()];

  if (alias) return alias;

  return timeframes.includes(normalized as MarketTimeframe) ? (normalized as MarketTimeframe) : "5m";
}

function parseSymbol(req: Request) {
  const value = Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol;
  return typeof value === "string" && value.trim() ? value : null;
}

function signalDirection(decision: string): RazonSignalDirection {
  if (decision === "BUY") return "UP";
  if (decision === "SELL") return "DOWN";
  return "WAIT";
}

function expiryFor(timeframe: MarketTimeframe) {
  const minutes = timeframe === "1m" ? 1 : timeframe === "5m" ? 5 : timeframe === "15m" ? 15 : timeframe === "1h" ? 60 : 1440;
  return new Date(Date.now() + minutes * 3 * 60 * 1000).toISOString();
}

export async function getSignals(req: Request, res: Response) {
  try {
    const timeframe = parseTimeframe(req);
    const tradingMode = parseTradingMode(Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode);
    const opportunities = await marketAggregator.getOpportunities(timeframe);
    const requestedSymbol = parseSymbol(req);
    const selectedSymbol = requestedSymbol ?? opportunities[0]?.symbol ?? "Boom 500";
    const user = getCurrentUserScope(req);
    const analysis = await marketAggregator.getKalos(selectedSymbol, timeframe, user);
    const snapshot = await marketAggregator.getSnapshot(selectedSymbol, timeframe, user);
    const source = analysis.source ?? snapshot.ticker.source;
    const baseSignal = {
      signal: analysis.decision,
      decision: analysis.decision,
      confidence: analysis.confidence,
      probability: analysis.probability,
      risk: analysis.risk,
      entry:
        analysis.entryZone === null
          ? null
          : Number(((analysis.entryZone[0] + analysis.entryZone[1]) / 2).toFixed(5)),
      entryZone: analysis.entryZone,
      sl: analysis.sl,
      tp: analysis.tp,
      invalidationLevel: analysis.invalidationLevel,
      reasons: analysis.technicalReasons,
      whyBuy: analysis.whyBuy,
      whySell: analysis.whySell,
      whyWait: analysis.whyWait,
      currentPrice: snapshot.ticker.price,
      invalidation: analysis.invalidationLevel,
      symbol: snapshot.symbol,
      timeframe,
      source,
      decimals: 0,
    };
    const validation = validateSignalPriceRelation({
      signal: baseSignal,
      snapshot,
      symbol: snapshot.symbol,
      timeframe,
      source,
    });
    const priceCheckedSignal = rejectInvalidPriceSignal(baseSignal, validation);
    const signal = {
      ...priceCheckedSignal,
      direction: signalDirection(baseSignal.decision),
      currentPrice: validation.currentPrice,
      invalidation: validation.invalidation,
      symbol: validation.symbol,
      timeframe: validation.timeframe,
      source: validation.source,
      decimals: validation.decimals,
      TP: validation.tp,
      SL: validation.sl,
      expiry: expiryFor(timeframe),
      expirationTime: analysis.signalHorizon?.expirationTime ?? expiryFor(timeframe),
      signalHorizon: analysis.signalHorizon ?? null,
      priceValidation: validation,
      action: analysis.statisticalRisk?.action ?? (validation.valid ? priceCheckedSignal.decision : "INVALID"),
      calibratedConfidence: analysis.statisticalRisk?.calibratedConfidence,
      expectedValue: analysis.statisticalRisk?.expectedValue,
      sharpeRatio: analysis.statisticalRisk?.sharpeRatio,
      sharpeStatus: analysis.statisticalRisk?.sharpeStatus,
      drawdown: analysis.statisticalRisk?.drawdown,
      kellyFraction: analysis.statisticalRisk?.kellyFraction,
      recommendedStake: analysis.statisticalRisk?.recommendedStake,
      riskReward: analysis.statisticalRisk?.riskReward,
      volatilityRegime: analysis.statisticalRisk?.volatilityRegime,
      calibrationStatus: analysis.statisticalRisk?.calibration.status,
      calibrationError: analysis.statisticalRisk?.calibration.calibrationError,
      brierScore: analysis.statisticalRisk?.calibration.brierScore,
      stopLoss: analysis.statisticalRisk?.stopLoss ?? validation.sl,
      takeProfit: analysis.statisticalRisk?.takeProfit ?? validation.tp,
      noTradeReason: analysis.statisticalRisk?.noTradeReason ?? null,
      statisticalRisk: analysis.statisticalRisk ?? null,
    };
    const input = {
      symbol: selectedSymbol,
      price: snapshot.ticker.price,
      volume: snapshot.volume.volume,
      rsi: snapshot.indicators.rsi,
      ema: snapshot.indicators.ema20,
      atr: snapshot.indicators.atr,
      momentum: snapshot.indicators.momentum,
      trend: snapshot.indicators.trend,
      marketStrength: snapshot.indicators.marketStrength,
      volatility: snapshot.indicators.volatility,
    };
    const journalEntry = razonJournalService.recordDecision(input, signal);

    return sendJson(res, {
      mode: "demo" as const,
      source: "provider-backed" as const,
      input,
      signal,
      tradingMode,
      execution: executionEngineState(tradingMode),
      topOpportunities: opportunities,
      bestMarket: opportunities[0] ?? null,
      journalEntryId: journalEntry.id,
      automaticTradingAllowed: false as const,
      mt5Connected: false as const,
      liveExecutionEnabled: false as const,
      disclaimer: "Probability-based analysis, not financial advice." as const,
      generatedAt: journalEntry.timestamp,
      horizonValidation: analysis.signalHorizon?.validation ?? null,
    });
  } catch (error) {
    return res.status(502).json({
      error: "RAZON signal radar error",
      message: error instanceof Error ? error.message : "Unable to run signal radar",
      generatedAt: new Date().toISOString(),
    });
  }
}
