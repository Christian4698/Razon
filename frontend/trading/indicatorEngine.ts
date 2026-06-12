export type IndicatorType = "RSI" | "MACD" | "ROC" | "BOLLINGER" | "DONCHIAN" | "SMA" | "EMA";
export type IndicatorPane = "price" | "oscillator";

export interface IndicatorInputCandle {
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface IndicatorParams {
  readonly period?: number;
  readonly fast?: number;
  readonly slow?: number;
  readonly signal?: number;
  readonly deviation?: number;
}

export interface IndicatorConfig {
  readonly id: string;
  readonly type: IndicatorType;
  readonly params: IndicatorParams;
  readonly color: string;
}

export interface IndicatorLine {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  readonly values: readonly (number | null)[];
}

export interface ComputedIndicator {
  readonly id: string;
  readonly type: IndicatorType;
  readonly label: string;
  readonly pane: IndicatorPane;
  readonly params: IndicatorParams;
  readonly lines: readonly IndicatorLine[];
}

export const indicatorCatalog: readonly { readonly type: IndicatorType; readonly label: string }[] = [
  { type: "RSI", label: "RSI" },
  { type: "MACD", label: "MACD" },
  { type: "ROC", label: "ROC" },
  { type: "BOLLINGER", label: "Bollinger" },
  { type: "DONCHIAN", label: "Donchian" },
  { type: "SMA", label: "SMA" },
  { type: "EMA", label: "EMA" },
];

const indicatorColors: Record<IndicatorType, string> = {
  RSI: "#8ad7ff",
  MACD: "#f4c86a",
  ROC: "#d6a3ff",
  BOLLINGER: "#58f0d1",
  DONCHIAN: "#ffb86b",
  SMA: "#eef4ef",
  EMA: "#63e6a6",
};

const defaultParams: Record<IndicatorType, IndicatorParams> = {
  RSI: { period: 14 },
  MACD: { fast: 12, slow: 26, signal: 9 },
  ROC: { period: 12 },
  BOLLINGER: { period: 20, deviation: 2 },
  DONCHIAN: { period: 20 },
  SMA: { period: 20 },
  EMA: { period: 20 },
};

function clampParam(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(Math.min(Math.max(numeric, min), max));
}

function clampDeviation(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, 0.5), 5);
}

export function normalizeIndicatorParams(type: IndicatorType, params: IndicatorParams): IndicatorParams {
  const defaults = defaultParams[type];

  if (type === "MACD") {
    const fast = clampParam(params.fast, defaults.fast ?? 12, 2, 100);
    const slow = Math.max(fast + 1, clampParam(params.slow, defaults.slow ?? 26, 3, 140));

    return {
      fast,
      slow,
      signal: clampParam(params.signal, defaults.signal ?? 9, 2, 80),
    };
  }

  if (type === "BOLLINGER") {
    return {
      period: clampParam(params.period, defaults.period ?? 20, 2, 200),
      deviation: clampDeviation(params.deviation, defaults.deviation ?? 2),
    };
  }

  return {
    period: clampParam(params.period, defaults.period ?? 14, 2, 200),
  };
}

export function createIndicatorConfig(type: IndicatorType): IndicatorConfig {
  return {
    id: `ind-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    params: defaultParams[type],
    color: indicatorColors[type],
  };
}

export function normalizeIndicatorConfigs(value: unknown): IndicatorConfig[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is IndicatorConfig => {
      if (!item || typeof item !== "object") return false;
      const config = item as Partial<IndicatorConfig>;
      return typeof config.id === "string" && indicatorCatalog.some(catalogItem => catalogItem.type === config.type);
    })
    .map(config => ({
      id: config.id,
      type: config.type,
      params: normalizeIndicatorParams(config.type, config.params ?? {}),
      color: typeof config.color === "string" ? config.color : indicatorColors[config.type],
    }))
    .slice(0, 5);
}

function labelForType(type: IndicatorType) {
  return indicatorCatalog.find(item => item.type === type)?.label ?? type;
}

function emptySeries(length: number): (number | null)[] {
  return Array.from({ length }, () => null as number | null);
}

function sma(values: readonly number[], period: number): (number | null)[] {
  const output = emptySeries(values.length);
  let sum = 0;

  values.forEach((value, index) => {
    sum += value;
    if (index >= period) sum -= values[index - period] ?? 0;
    if (index >= period - 1) output[index] = sum / period;
  });

  return output;
}

function ema(values: readonly number[], period: number): (number | null)[] {
  const output = emptySeries(values.length);
  const multiplier = 2 / (period + 1);
  let seedSum = 0;
  let previous: number | null = null;

  values.forEach((value, index) => {
    if (index < period - 1) {
      seedSum += value;
      return;
    }

    if (index === period - 1) {
      seedSum += value;
      previous = seedSum / period;
      output[index] = previous;
      return;
    }

    previous = previous === null ? value : value * multiplier + previous * (1 - multiplier);
    output[index] = previous;
  });

  return output;
}

function emaNullable(values: readonly (number | null)[], period: number): (number | null)[] {
  const output = emptySeries(values.length);
  const multiplier = 2 / (period + 1);
  let seed: number[] = [];
  let previous: number | null = null;

  values.forEach((value, index) => {
    if (value === null) return;

    if (previous === null) {
      seed = [...seed, value].slice(-period);
      if (seed.length === period) {
        previous = seed.reduce((sum, item) => sum + item, 0) / period;
        output[index] = previous;
      }
      return;
    }

    previous = value * multiplier + previous * (1 - multiplier);
    output[index] = previous;
  });

  return output;
}

function rsi(values: readonly number[], period: number): (number | null)[] {
  const output = emptySeries(values.length);
  let gainSum = 0;
  let lossSum = 0;
  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index < values.length; index += 1) {
    const current = values[index];
    const previous = values[index - 1];
    if (current === undefined || previous === undefined) continue;

    const change = current - previous;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (index <= period) {
      gainSum += gain;
      lossSum += loss;

      if (index === period) {
        averageGain = gainSum / period;
        averageLoss = lossSum / period;
        output[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
      }
      continue;
    }

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    output[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return output;
}

function roc(values: readonly number[], period: number): (number | null)[] {
  const output = emptySeries(values.length);

  for (let index = period; index < values.length; index += 1) {
    const base = values[index - period];
    const current = values[index];
    if (base === undefined || current === undefined) continue;

    output[index] = base === 0 ? 0 : ((current - base) / base) * 100;
  }

  return output;
}

function bollinger(values: readonly number[], period: number, deviation: number) {
  const middle = sma(values, period);
  const upper = emptySeries(values.length);
  const lower = emptySeries(values.length);

  for (let index = period - 1; index < values.length; index += 1) {
    const mean = middle[index];
    if (mean === null || mean === undefined) continue;

    const slice = values.slice(index - period + 1, index + 1);
    const variance = slice.reduce((sum, item) => sum + (item - mean) ** 2, 0) / period;
    const band = Math.sqrt(variance) * deviation;
    upper[index] = mean + band;
    lower[index] = mean - band;
  }

  return { upper, middle, lower };
}

function donchian(candles: readonly IndicatorInputCandle[], period: number) {
  const upper = emptySeries(candles.length);
  const middle = emptySeries(candles.length);
  const lower = emptySeries(candles.length);

  for (let index = period - 1; index < candles.length; index += 1) {
    const slice = candles.slice(index - period + 1, index + 1);
    const high = Math.max(...slice.map(candle => candle.high));
    const low = Math.min(...slice.map(candle => candle.low));
    upper[index] = high;
    lower[index] = low;
    middle[index] = (high + low) / 2;
  }

  return { upper, middle, lower };
}

export function computeIndicators(candles: readonly IndicatorInputCandle[], configs: readonly IndicatorConfig[]): ComputedIndicator[] {
  const closes = candles.map(candle => candle.close);

  return configs.map((config): ComputedIndicator => {
    const params = normalizeIndicatorParams(config.type, config.params);
    const label = labelForType(config.type);

    if (config.type === "RSI") {
      return {
        ...config,
        label,
        pane: "oscillator",
        params,
        lines: [{ key: "rsi", label: `${label} ${params.period}`, color: config.color, values: rsi(closes, params.period ?? 14) }],
      };
    }

    if (config.type === "ROC") {
      return {
        ...config,
        label,
        pane: "oscillator",
        params,
        lines: [{ key: "roc", label: `${label} ${params.period}`, color: config.color, values: roc(closes, params.period ?? 12) }],
      };
    }

    if (config.type === "MACD") {
      const fast = ema(closes, params.fast ?? 12);
      const slow = ema(closes, params.slow ?? 26);
      const macd = closes.map((_, index) => {
        const fastValue = fast[index];
        const slowValue = slow[index];
        return fastValue === null || fastValue === undefined || slowValue === null || slowValue === undefined
          ? null
          : fastValue - slowValue;
      });
      const signal = emaNullable(macd, params.signal ?? 9);
      const histogram = macd.map((value, index) => {
        const signalValue = signal[index];
        return value === null || signalValue === null || signalValue === undefined ? null : value - signalValue;
      });

      return {
        ...config,
        label,
        pane: "oscillator",
        params,
        lines: [
          { key: "macd", label: "MACD", color: config.color, values: macd },
          { key: "signal", label: "Signal", color: "#8ad7ff", values: signal },
          { key: "histogram", label: "Hist", color: "#63e6a6", values: histogram },
        ],
      };
    }

    if (config.type === "BOLLINGER") {
      const band = bollinger(closes, params.period ?? 20, params.deviation ?? 2);

      return {
        ...config,
        label,
        pane: "price",
        params,
        lines: [
          { key: "upper", label: "BB Upper", color: config.color, values: band.upper },
          { key: "middle", label: "BB Mid", color: "#b8c7c2", values: band.middle },
          { key: "lower", label: "BB Lower", color: config.color, values: band.lower },
        ],
      };
    }

    if (config.type === "DONCHIAN") {
      const channel = donchian(candles, params.period ?? 20);

      return {
        ...config,
        label,
        pane: "price",
        params,
        lines: [
          { key: "upper", label: "DC Upper", color: config.color, values: channel.upper },
          { key: "middle", label: "DC Mid", color: "#f4c86a", values: channel.middle },
          { key: "lower", label: "DC Lower", color: config.color, values: channel.lower },
        ],
      };
    }

    const period = params.period ?? 20;
    const values = config.type === "EMA" ? ema(closes, period) : sma(closes, period);

    return {
      ...config,
      label,
      pane: "price",
      params,
      lines: [{ key: config.type.toLowerCase(), label: `${label} ${period}`, color: config.color, values }],
    };
  });
}

export function latestIndicatorValue(indicator: ComputedIndicator, index: number) {
  return indicator.lines
    .map(line => ({ label: line.label, color: line.color, value: line.values[index] ?? null }))
    .filter(item => item.value !== null);
}
