import type { Request, Response } from "express";
import { razonJournalService } from "../services/razonJournalService";
import { getCurrentUserScope } from "../services/connectors/connectorSecretsRepository";
import { marketAggregator } from "../services/market/marketAggregator";
import type { MarketTimeframe } from "../services/market/marketProvider";
import { rejectInvalidPriceSignal, validateSignalPriceRelation } from "../services/priceValidation";
import { sendJson } from "../utils/http";

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

export async function getSignals(req: Request, res: Response) {
  try {
    const timeframe = parseTimeframe(req);
    const opportunities = await marketAggregator.getOpportunities(timeframe);
    const requestedSymbol = parseSymbol(req);
    const selectedSymbol = requestedSymbol ?? opportunities[0]?.symbol ?? "EUR/USD";
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
    const signal = {
      ...rejectInvalidPriceSignal(baseSignal, validation),
      currentPrice: validation.currentPrice,
      invalidation: validation.invalidation,
      symbol: validation.symbol,
      timeframe: validation.timeframe,
      source: validation.source,
      decimals: validation.decimals,
      priceValidation: validation,
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
      topOpportunities: opportunities,
      bestMarket: opportunities[0] ?? null,
      journalEntryId: journalEntry.id,
      automaticTradingAllowed: false as const,
      mt5Connected: false as const,
      liveExecutionEnabled: false as const,
      disclaimer: "Probability-based analysis, not financial advice." as const,
      generatedAt: journalEntry.timestamp,
    });
  } catch (error) {
    return res.status(502).json({
      error: "RAZON signal radar error",
      message: error instanceof Error ? error.message : "Unable to run signal radar",
      generatedAt: new Date().toISOString(),
    });
  }
}
