import { createKalosEngine, type KalosInput, type KalosOutput } from "../kalos";
import { createNoTradeService } from "../no-trade/no-trade.service";
import type { KalosMode } from "../kalos";
import type { Timeframe } from "../../core/types/timeframe.types";
import { generateReport } from "./backtest.report";
import type {
  BacktestCandle,
  BacktestDataSource,
  BacktestJournalEntry,
  BacktestMode,
  BacktestNoTradeRecord,
  BacktestReplayFrame,
  BacktestRequest,
  BacktestRunResult,
  BacktestSignalRecord,
  BacktestTrade,
  BacktestTradeDirection,
  BacktestTradeExitReason,
  BacktestValidation,
} from "./backtest.types";

const MIN_BACKTEST_CANDLES = 120;
const LOOKBACK_CANDLES = 90;
const MAX_MOCK_CANDLES = 1500;

const timeframeMs: Record<Timeframe, number> = {
  M1: 60_000,
  M5: 5 * 60_000,
  M15: 15 * 60_000,
  M30: 30 * 60_000,
  H1: 60 * 60_000,
  H4: 4 * 60 * 60_000,
  D1: 24 * 60 * 60_000,
};

const modeLayerTimeframes: Record<BacktestMode, { htf: Timeframe; mtf: Timeframe; ltf: Timeframe }> = {
  SCALPING: { htf: "M15", mtf: "M5", ltf: "M1" },
  SHORT_TERM: { htf: "H1", mtf: "M15", ltf: "M5" },
  LONG_TERM: { htf: "D1", mtf: "H4", ltf: "H1" },
};

function now() {
  return new Date().toISOString();
}

function round(value: number, decimals = 5) {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function journal(type: BacktestJournalEntry["type"], message: string): BacktestJournalEntry {
  return {
    timestamp: now(),
    type,
    message,
  };
}

function kalosModeFromBacktest(mode: BacktestMode): KalosMode {
  return mode;
}

function riskDataSourceFromBacktest(dataSource: BacktestDataSource) {
  return dataSource === "mock" ? "MOCK" : "DEMO";
}

function maxHoldCandles(mode: BacktestMode) {
  if (mode === "SCALPING") return 12;
  if (mode === "SHORT_TERM") return 24;
  return 40;
}

function validatePeriod(from: string, to: string) {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  return Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs < toMs;
}

function filterPeriod(candles: readonly BacktestCandle[], request: BacktestRequest) {
  const fromMs = Date.parse(request.period.from);
  const toMs = Date.parse(request.period.to);

  return [...candles]
    .filter(candle => {
      const timestamp = Date.parse(candle.timestamp);
      return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function validateCandles(candles: readonly BacktestCandle[]) {
  return candles.every(candle => {
    const validTimestamp = Number.isFinite(Date.parse(candle.timestamp));
    const validPrices =
      candle.open > 0 &&
      candle.high > 0 &&
      candle.low > 0 &&
      candle.close > 0 &&
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close);
    return validTimestamp && validPrices;
  });
}

function mockSeed(symbol: string) {
  return [...symbol].reduce((total, char) => total + char.charCodeAt(0), 0);
}

function createMockCandles(request: BacktestRequest): readonly BacktestCandle[] {
  const fromMs = Date.parse(request.period.from);
  const toMs = Date.parse(request.period.to);
  const interval = timeframeMs[request.timeframe];
  const count = clamp(Math.floor((toMs - fromMs) / interval), 0, MAX_MOCK_CANDLES);
  const seed = mockSeed(request.symbol);
  const base = request.symbol.includes("XAU") ? 2300 : request.symbol.includes("JPY") ? 150 : 1.1;

  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin((seed + index) / 12) * 0.004;
    const drift = index * (request.mode === "LONG_TERM" ? 0.00008 : 0.00003);
    const open = base + wave + drift;
    const close = open + Math.cos((seed + index) / 8) * 0.0012;
    const high = Math.max(open, close) + 0.0018;
    const low = Math.min(open, close) - 0.0018;

    return {
      timestamp: new Date(fromMs + index * interval).toISOString(),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: 1000 + seed + index * 5,
    };
  });
}

function resolveCandles(request: BacktestRequest): {
  readonly candles: readonly BacktestCandle[];
  readonly dataSource: BacktestDataSource;
  readonly dataSourceMessage: string;
} {
  if (request.candles && request.candles.length > 0) {
    return {
      candles: filterPeriod(request.candles, request),
      dataSource: "historical",
      dataSourceMessage: "Historical candles provided by the caller.",
    };
  }

  return {
    candles: createMockCandles(request),
    dataSource: "mock",
    dataSourceMessage: "No historical candles were provided. RAZON used simulated mock candles.",
  };
}

function validateBacktestRequest(
  request: BacktestRequest,
  candles: readonly BacktestCandle[],
  dataSource: BacktestDataSource,
  dataSourceMessage: string
): BacktestValidation {
  const errors: string[] = [];

  if (!request.symbol.trim()) errors.push("Symbol is required.");
  if (request.strategy !== "KALOS") errors.push("Only KALOS strategy is supported in this phase.");
  if (!validatePeriod(request.period.from, request.period.to)) errors.push("Historical period is invalid.");
  if (request.initialCapital <= 0) errors.push("Initial capital must be greater than zero.");
  if (request.riskPerTradePercent <= 0 || request.riskPerTradePercent > 10) {
    errors.push("Risk per trade must be greater than 0 and at most 10 percent.");
  }
  if (request.simulatedSpread < 0) errors.push("Simulated spread cannot be negative.");
  if (request.simulatedSlippage < 0) errors.push("Simulated slippage cannot be negative.");
  if (candles.length < MIN_BACKTEST_CANDLES) {
    errors.push(`Backtest refused: at least ${MIN_BACKTEST_CANDLES} candles are required.`);
  }
  if (!validateCandles(candles)) errors.push("Backtest refused: candle data is invalid.");

  return {
    accepted: errors.length === 0,
    errors,
    dataSource,
    dataSourceMessage,
  };
}

function buildKalosInput(request: BacktestRequest, index: number, candles: readonly BacktestCandle[]): KalosInput {
  const modeTimeframes = modeLayerTimeframes[request.mode];
  const history = candles.slice(0, index + 1);
  const currentPrice = history.at(-1)?.close;

  return {
    symbol: request.symbol,
    mode: kalosModeFromBacktest(request.mode),
    layers: [
      {
        layer: "HTF",
        timeframe: modeTimeframes.htf,
        candles: history.slice(-90),
        currentPrice,
      },
      {
        layer: "MTF",
        timeframe: modeTimeframes.mtf,
        candles: history.slice(-60),
        currentPrice,
      },
      {
        layer: "LTF",
        timeframe: modeTimeframes.ltf,
        candles: history.slice(-35),
        currentPrice,
      },
    ],
  };
}

export function replayCandles(request: BacktestRequest, candles: readonly BacktestCandle[]): readonly BacktestReplayFrame[] {
  const frames: BacktestReplayFrame[] = [];

  for (let index = LOOKBACK_CANDLES; index < candles.length - 2; index += 1) {
    const candle = candles[index];
    if (!candle) continue;

    const kalosInput = buildKalosInput(request, index, candles);

    frames.push({
      index,
      timestamp: candle.timestamp,
      candle,
      layers: kalosInput.layers,
      kalosInput,
    });
  }

  return frames;
}

export function evaluateSignal(frame: BacktestReplayFrame): KalosOutput {
  const engine = createKalosEngine();
  return engine.evaluate(frame.kalosInput);
}

interface SimulatedTradeResult {
  readonly trade: BacktestTrade | null;
  readonly exitIndex: number;
  readonly error?: string;
}

function directionFromSignal(signal: KalosOutput): BacktestTradeDirection | null {
  if (signal.signal === "BUY" || signal.signal === "SELL") return signal.signal;
  return null;
}

function adjustedEntry(direction: BacktestTradeDirection, close: number, spread: number, slippage: number) {
  return direction === "BUY"
    ? round(close + spread / 2 + slippage)
    : round(close - spread / 2 - slippage);
}

function adjustedExit(direction: BacktestTradeDirection, price: number, slippage: number) {
  return direction === "BUY" ? round(price - slippage) : round(price + slippage);
}

function simulateTrade(
  request: BacktestRequest,
  frame: BacktestReplayFrame,
  signal: KalosOutput,
  candles: readonly BacktestCandle[],
  currentEquity: number
): SimulatedTradeResult {
  const direction = directionFromSignal(signal);
  const sl = signal.sl;
  const tp = signal.tp;

  if (!direction || typeof sl !== "number" || typeof tp !== "number") {
    return {
      trade: null,
      exitIndex: frame.index,
      error: "Directional signal did not include valid TP/SL levels.",
    };
  }

  const entry = adjustedEntry(direction, frame.candle.close, request.simulatedSpread, request.simulatedSlippage);
  const stopDistance = Math.abs(entry - sl);
  const targetDistance = Math.abs(tp - entry);

  if (stopDistance <= 0 || targetDistance <= 0) {
    return {
      trade: null,
      exitIndex: frame.index,
      error: "Backtest refused simulated trade: invalid stop or target distance.",
    };
  }

  const hold = maxHoldCandles(request.mode);
  const future = candles.slice(frame.index + 1, frame.index + 1 + hold);

  if (future.length === 0) {
    return {
      trade: null,
      exitIndex: frame.index,
      error: "No future candles are available to resolve the simulated trade.",
    };
  }

  let exitPrice = future.at(-1)?.close ?? entry;
  let exitReason: BacktestTradeExitReason = "END_OF_WINDOW";
  let exitIndex = frame.index + future.length;

  for (const [offset, candle] of future.entries()) {
    if (direction === "BUY") {
      if (candle.low <= sl) {
        exitPrice = adjustedExit(direction, sl, request.simulatedSlippage);
        exitReason = "SL";
        exitIndex = frame.index + 1 + offset;
        break;
      }

      if (candle.high >= tp) {
        exitPrice = adjustedExit(direction, tp, request.simulatedSlippage);
        exitReason = "TP";
        exitIndex = frame.index + 1 + offset;
        break;
      }
    } else {
      if (candle.high >= sl) {
        exitPrice = adjustedExit(direction, sl, request.simulatedSlippage);
        exitReason = "SL";
        exitIndex = frame.index + 1 + offset;
        break;
      }

      if (candle.low <= tp) {
        exitPrice = adjustedExit(direction, tp, request.simulatedSlippage);
        exitReason = "TP";
        exitIndex = frame.index + 1 + offset;
        break;
      }
    }
  }

  const riskAmount = currentEquity * (request.riskPerTradePercent / 100);
  const positionSize = riskAmount / stopDistance;
  const rawPnl = direction === "BUY" ? (exitPrice - entry) * positionSize : (entry - exitPrice) * positionSize;
  const pnl = round(rawPnl, 4);
  const rr = round(targetDistance / stopDistance, 4);
  const exitCandle = candles[exitIndex] ?? future.at(-1) ?? frame.candle;

  return {
    exitIndex,
    trade: {
      id: `trade-${frame.index}-${direction.toLowerCase()}`,
      signalIndex: frame.index,
      symbol: request.symbol,
      direction,
      entryTime: frame.timestamp,
      exitTime: exitCandle.timestamp,
      entryPrice: entry,
      exitPrice: round(exitPrice),
      sl,
      tp,
      riskAmount: round(riskAmount, 4),
      positionSize: round(positionSize, 6),
      rr,
      pnl,
      returnPercent: round((pnl / currentEquity) * 100, 4),
      exitReason,
      kalosConfidence: signal.confidence,
      kalosReasons: signal.reasons,
    },
  };
}

export function runBacktest(request: BacktestRequest): BacktestRunResult {
  const journalEntries: BacktestJournalEntry[] = [
    journal("BACKTEST_STARTED", `Backtest started for ${request.symbol} on ${request.timeframe}.`),
  ];
  const { candles, dataSource, dataSourceMessage } = resolveCandles(request);
  const validation = validateBacktestRequest(request, candles, dataSource, dataSourceMessage);
  const errors: string[] = [...validation.errors];

  if (!validation.accepted) {
    const report = generateReport({
      request,
      accepted: false,
      dataSource,
      dataSourceMessage,
      trades: [],
      kalosSignals: [],
      noTrade: [],
      errors,
      journal: [
        ...journalEntries,
        journal("BACKTEST_REJECTED", `Backtest rejected: ${errors.join(" ")}`),
      ],
    });

    return {
      report,
      candles,
      replayFrames: [],
    };
  }

  const frames = replayCandles(request, candles);
  const signals: BacktestSignalRecord[] = [];
  const noTrade: BacktestNoTradeRecord[] = [];
  const trades: BacktestTrade[] = [];
  const noTradeService = createNoTradeService();
  let equity = request.initialCapital;
  let nextTradableIndex = 0;

  for (const frame of frames) {
    const signal = evaluateSignal(frame);
    signals.push({ index: frame.index, timestamp: frame.timestamp, signal });
    journalEntries.push(journal("SIGNAL_EVALUATED", `${signal.signal} evaluated at ${frame.timestamp}.`));

    if (signal.signal === "WAIT" || signal.signal === "NO_TRADE") {
      noTrade.push({
        index: frame.index,
        timestamp: frame.timestamp,
        signal: signal.signal,
        confidence: signal.confidence,
        reasons: signal.reasons,
      });
      journalEntries.push(journal("NO_TRADE", `${signal.signal} recorded at ${frame.timestamp}.`));
      continue;
    }

    if (frame.index < nextTradableIndex) {
      continue;
    }

    const riskGate = noTradeService.shouldBlockTrade({
      symbol: request.symbol,
      timeframe: request.timeframe,
      mode: request.mode,
      decision: signal.signal,
      confidence: signal.confidence,
      risk_score: signal.risk_score,
      entry: frame.candle.close,
      stop_loss: signal.sl,
      take_profit: signal.tp,
      initialCapital: request.initialCapital,
      currentEquity: equity,
      riskPerTradePercent: request.riskPerTradePercent,
      spread: request.simulatedSpread,
      slippage: request.simulatedSlippage,
      volatility: signal.volatility.level,
      data_source: riskDataSourceFromBacktest(dataSource),
      trigger_module: "BACKTEST",
      intent: "BACKTEST",
      journaled: true,
      autoModeEnabled: false,
      openPositions: [],
      equityHistory: [{ timestamp: frame.timestamp, equity }],
      dataSufficient: true,
      marketState: signal.volatility.level === "EXTREME" ? "CHAOTIC" : "NORMAL",
    });

    if (riskGate.blocked) {
      noTrade.push({
        index: frame.index,
        timestamp: frame.timestamp,
        signal: "NO_TRADE",
        confidence: signal.confidence,
        reasons: riskGate.blocks.map(block => `${block.reason_code}: ${block.explanation}`),
      });
      journalEntries.push(
        journal(
          "NO_TRADE",
          `Risk/No-Trade gate blocked ${signal.signal} at ${frame.timestamp}: ${riskGate.explanation}`
        )
      );
      continue;
    }

    const simulated = simulateTrade(request, frame, signal, candles, equity);
    if (simulated.error) errors.push(simulated.error);
    if (!simulated.trade) continue;

    trades.push(simulated.trade);
    equity += simulated.trade.pnl;
    nextTradableIndex = simulated.exitIndex + 1;
    journalEntries.push(
      journal(
        "TRADE_SIMULATED",
        `${simulated.trade.direction} simulated from ${simulated.trade.entryTime} to ${simulated.trade.exitTime}.`
      )
    );
  }

  const report = generateReport({
    request,
    accepted: true,
    dataSource,
    dataSourceMessage,
    trades,
    kalosSignals: signals,
    noTrade,
    errors,
    journal: [
      ...journalEntries,
      journal("BACKTEST_COMPLETED", `Backtest completed with ${trades.length} simulated trades.`),
    ],
  });

  return {
    report,
    candles,
    replayFrames: frames,
  };
}
