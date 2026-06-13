import { kalosEngine, type KalosOutput } from "../kalos/kalosEngine";
import { calculateIndicators, type IndicatorSnapshot, type IndicatorSeries } from "../kalos/indicators";
import { derivDemoReadOnlyClient } from "../deriv/DerivDemoReadOnlyClient";
import {
  getSecretMetadata,
  readConnectorSecret,
  type CurrentUserScope,
} from "../connectors/connectorSecretsRepository";
import { marketCache } from "./marketCache";
import {
  CryptoApiProvider,
  DEFAULT_MARKET_SYMBOLS,
  DerivWebSocketProvider,
  ForexMarketDataApiProvider,
  Mt5FutureConnectorProvider,
  type MarketCategory,
  type MarketDataProvider,
  type MarketDataStatus,
  type MarketTimeframe,
  type MarketTrend,
  type NormalizedCandle,
  type NormalizedOrderBook,
  type NormalizedSymbol,
  type NormalizedTicker,
  type NormalizedVolume,
} from "./marketProvider";
import {
  applyKalosDataGuard,
  buildMarketDataHealth,
  createMockUpdatedAt,
  type KalosDataGuardOutput,
  type MarketDataHealthModel,
} from "./marketObservability";

export type MarketScannerState = "HOT" | "NORMAL" | "AVOID";

export interface MarketSnapshot {
  symbol: string;
  timeframe: MarketTimeframe;
  ticker: NormalizedTicker;
  candles: NormalizedCandle[];
  indicators: IndicatorSnapshot;
  indicatorSeries: IndicatorSeries;
  orderBook: NormalizedOrderBook;
  volume: NormalizedVolume;
  observability: MarketDataHealthModel;
  dataGuard: KalosDataGuardOutput;
  fallback: "NONE" | "MOCK_DATA";
  generatedAt: string;
}

export interface MarketHubCategory {
  id: MarketCategory;
  label: string;
  symbols: NormalizedSymbol[];
  tickers: NormalizedTicker[];
}

export interface MarketHubResponse {
  generatedAt: string;
  categories: MarketHubCategory[];
  symbols: NormalizedSymbol[];
  providers: Array<{ id: string; label: string }>;
  disclaimer: "Provider-backed market data can be live or delayed depending on source availability.";
}

export interface MarketScanResult {
  symbol: string;
  category: MarketCategory;
  state: MarketScannerState;
  heatScore: number;
  trend: MarketTrend;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  status: MarketDataStatus;
  source: string;
  updatedAt: string;
  reason: string;
}

export interface MarketOpportunity {
  symbol: string;
  category: MarketCategory;
  score: number;
  confidence: number;
  probability: number;
  trend: MarketTrend;
  risk: KalosOutput["risk"];
  decision: KalosOutput["decision"];
  price: number | null;
  status: MarketDataStatus;
  generatedAt: string;
}

const providers: MarketDataProvider[] = [
  new CryptoApiProvider(),
  new ForexMarketDataApiProvider(),
  new DerivWebSocketProvider(),
  new Mt5FutureConnectorProvider(),
];

const categoryLabels: Record<MarketCategory, string> = {
  forex: "Forex",
  metals: "Metals",
  indices: "Indices",
  crypto: "Crypto",
  derivSynthetic: "Deriv Synthetic",
  stocks: "Stocks",
};

const categoryOrder: MarketCategory[] = [
  "forex",
  "metals",
  "indices",
  "crypto",
  "derivSynthetic",
  "stocks",
];

function now() {
  return new Date().toISOString();
}

function dataModeAllowsMockFallback() {
  return process.env.DATA_MODE !== "REAL_DATA";
}

function unavailableTicker(symbol: NormalizedSymbol, message: string): NormalizedTicker {
  return {
    symbol: symbol.symbol,
    category: symbol.category,
    price: null,
    changePercent: null,
    volume: null,
    trend: "unavailable",
    status: "unavailable",
    source: symbol.provider,
    updatedAt: now(),
    providerMessage: message,
  };
}

function unavailableOrderBook(symbol: NormalizedSymbol, message: string): NormalizedOrderBook {
  return {
    symbol: symbol.symbol,
    bids: [],
    asks: [],
    status: "unavailable",
    source: symbol.provider,
    updatedAt: now(),
    providerMessage: message,
  };
}

function unavailableVolume(symbol: NormalizedSymbol, message: string): NormalizedVolume {
  return {
    symbol: symbol.symbol,
    volume: null,
    status: "unavailable",
    source: symbol.provider,
    updatedAt: now(),
    providerMessage: message,
  };
}

function resolveSymbol(symbol: string): NormalizedSymbol | null {
  const decoded = decodeURIComponent(symbol).trim().toUpperCase();

  return (
    DEFAULT_MARKET_SYMBOLS.find(item => item.symbol.toUpperCase() === decoded) ??
    DEFAULT_MARKET_SYMBOLS.find(item => item.providerSymbol.toUpperCase() === decoded) ??
    null
  );
}

function providerFor(symbol: NormalizedSymbol) {
  return providers.find(provider => provider.supports(symbol)) ?? null;
}

function personalDerivToken(user: CurrentUserScope | null | undefined, symbol: NormalizedSymbol | null) {
  if (!user || !symbol || symbol.category !== "derivSynthetic") return null;

  const metadata = getSecretMetadata(user, "deriv-demo");
  if (!metadata.saved || metadata.connected !== true || metadata.accountType !== "DEMO") return null;

  return readConnectorSecret(user, "deriv-demo");
}

function timeframeMinutes(timeframe: MarketTimeframe) {
  if (timeframe === "1m") return 1;
  if (timeframe === "5m") return 5;
  if (timeframe === "15m") return 15;
  if (timeframe === "1h") return 60;
  return 1440;
}

function createMockDerivCandles(symbol: NormalizedSymbol, timeframe: MarketTimeframe): NormalizedCandle[] {
  const seed = Array.from(symbol.providerSymbol).reduce((total, char) => total + char.charCodeAt(0), 0);
  const base = seed % 5 === 0 ? 320 : seed % 3 === 0 ? 4800 : 8200 + seed;
  const step = base > 1000 ? 8 + (seed % 17) : 0.6 + (seed % 7) / 10;
  const minutes = timeframeMinutes(timeframe);
  const current = Date.now();

  return Array.from({ length: 120 }, (_, index) => {
    const timestamp = new Date(current - (119 - index) * minutes * 60 * 1000).toISOString();
    const wave = Math.sin((index + seed) * 0.31) * step + Math.cos((index + seed) * 0.17) * step * 0.45;
    const trend = (index - 60) * step * 0.04;
    const open = base + wave + trend;
    const close = open + Math.sin((index + seed) * 0.47) * step * 0.55;
    const high = Math.max(open, close) + step * 0.7;
    const low = Math.min(open, close) - step * 0.7;

    return {
      symbol: symbol.symbol,
      timestamp,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume: Math.round(900 + Math.abs(Math.sin(index * 0.4 + seed)) * 1600),
      source: "MOCK_DATA",
    };
  });
}

function createMockDerivTicker(symbol: NormalizedSymbol, candles: readonly NormalizedCandle[], message: string): NormalizedTicker {
  const last = candles.at(-1);

  return {
    symbol: symbol.symbol,
    category: symbol.category,
    price: last?.close ?? null,
    changePercent:
      candles.length > 1 && candles[0].close !== 0
        ? Number((((candles.at(-1)!.close - candles[0].close) / candles[0].close) * 100).toFixed(2))
        : null,
    volume: last?.volume ?? null,
    trend: "sideways",
    status: "delayed",
    source: "MOCK_DATA",
    updatedAt: createMockUpdatedAt(),
    providerMessage: message,
  };
}

function createMockOrderBook(symbol: NormalizedSymbol): NormalizedOrderBook {
  return {
    symbol: symbol.symbol,
    bids: [],
    asks: [],
    status: "not_configured",
    source: "MOCK_DATA",
    updatedAt: now(),
    providerMessage: "MOCK_DATA fallback does not expose an order book.",
  };
}

function createMockVolume(symbol: NormalizedSymbol, candles: readonly NormalizedCandle[]): NormalizedVolume {
  return {
    symbol: symbol.symbol,
    volume: candles.at(-1)?.volume ?? null,
    status: "delayed",
    source: "MOCK_DATA",
    updatedAt: now(),
    providerMessage: "MOCK_DATA fallback volume is simulated.",
  };
}

function shouldFallbackToMock(symbol: NormalizedSymbol, ticker: NormalizedTicker, candles: readonly NormalizedCandle[]) {
  return (
    symbol.category === "derivSynthetic" &&
    dataModeAllowsMockFallback() &&
    (ticker.status === "unavailable" || ticker.status === "not_configured" || ticker.price === null || candles.length === 0)
  );
}

function applyDataGuardToKalos(output: KalosOutput, guard: KalosDataGuardOutput): KalosOutput {
  if (guard.action === "ALLOW_ANALYSIS") return output;

  const decision = guard.decisionOverride ?? "WAIT";
  const baseWhyWait = decision === "WAIT" || decision === "DATA_LOW" || decision === "INVALID"
    ? [...guard.reasons, ...output.whyWait]
    : output.whyWait;

  return {
    ...output,
    decision,
    confidence: guard.action === "NO_TRADE" || guard.action === "INVALID" ? 0 : Math.min(output.confidence, 35),
    probability: guard.action === "NO_TRADE" || guard.action === "INVALID" ? 0 : Math.min(output.probability, 50),
    risk: "high",
    explanation: `${guard.reasons.join(" ")} Analysis remains read-only and no order is possible.`,
    whyWait: baseWhyWait,
    entryZone: null,
    sl: null,
    tp: null,
    invalidationLevel: null,
    technicalReasons: [...guard.reasons, ...guard.rejectedReasons, ...output.technicalReasons],
  };
}

function attachDataContextToKalos(output: KalosOutput, snapshot: MarketSnapshot): KalosOutput {
  return {
    ...output,
    source: snapshot.observability.sourceLabel,
    dataSource: snapshot.observability.source,
    sourceStatus: snapshot.observability.sourceStatus,
    syncStatus: snapshot.observability.syncStatus,
    freshnessSeconds: snapshot.observability.freshnessSeconds,
    latencyMs: snapshot.observability.latencyMs,
    dataQuality: snapshot.observability.dataQuality,
    lastTickAt: snapshot.observability.lastTickAt,
    lastCandleAt: snapshot.observability.lastCandleAt,
    dataGuard: snapshot.dataGuard,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function heatFromTicker(ticker: NormalizedTicker): Pick<MarketScanResult, "state" | "heatScore" | "reason"> {
  if (ticker.status === "unavailable" || ticker.status === "not_configured" || ticker.price === null) {
    return {
      state: "AVOID",
      heatScore: 0,
      reason: ticker.providerMessage ?? "Provider data is unavailable.",
    };
  }

  const change = Math.abs(ticker.changePercent ?? 0);
  const heatScore = clamp(Math.round(45 + change * 12), 1, 100);

  if (heatScore >= 68) {
    return {
      state: "HOT",
      heatScore,
      reason: "Price movement and provider status are active enough for analysis priority.",
    };
  }

  return {
    state: "NORMAL",
    heatScore,
    reason: "Market is available with moderate movement.",
  };
}

async function withFallback<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

export const marketAggregator = {
  providers,

  getSymbols(): NormalizedSymbol[] {
    return [...DEFAULT_MARKET_SYMBOLS];
  },

  getSymbol(symbol: string): NormalizedSymbol | null {
    return resolveSymbol(symbol);
  },

  async getTicker(symbolName: string, user?: CurrentUserScope): Promise<NormalizedTicker> {
    const symbol = resolveSymbol(symbolName);

    if (!symbol) {
      return {
        symbol: symbolName,
        category: "forex",
        price: null,
        changePercent: null,
        volume: null,
        trend: "unavailable",
        status: "unavailable",
        source: "RAZON Market Aggregator",
        updatedAt: now(),
        providerMessage: "Symbol is not configured in RAZON V1 coverage.",
      };
    }

    const provider = providerFor(symbol);
    if (!provider) return unavailableTicker(symbol, "No provider supports this symbol.");
    const token = personalDerivToken(user, symbol);

    if (token) {
      return marketCache.getOrSet(`ticker:${user?.userId}:personal-deriv:${symbol.symbol}`, 15000, () =>
        withFallback(
          () => derivDemoReadOnlyClient.getTickerWithPersonalToken(token, symbol.providerSymbol).then(ticker => ({
            ...ticker,
            symbol: symbol.symbol,
            category: symbol.category,
          })),
          unavailableTicker(symbol, "Personal Deriv DEMO provider request failed.")
        )
      );
    }

    return marketCache.getOrSet(`ticker:${symbol.symbol}`, 15000, () =>
      withFallback(
        () => provider.getTicker(symbol),
        unavailableTicker(symbol, "Provider request failed.")
      )
    );
  },

  async getCandles(symbolName: string, timeframe: MarketTimeframe, user?: CurrentUserScope): Promise<NormalizedCandle[]> {
    const symbol = resolveSymbol(symbolName);
    if (!symbol) return [];

    const provider = providerFor(symbol);
    if (!provider) return [];
    const token = personalDerivToken(user, symbol);

    if (token) {
      return marketCache.getOrSet(`candles:${user?.userId}:personal-deriv:${symbol.symbol}:${timeframe}`, 60000, () =>
        withFallback(
          () => derivDemoReadOnlyClient.getCandlesWithPersonalToken(token, symbol.providerSymbol, timeframe).then(candles =>
            candles.map(candle => ({
              ...candle,
              symbol: symbol.symbol,
            }))
          ),
          []
        )
      );
    }

    return marketCache.getOrSet(`candles:${symbol.symbol}:${timeframe}`, 60000, () =>
      withFallback(() => provider.getCandles(symbol, timeframe), [])
    );
  },

  async getOrderBook(symbolName: string): Promise<NormalizedOrderBook> {
    const symbol = resolveSymbol(symbolName);
    if (!symbol) {
      return {
        symbol: symbolName,
        bids: [],
        asks: [],
        status: "unavailable",
        source: "RAZON Market Aggregator",
        updatedAt: now(),
        providerMessage: "Symbol is not configured in RAZON V1 coverage.",
      };
    }

    const provider = providerFor(symbol);
    if (!provider) return unavailableOrderBook(symbol, "No provider supports this symbol.");

    return marketCache.getOrSet(`orderbook:${symbol.symbol}`, 20000, () =>
      withFallback(
        () => provider.getOrderBook(symbol),
        unavailableOrderBook(symbol, "Order book request failed.")
      )
    );
  },

  async getVolume(symbolName: string): Promise<NormalizedVolume> {
    const symbol = resolveSymbol(symbolName);
    if (!symbol) return unavailableVolume({ ...DEFAULT_MARKET_SYMBOLS[0], symbol: symbolName }, "Symbol is not configured in RAZON V1 coverage.");

    const provider = providerFor(symbol);
    if (!provider) return unavailableVolume(symbol, "No provider supports this symbol.");

    return marketCache.getOrSet(`volume:${symbol.symbol}`, 15000, () =>
      withFallback(() => provider.getVolume(symbol), unavailableVolume(symbol, "Volume request failed."))
    );
  },

  async getSnapshot(symbolName = "EUR/USD", timeframe: MarketTimeframe = "5m", user?: CurrentUserScope): Promise<MarketSnapshot> {
    const symbol = resolveSymbol(symbolName);
    const startedAt = Date.now();
    const [rawTicker, rawCandles, rawOrderBook, rawVolume] = await Promise.all([
      this.getTicker(symbolName, user),
      this.getCandles(symbolName, timeframe, user),
      this.getOrderBook(symbolName),
      this.getVolume(symbolName),
    ]);
    const fallback = symbol && shouldFallbackToMock(symbol, rawTicker, rawCandles) ? "MOCK_DATA" : "NONE";
    const candles = fallback === "MOCK_DATA" && symbol ? createMockDerivCandles(symbol, timeframe) : rawCandles;
    const ticker =
      fallback === "MOCK_DATA" && symbol
        ? createMockDerivTicker(
            symbol,
            candles,
            rawTicker.providerMessage ?? "Deriv DEMO unavailable; using MOCK_DATA fallback because DATA_MODE=DEMO_DATA."
          )
        : rawTicker;
    const orderBook = fallback === "MOCK_DATA" && symbol ? createMockOrderBook(symbol) : rawOrderBook;
    const volume = fallback === "MOCK_DATA" && symbol ? createMockVolume(symbol, candles) : rawVolume;
    const indicators = calculateIndicators(candles);
    const observability = buildMarketDataHealth({
      ticker,
      candles,
      timeframe,
      latencyMs: Date.now() - startedAt,
      tickRate: ticker.price === null ? 0 : 1,
    });
    const dataGuard = applyKalosDataGuard(observability);

    return {
      symbol: ticker.symbol,
      timeframe,
      ticker,
      candles,
      indicators: indicators.snapshot,
      indicatorSeries: indicators.series,
      orderBook,
      volume,
      observability,
      dataGuard,
      fallback,
      generatedAt: now(),
    };
  },

  async getHub(): Promise<MarketHubResponse> {
    const symbols = this.getSymbols();
    const tickers = await Promise.all(symbols.map(item => this.getTicker(item.symbol)));

    return {
      generatedAt: now(),
      categories: categoryOrder.map(category => ({
        id: category,
        label: categoryLabels[category],
        symbols: symbols.filter(item => item.category === category),
        tickers: tickers.filter(item => item.category === category),
      })),
      symbols,
      providers: providers.map(provider => ({ id: provider.id, label: provider.label })),
      disclaimer: "Provider-backed market data can be live or delayed depending on source availability.",
    };
  },

  async scanMarkets(): Promise<MarketScanResult[]> {
    const tickers = await Promise.all(this.getSymbols().map(item => this.getTicker(item.symbol)));

    return tickers
      .map(ticker => {
        const heat = heatFromTicker(ticker);

        return {
          symbol: ticker.symbol,
          category: ticker.category,
          state: heat.state,
          heatScore: heat.heatScore,
          trend: ticker.trend,
          price: ticker.price,
          changePercent: ticker.changePercent,
          volume: ticker.volume,
          status: ticker.status,
          source: ticker.source,
          updatedAt: ticker.updatedAt,
          reason: heat.reason,
        };
      })
      .sort((a, b) => b.heatScore - a.heatScore);
  },

  async getKalos(symbolName = "EUR/USD", timeframe: MarketTimeframe = "5m", user?: CurrentUserScope): Promise<KalosOutput> {
    const snapshot = await this.getSnapshot(symbolName, timeframe, user);
    const guarded = applyDataGuardToKalos(
      kalosEngine.evaluate(snapshot.ticker, snapshot.candles),
      snapshot.dataGuard
    );

    return attachDataContextToKalos(guarded, snapshot);
  },

  async getOpportunities(timeframe: MarketTimeframe = "5m"): Promise<MarketOpportunity[]> {
    const scans = await this.scanMarkets();
    const candidates = scans
      .filter(item => item.status !== "unavailable" && item.status !== "not_configured")
      .slice(0, 12);
    const opportunities = await Promise.all(
      candidates.map(async item => {
        const analysis = await this.getKalos(item.symbol, timeframe);
        const score =
          analysis.decision === "WAIT"
            ? Math.round(analysis.probability * 0.45 + item.heatScore * 0.25)
            : Math.round(analysis.probability * 0.55 + analysis.confidence * 0.3 + item.heatScore * 0.15);

        return {
          symbol: item.symbol,
          category: item.category,
          score: clamp(score, 0, 100),
          confidence: analysis.confidence,
          probability: analysis.probability,
          trend: item.trend,
          risk: analysis.risk,
          decision: analysis.decision,
          price: item.price,
          status: item.status,
          generatedAt: analysis.generatedAt,
        };
      })
    );

    return opportunities.sort((a, b) => b.score - a.score);
  },
};
