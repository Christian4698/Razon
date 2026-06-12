import { derivDemoReadOnlyClient } from "../deriv/DerivDemoReadOnlyClient";
import { DERIV_SYNTHETIC_SYMBOLS } from "../deriv/derivSymbols";

export type MarketCategory =
  | "forex"
  | "metals"
  | "indices"
  | "crypto"
  | "derivSynthetic"
  | "stocks";

export type MarketTrend = "bullish" | "bearish" | "sideways" | "unavailable";
export type MarketDataStatus = "live" | "delayed" | "unavailable" | "not_configured";
export type MarketTimeframe = "1m" | "5m" | "15m" | "1h" | "1d";

export interface NormalizedSymbol {
  symbol: string;
  displayName: string;
  category: MarketCategory;
  provider: string;
  providerSymbol: string;
  quoteAsset?: string;
}

export interface NormalizedTicker {
  symbol: string;
  category: MarketCategory;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  trend: MarketTrend;
  status: MarketDataStatus;
  source: string;
  updatedAt: string;
  providerMessage?: string;
}

export interface NormalizedCandle {
  symbol: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  source: string;
}

export interface NormalizedOrderBookLevel {
  price: number;
  size: number;
}

export interface NormalizedOrderBook {
  symbol: string;
  bids: NormalizedOrderBookLevel[];
  asks: NormalizedOrderBookLevel[];
  status: MarketDataStatus;
  source: string;
  updatedAt: string;
  providerMessage?: string;
}

export interface NormalizedVolume {
  symbol: string;
  volume: number | null;
  status: MarketDataStatus;
  source: string;
  updatedAt: string;
  providerMessage?: string;
}

export interface MarketDataProvider {
  readonly id: string;
  readonly label: string;
  supports(symbol: NormalizedSymbol): boolean;
  getCandles(symbol: NormalizedSymbol, timeframe: MarketTimeframe): Promise<NormalizedCandle[]>;
  getTicker(symbol: NormalizedSymbol): Promise<NormalizedTicker>;
  getOrderBook(symbol: NormalizedSymbol): Promise<NormalizedOrderBook>;
  getVolume(symbol: NormalizedSymbol): Promise<NormalizedVolume>;
  getSymbols(): Promise<NormalizedSymbol[]>;
}

const forexSymbols = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "NZD/USD",
  "USD/CAD",
  "EUR/GBP",
  "EUR/JPY",
  "GBP/JPY",
  "AUD/JPY",
] as const;

const metalSymbols = ["XAU/USD", "XAG/USD"] as const;
const indexSymbols = ["NAS100", "US30", "SPX500", "GER40", "UK100"] as const;
const cryptoSymbols = ["BTC/USD", "ETH/USD", "SOL/USD", "BNB/USD"] as const;
const derivSyntheticSymbols = [
  "Volatility 10",
  "Volatility 25",
  "Volatility 50",
  "Volatility 75",
  "Volatility 100",
  "Crash 300",
  "Crash 500",
  "Crash 1000",
  "Boom 300",
  "Boom 500",
  "Boom 1000",
  "Step Index",
  "Jump Index",
] as const;

const stockSymbols = ["AAPL", "MSFT", "NVDA", "TSLA"] as const;

const yahooSymbolMap: Record<string, string> = {
  "EUR/USD": "EURUSD=X",
  "GBP/USD": "GBPUSD=X",
  "USD/JPY": "JPY=X",
  "USD/CHF": "CHF=X",
  "AUD/USD": "AUDUSD=X",
  "NZD/USD": "NZDUSD=X",
  "USD/CAD": "CAD=X",
  "EUR/GBP": "EURGBP=X",
  "EUR/JPY": "EURJPY=X",
  "GBP/JPY": "GBPJPY=X",
  "AUD/JPY": "AUDJPY=X",
  "XAU/USD": "GC=F",
  "XAG/USD": "SI=F",
  NAS100: "^NDX",
  US30: "^DJI",
  SPX500: "^GSPC",
  GER40: "^GDAXI",
  UK100: "^FTSE",
  AAPL: "AAPL",
  MSFT: "MSFT",
  NVDA: "NVDA",
  TSLA: "TSLA",
};

const binanceSymbolMap: Record<string, string> = {
  "BTC/USD": "BTCUSDT",
  "ETH/USD": "ETHUSDT",
  "SOL/USD": "SOLUSDT",
  "BNB/USD": "BNBUSDT",
};

const derivSymbolMap: Record<string, string> = DERIV_SYNTHETIC_SYMBOLS;

function symbol(symbol: string, category: MarketCategory, provider: string, providerSymbol: string): NormalizedSymbol {
  return {
    symbol,
    displayName: symbol,
    category,
    provider,
    providerSymbol,
    quoteAsset: symbol.includes("/") ? symbol.split("/")[1] : undefined,
  };
}

export const DEFAULT_MARKET_SYMBOLS: NormalizedSymbol[] = [
  ...forexSymbols.map(item => symbol(item, "forex", "forex-market-data-api", yahooSymbolMap[item])),
  ...metalSymbols.map(item => symbol(item, "metals", "forex-market-data-api", yahooSymbolMap[item])),
  ...indexSymbols.map(item => symbol(item, "indices", "forex-market-data-api", yahooSymbolMap[item])),
  ...cryptoSymbols.map(item => symbol(item, "crypto", "crypto-api", binanceSymbolMap[item])),
  ...derivSyntheticSymbols.map(item =>
    symbol(item, "derivSynthetic", "deriv-api-websocket", derivSymbolMap[item])
  ),
  ...stockSymbols.map(item => symbol(item, "stocks", "forex-market-data-api", yahooSymbolMap[item])),
];

function trendFromChange(changePercent: number | null): MarketTrend {
  if (typeof changePercent !== "number") return "unavailable";
  if (changePercent > 0.15) return "bullish";
  if (changePercent < -0.15) return "bearish";
  return "sideways";
}

function now() {
  return new Date().toISOString();
}

function unavailableTicker(symbolConfig: NormalizedSymbol, source: string, message: string): NormalizedTicker {
  return {
    symbol: symbolConfig.symbol,
    category: symbolConfig.category,
    price: null,
    changePercent: null,
    volume: null,
    trend: "unavailable",
    status: "unavailable",
    source,
    updatedAt: now(),
    providerMessage: message,
  };
}

function unavailableOrderBook(symbolConfig: NormalizedSymbol, source: string, status: MarketDataStatus, message: string): NormalizedOrderBook {
  return {
    symbol: symbolConfig.symbol,
    bids: [],
    asks: [],
    status,
    source,
    updatedAt: now(),
    providerMessage: message,
  };
}

function unavailableVolume(symbolConfig: NormalizedSymbol, source: string, status: MarketDataStatus, message: string): NormalizedVolume {
  return {
    symbol: symbolConfig.symbol,
    volume: null,
    status,
    source,
    updatedAt: now(),
    providerMessage: message,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "RAZON/1.0 market-analysis-platform",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

interface BinanceTickerResponse {
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

export class CryptoApiProvider implements MarketDataProvider {
  readonly id = "crypto-api";
  readonly label = "Crypto API";

  supports(symbolConfig: NormalizedSymbol) {
    return symbolConfig.category === "crypto";
  }

  async getSymbols() {
    return DEFAULT_MARKET_SYMBOLS.filter(item => item.category === "crypto");
  }

  async getTicker(symbolConfig: NormalizedSymbol): Promise<NormalizedTicker> {
    try {
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbolConfig.providerSymbol)}`;
      const payload = await fetchJson<BinanceTickerResponse>(url);
      const changePercent = Number(payload.priceChangePercent);

      return {
        symbol: symbolConfig.symbol,
        category: symbolConfig.category,
        price: Number(payload.lastPrice),
        changePercent,
        volume: Number(payload.quoteVolume),
        trend: trendFromChange(changePercent),
        status: "live",
        source: this.label,
        updatedAt: now(),
      };
    } catch (error) {
      return unavailableTicker(symbolConfig, this.label, error instanceof Error ? error.message : "Crypto provider unavailable");
    }
  }

  async getCandles(symbolConfig: NormalizedSymbol, timeframe: MarketTimeframe): Promise<NormalizedCandle[]> {
    const intervalMap: Record<MarketTimeframe, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "1h",
      "1d": "1d",
    };

    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbolConfig.providerSymbol)}&interval=${intervalMap[timeframe]}&limit=120`;
      const payload = await fetchJson<BinanceKline[]>(url);

      return payload.map(item => ({
        symbol: symbolConfig.symbol,
        timestamp: new Date(item[0]).toISOString(),
        open: Number(item[1]),
        high: Number(item[2]),
        low: Number(item[3]),
        close: Number(item[4]),
        volume: Number(item[7]),
        source: this.label,
      }));
    } catch {
      return [];
    }
  }

  async getOrderBook(symbolConfig: NormalizedSymbol): Promise<NormalizedOrderBook> {
    try {
      const url = `https://api.binance.com/api/v3/depth?symbol=${encodeURIComponent(symbolConfig.providerSymbol)}&limit=10`;
      const payload = await fetchJson<{ bids: [string, string][]; asks: [string, string][] }>(url);

      return {
        symbol: symbolConfig.symbol,
        bids: payload.bids.map(([price, size]) => ({ price: Number(price), size: Number(size) })),
        asks: payload.asks.map(([price, size]) => ({ price: Number(price), size: Number(size) })),
        status: "live",
        source: this.label,
        updatedAt: now(),
      };
    } catch (error) {
      return unavailableOrderBook(symbolConfig, this.label, "unavailable", error instanceof Error ? error.message : "Order book unavailable");
    }
  }

  async getVolume(symbolConfig: NormalizedSymbol): Promise<NormalizedVolume> {
    const ticker = await this.getTicker(symbolConfig);

    return {
      symbol: symbolConfig.symbol,
      volume: ticker.volume,
      status: ticker.status,
      source: ticker.source,
      updatedAt: ticker.updatedAt,
      providerMessage: ticker.providerMessage,
    };
  }
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketVolume?: number;
      };
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

export class ForexMarketDataApiProvider implements MarketDataProvider {
  readonly id = "forex-market-data-api";
  readonly label = "Forex Market Data API";

  supports(symbolConfig: NormalizedSymbol) {
    return ["forex", "metals", "indices", "stocks"].includes(symbolConfig.category);
  }

  async getSymbols() {
    return DEFAULT_MARKET_SYMBOLS.filter(item => this.supports(item));
  }

  async getTicker(symbolConfig: NormalizedSymbol): Promise<NormalizedTicker> {
    try {
      const url = this.chartUrl(symbolConfig, "5m", "1d");
      const payload = await fetchJson<YahooChartResponse>(url);
      const result = payload.chart?.result?.[0];

      if (!result) {
        throw new Error(payload.chart?.error?.description ?? "No chart result");
      }

      const meta = result.meta ?? {};
      const quotes = result.indicators?.quote?.[0];
      const closes = quotes?.close?.filter((value): value is number => typeof value === "number") ?? [];
      const latest = meta.regularMarketPrice ?? closes.at(-1);
      const previous = meta.chartPreviousClose ?? meta.previousClose ?? closes.at(0);

      if (typeof latest !== "number" || typeof previous !== "number" || previous === 0) {
        throw new Error("Provider did not return a price");
      }

      const changePercent = ((latest - previous) / previous) * 100;

      return {
        symbol: symbolConfig.symbol,
        category: symbolConfig.category,
        price: latest,
        changePercent,
        volume: meta.regularMarketVolume ?? null,
        trend: trendFromChange(changePercent),
        status: symbolConfig.category === "forex" ? "live" : "delayed",
        source: this.label,
        updatedAt: now(),
      };
    } catch (error) {
      return unavailableTicker(symbolConfig, this.label, error instanceof Error ? error.message : "Market provider unavailable");
    }
  }

  async getCandles(symbolConfig: NormalizedSymbol, timeframe: MarketTimeframe): Promise<NormalizedCandle[]> {
    const intervalMap: Record<MarketTimeframe, { interval: string; range: string }> = {
      "1m": { interval: "1m", range: "1d" },
      "5m": { interval: "5m", range: "5d" },
      "15m": { interval: "15m", range: "5d" },
      "1h": { interval: "60m", range: "1mo" },
      "1d": { interval: "1d", range: "6mo" },
    };

    try {
      const choice = intervalMap[timeframe];
      const payload = await fetchJson<YahooChartResponse>(
        this.chartUrl(symbolConfig, choice.interval, choice.range)
      );
      const result = payload.chart?.result?.[0];
      const timestamps = result?.timestamp ?? [];
      const quote = result?.indicators?.quote?.[0];

      if (!quote || timestamps.length === 0) return [];

      return timestamps.flatMap((timestamp, index) => {
        const open = quote.open?.[index];
        const high = quote.high?.[index];
        const low = quote.low?.[index];
        const close = quote.close?.[index];

        if (
          typeof open !== "number" ||
          typeof high !== "number" ||
          typeof low !== "number" ||
          typeof close !== "number"
        ) {
          return [];
        }

        return {
          symbol: symbolConfig.symbol,
          timestamp: new Date(timestamp * 1000).toISOString(),
          open,
          high,
          low,
          close,
          volume: quote.volume?.[index] ?? null,
          source: this.label,
        };
      });
    } catch {
      return [];
    }
  }

  async getOrderBook(symbolConfig: NormalizedSymbol): Promise<NormalizedOrderBook> {
    return unavailableOrderBook(
      symbolConfig,
      this.label,
      "not_configured",
      "Order book is not available from the configured forex/CFD data adapter."
    );
  }

  async getVolume(symbolConfig: NormalizedSymbol): Promise<NormalizedVolume> {
    const ticker = await this.getTicker(symbolConfig);

    return {
      symbol: symbolConfig.symbol,
      volume: ticker.volume,
      status: ticker.status,
      source: ticker.source,
      updatedAt: ticker.updatedAt,
      providerMessage: ticker.providerMessage,
    };
  }

  private chartUrl(symbolConfig: NormalizedSymbol, interval: string, range: string) {
    return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbolConfig.providerSymbol)}?range=${range}&interval=${interval}`;
  }
}

export class DerivWebSocketProvider implements MarketDataProvider {
  readonly id = "deriv-api-websocket";
  readonly label = "Deriv DEMO Read-Only";

  supports(symbolConfig: NormalizedSymbol) {
    return symbolConfig.category === "derivSynthetic";
  }

  async getSymbols() {
    return DEFAULT_MARKET_SYMBOLS.filter(item => item.category === "derivSynthetic");
  }

  async getTicker(symbolConfig: NormalizedSymbol): Promise<NormalizedTicker> {
    const ticker = await derivDemoReadOnlyClient.getTicker(symbolConfig.providerSymbol);

    return {
      ...ticker,
      symbol: symbolConfig.symbol,
      category: symbolConfig.category,
      source: this.label,
    };
  }

  async getCandles(symbolConfig: NormalizedSymbol, timeframe: MarketTimeframe): Promise<NormalizedCandle[]> {
    const candles = await derivDemoReadOnlyClient.getCandles(symbolConfig.providerSymbol, timeframe);

    return candles.map(candle => ({
      ...candle,
      symbol: symbolConfig.symbol,
      source: this.label,
    }));
  }

  async getOrderBook(symbolConfig: NormalizedSymbol): Promise<NormalizedOrderBook> {
    return unavailableOrderBook(
      symbolConfig,
      this.label,
      "not_configured",
      "Synthetic order book is not exposed through the configured V1 Deriv adapter."
    );
  }

  async getVolume(symbolConfig: NormalizedSymbol): Promise<NormalizedVolume> {
    return unavailableVolume(
      symbolConfig,
      this.label,
      "not_configured",
      "Deriv synthetic tick volume is not enabled in V1."
    );
  }

}

export class Mt5FutureConnectorProvider implements MarketDataProvider {
  readonly id = "mt5-future-connector";
  readonly label = "MT5 Future Connector";

  supports() {
    return false;
  }

  async getSymbols() {
    return [];
  }

  async getTicker(symbolConfig: NormalizedSymbol) {
    return unavailableTicker(
      symbolConfig,
      this.label,
      "MT5 connector is intentionally disabled in V1. Analysis only."
    );
  }

  async getCandles() {
    return [];
  }

  async getOrderBook(symbolConfig: NormalizedSymbol) {
    return unavailableOrderBook(
      symbolConfig,
      this.label,
      "not_configured",
      "MT5 order book is not connected in V1."
    );
  }

  async getVolume(symbolConfig: NormalizedSymbol) {
    return unavailableVolume(
      symbolConfig,
      this.label,
      "not_configured",
      "MT5 volume is not connected in V1."
    );
  }
}
