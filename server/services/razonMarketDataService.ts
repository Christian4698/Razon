import type { RazonMarketInput, RazonMarketSnapshot } from "../types/razon";

const DEFAULT_MARKET_INPUT: RazonMarketInput = {
  price: 100,
  volume: 1250000,
  rsi: 56,
  ema: 98.4,
  atr: 1.8,
};

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function valueOrDefault(value: number | null, fallback: number | null): number {
  return typeof value === "number" ? value : fallback ?? 0;
}

export const razonMarketDataService = {
  getDefaultInput(): RazonMarketInput {
    return { ...DEFAULT_MARKET_INPUT };
  },

  getSnapshot(input: RazonMarketInput = DEFAULT_MARKET_INPUT): RazonMarketSnapshot {
    const generatedAt = new Date().toISOString();
    const offsets = [-1.8, -0.8, -1.1, 0.2, 0.7, 0];
    const safeInput = {
      price: valueOrDefault(input.price, DEFAULT_MARKET_INPUT.price),
      volume: valueOrDefault(input.volume, DEFAULT_MARKET_INPUT.volume),
      rsi: valueOrDefault(input.rsi, DEFAULT_MARKET_INPUT.rsi),
      ema: valueOrDefault(input.ema, DEFAULT_MARKET_INPUT.ema),
      atr: valueOrDefault(input.atr, DEFAULT_MARKET_INPUT.atr),
    };

    return {
      mode: "demo",
      source: "simulated-v1",
      instrument: "RAZON:SIM",
      generatedAt,
      input: {
        price: round(safeInput.price),
        volume: round(safeInput.volume, 0),
        rsi: round(safeInput.rsi, 1),
        ema: round(safeInput.ema),
        atr: round(safeInput.atr),
      },
      candles: offsets.map((offset, index) => ({
        timestamp: new Date(Date.now() - (offsets.length - index - 1) * 60000)
          .toISOString(),
        price: round(safeInput.price + offset * safeInput.atr),
        volume: round(safeInput.volume * (0.9 + index * 0.025), 0),
      })),
      verifiedPerformance: false,
      performanceMessage: "No verified performance yet",
    };
  },
};
