import type { Request, Response } from "express";
import { getCurrentUserScope } from "../services/connectors/connectorSecretsRepository";
import { marketAggregator } from "../services/market/marketAggregator";
import type { MarketTimeframe } from "../services/market/marketProvider";
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
  return typeof value === "string" && value.trim() ? value : "Boom 500";
}

function sendControllerError(res: Response, error: unknown) {
  return res.status(502).json({
    error: "RAZON market provider error",
    message: error instanceof Error ? error.message : "Unable to reach market provider",
    generatedAt: new Date().toISOString(),
  });
}

export async function getMarketData(req: Request, res: Response) {
  try {
    const symbol = parseSymbol(req);
    const timeframe = parseTimeframe(req);
    const snapshot = await marketAggregator.getSnapshot(symbol, timeframe, getCurrentUserScope(req));

    return sendJson(res, {
      mode: "demo" as const,
      source: "provider-backed" as const,
      instrument: snapshot.symbol,
      generatedAt: snapshot.generatedAt,
      input: {
        symbol: snapshot.symbol,
        price: snapshot.ticker.price,
        volume: snapshot.volume.volume,
        rsi: snapshot.indicators.rsi,
        ema: snapshot.indicators.ema20,
        atr: snapshot.indicators.atr,
        momentum: snapshot.indicators.momentum,
        trend: snapshot.indicators.trend,
        marketStrength: snapshot.indicators.marketStrength,
        volatility: snapshot.indicators.volatility,
      },
      candles: snapshot.candles.map(candle => ({
        timestamp: candle.timestamp,
        price: candle.close,
        volume: candle.volume ?? 0,
      })),
      snapshot,
      verifiedPerformance: false as const,
      performanceMessage: "No verified performance yet" as const,
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function getMarketHub(_req: Request, res: Response) {
  try {
    return sendJson(res, await marketAggregator.getHub());
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function getMarketSnapshot(req: Request, res: Response) {
  try {
    return sendJson(
      res,
      await marketAggregator.getSnapshot(parseSymbol(req), parseTimeframe(req), getCurrentUserScope(req))
    );
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function getMarketScanner(_req: Request, res: Response) {
  try {
    return sendJson(res, {
      generatedAt: new Date().toISOString(),
      results: await marketAggregator.scanMarkets(),
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function getMarketSymbols(_req: Request, res: Response) {
  return sendJson(res, {
    generatedAt: new Date().toISOString(),
    symbols: marketAggregator.getSymbols(),
  });
}

export async function getKalos(req: Request, res: Response) {
  try {
    return sendJson(
      res,
      await marketAggregator.getKalos(parseSymbol(req), parseTimeframe(req), getCurrentUserScope(req))
    );
  } catch (error) {
    return sendControllerError(res, error);
  }
}
