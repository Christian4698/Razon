import type {
  AlertItem,
  BacktestSummary,
  ChartContextAction,
  ConnectorStatus,
  DemoModeConfig,
  DataMode,
  FuturePathEngine,
  FuturePathEngineState,
  KalosOverlayObject,
  KalosOverlayName,
  KalosMarketBrain,
  KalosMarketBrainScenario,
  KalosTrend,
  KalosSignal,
  JournalRow,
  MarketReplay,
  MarketReplayDirection,
  MarketReplayFrame,
  MarketReplayOutcome,
  MarketStatus,
  OhlcCandle,
  RiskStatus,
  SignalDecision,
  SyntheticIndexSymbol,
  WatchlistItem,
} from "./cockpit.types";

export const DEMO_MODE: DemoModeConfig = {
  enabled: true,
  name: "DEMO_MODE",
  dataSource: "SIMULATION",
  accountBalance: 10000,
  currency: "USD",
  tickMs: 2400,
  liveTradingEnabled: false,
};

export function dataModeLabels(mode: DataMode) {
  if (mode === "DEMO_DATA") return ["DEMO_DATA", "DEMO_MODE", "MOCK", "NO REAL IMPACT"] as const;
  return ["REAL_DATA", "BROKER/API DATA", "ANALYSE REELLE", "LIVE OFF = EXECUTION OFF"] as const;
}

export const kalosOverlayItems: readonly KalosOverlayName[] = [
  "BOS",
  "CHoCH",
  "Liquidity Sweep",
  "Strong High",
  "Weak Low",
  "Entry Zone",
  "TP",
  "SL",
  "Invalidation",
  "Trend Projection",
  "Buy/Sell Arrow",
  "Signal Ball",
];

export const syntheticIndexSymbols: readonly SyntheticIndexSymbol[] = [
  "Boom 500",
  "Boom 1000",
  "Crash 500",
  "Crash 1000",
  "Volatility 10",
  "Volatility 25",
  "Volatility 50",
  "Volatility 75",
  "Volatility 100",
];

export const syntheticIndexProviderSymbols: Readonly<Record<SyntheticIndexSymbol, string>> = {
  "Boom 500": "BOOM500",
  "Boom 1000": "BOOM1000",
  "Crash 500": "CRASH500",
  "Crash 1000": "CRASH1000",
  "Volatility 10": "R_10",
  "Volatility 25": "R_25",
  "Volatility 50": "R_50",
  "Volatility 75": "R_75",
  "Volatility 100": "R_100",
};

export const chartContextActions: readonly { id: ChartContextAction; label: string }[] = [
  { id: "refresh_data", label: "Refresh data" },
  { id: "recalculate_signal", label: "Recalculate signal" },
  { id: "toggle_kalos", label: "Show/hide Kalos" },
  { id: "toggle_overlays", label: "Show/hide overlays" },
  { id: "change_timeframe", label: "Change timeframe" },
  { id: "manual_mode", label: "Manual mode" },
  { id: "semi_auto_mode", label: "Semi-auto mode" },
  { id: "auto_mode", label: "Auto mode" },
];

interface SyntheticIndexProfile {
  readonly symbol: SyntheticIndexSymbol;
  readonly base: number;
  readonly spread: number;
  readonly volumeBase: number;
  readonly timeframe: string;
  readonly source: "DEMO" | "DEMO";
  readonly decision: SignalDecision;
  readonly confidence: number;
  readonly trend: KalosTrend;
  readonly volatility: KalosSignal["volatility"];
  readonly riskScore: number;
  readonly step: number;
  readonly bias: number;
}

const syntheticIndexProfiles: readonly SyntheticIndexProfile[] = [
  {
    symbol: "Boom 500",
    base: 5483.2,
    spread: 0.42,
    volumeBase: 4200,
    timeframe: "M5",
    source: "DEMO",
    decision: "BUY",
    confidence: 78,
    trend: "BULLISH",
    volatility: "NORMAL",
    riskScore: 42,
    step: 7.2,
    bias: 0.42,
  },
  {
    symbol: "Boom 1000",
    base: 11382.6,
    spread: 0.85,
    volumeBase: 6800,
    timeframe: "M5",
    source: "DEMO",
    decision: "BUY",
    confidence: 82,
    trend: "BULLISH",
    volatility: "HIGH",
    riskScore: 49,
    step: 14.4,
    bias: 0.56,
  },
  {
    symbol: "Crash 500",
    base: 7124.4,
    spread: 0.48,
    volumeBase: 3900,
    timeframe: "M5",
    source: "DEMO",
    decision: "SELL",
    confidence: 80,
    trend: "BEARISH",
    volatility: "NORMAL",
    riskScore: 44,
    step: 8.1,
    bias: -0.44,
  },
  {
    symbol: "Crash 1000",
    base: 10695.7,
    spread: 0.9,
    volumeBase: 6400,
    timeframe: "M5",
    source: "DEMO",
    decision: "SELL",
    confidence: 84,
    trend: "BEARISH",
    volatility: "HIGH",
    riskScore: 51,
    step: 13.7,
    bias: -0.58,
  },
  {
    symbol: "Volatility 10",
    base: 3842.5,
    spread: 0.19,
    volumeBase: 2600,
    timeframe: "M15",
    source: "DEMO",
    decision: "WAIT",
    confidence: 70,
    trend: "NEUTRAL",
    volatility: "LOW",
    riskScore: 38,
    step: 2.4,
    bias: 0.12,
  },
  {
    symbol: "Volatility 25",
    base: 4868.8,
    spread: 0.28,
    volumeBase: 3300,
    timeframe: "M15",
    source: "DEMO",
    decision: "WAIT",
    confidence: 74,
    trend: "NEUTRAL",
    volatility: "NORMAL",
    riskScore: 44,
    step: 5.2,
    bias: 0.18,
  },
  {
    symbol: "Volatility 50",
    base: 6125.9,
    spread: 0.38,
    volumeBase: 5100,
    timeframe: "M15",
    source: "DEMO",
    decision: "NO_TRADE",
    confidence: 66,
    trend: "NEUTRAL",
    volatility: "HIGH",
    riskScore: 67,
    step: 8.8,
    bias: 0.04,
  },
  {
    symbol: "Volatility 75",
    base: 8254.3,
    spread: 0.55,
    volumeBase: 5900,
    timeframe: "M5",
    source: "DEMO",
    decision: "BUY",
    confidence: 80,
    trend: "BULLISH",
    volatility: "HIGH",
    riskScore: 56,
    step: 12.6,
    bias: 0.32,
  },
  {
    symbol: "Volatility 100",
    base: 10318.1,
    spread: 0.74,
    volumeBase: 7200,
    timeframe: "M5",
    source: "DEMO",
    decision: "NO_TRADE",
    confidence: 63,
    trend: "NEUTRAL",
    volatility: "HIGH",
    riskScore: 72,
    step: 18.2,
    bias: -0.08,
  },
];

export const frappeDollarChecklist: readonly { label: string; status: "MOCK" | "BLOCKED" }[] = [
  { label: "Acceleration detection", status: "MOCK" },
  { label: "Continuation after BOS/CHoCH", status: "MOCK" },
  { label: "Visual signal", status: "MOCK" },
  { label: "Risk filter", status: "MOCK" },
  { label: "SL mandatory", status: "BLOCKED" },
];

function createMockOverlayObjects(
  decision: SignalDecision,
  tp: number,
  sl: number,
  invalidation: number
): readonly KalosOverlayObject[] {
  const status = decision === "BUY" || decision === "SELL" ? "ACCEPTED" : decision === "NO_TRADE" ? "REJECTED" : "NEUTRAL";
  const signalColor = status === "REJECTED" ? "#f4c86a" : decision === "SELL" ? "#ff7777" : "#63e6a6";

  return [
    {
      id: "mock-bos",
      type: "LABEL",
      label: "BOS",
      status,
      color: signalColor,
      reason: "Structure label prepared from mock candle context.",
    },
    {
      id: "mock-choch",
      type: "LABEL",
      label: "CHoCH",
      status,
      color: "#8ad7ff",
      reason: "Character-change label remains visual-only.",
    },
    {
      id: "mock-liquidity-sweep",
      type: "LEVEL",
      label: "Liquidity Sweep",
      status,
      color: "#f4c86a",
      reason: "Liquidity sweep marker prepared for chart overlay.",
    },
    {
      id: "mock-signal-ball",
      type: "SIGNAL_BALL",
      label: "Signal Ball",
      direction: decision === "SELL" ? "SELL" : "BUY",
      status,
      color: signalColor,
      reason: "KALOS signal ball marks analysis state only.",
    },
    {
      id: "mock-tp-zone",
      type: "ZONE",
      label: "TP",
      price: tp,
      status,
      color: "#63e6a6",
      reason: "TP zone is not an order.",
    },
    {
      id: "mock-sl-zone",
      type: "ZONE",
      label: "SL",
      price: sl,
      status,
      color: "#ff7777",
      reason: "SL zone is mandatory before any future execution path.",
    },
    {
      id: "mock-invalidation-zone",
      type: "ZONE",
      label: "Invalidation",
      price: invalidation,
      status,
      color: "#f4c86a",
      reason: "Invalidation zone blocks the setup when reached.",
    },
    {
      id: "mock-projection",
      type: "PROJECTION",
      label: "Trend Projection",
      toPrice: tp,
      status,
      color: signalColor,
      reason: "Projection is probabilistic, not a promise.",
    },
  ];
}

function createMockMarketBrain(
  decision: SignalDecision,
  confidence: number,
  trend: KalosTrend,
  invalidation: number,
  tp: number,
  riskScore: number
): KalosMarketBrain {
  const scenario: KalosMarketBrainScenario =
    decision === "NO_TRADE" ? "CANCEL" : decision === "WAIT" ? "WAIT" : confidence >= 80 ? "CONTINUE" : "WAIT";
  const intention =
    scenario === "CANCEL" ? "CONSOLIDATION" : scenario === "WAIT" ? "ACCUMULATION" : trend === "BEARISH" ? "DISTRIBUTION" : "EXPANSION";
  const signal = scenario === "CANCEL" ? "NO_TRADE" : scenario === "WAIT" ? "WAIT" : decision;

  return {
    module: "kalos-market-brain",
    signal,
    confidence,
    scenario,
    explanation: `Hypothese ${scenario} avec probabilite surveillee et confiance ${confidence}%. Analyse visuelle uniquement.`,
    invalidation,
    expectedPath:
      scenario === "CONTINUE"
        ? [
            { step: "RETEST", hypothesis: "Hypothese: retest controle avant continuation.", probability: Math.max(confidence - 6, 0) },
            { step: "EXPANSION", hypothesis: "Probabilite de continuation sous controle du risque.", probability: Math.max(confidence - 14, 0), price: tp },
          ]
        : scenario === "CANCEL"
          ? [{ step: "INVALIDATION", hypothesis: "Hypothese annulee; marche a relire.", probability: confidence, price: invalidation }]
          : [{ step: "WAIT_CONFIRMATION", hypothesis: "Hypothese en attente; confirmation requise.", probability: confidence }],
    timingScore: scenario === "CONTINUE" ? 78 : scenario === "WAIT" ? 54 : 28,
    riskScore,
    structure: trend,
    intention,
    rejectedReasons:
      scenario === "CANCEL"
        ? ["Marche illisible ou contexte de risque trop eleve."]
        : scenario === "WAIT"
          ? ["Confiance insuffisante pour accepter un signal directionnel."]
          : [],
    liveExecutionAllowed: false,
  };
}

function createMockFuturePath(
  decision: SignalDecision,
  confidence: number,
  target: number,
  invalidation: number,
  conflict = false
): FuturePathEngine {
  const state: FuturePathEngineState =
    decision === "NO_TRADE" ? "DATA_LOW" : conflict ? "INCERTAIN" : confidence < 70 ? "WAIT" : "READY";
  const probabilities = state === "READY" ? [72, 21, 7] : state === "INCERTAIN" ? [45, 39, 16] : state === "DATA_LOW" ? [34, 33, 33] : [66, 24, 10];
  const estimatedTime = state === "READY" ? "5-8 candles" : state === "WAIT" ? "wait for confirmation" : state === "DATA_LOW" ? "pending fresh data" : "conflict review";

  return {
    module: "future-path-engine",
    state,
    paths: [
      {
        id: "A",
        label: "Path A",
        role: "MAIN",
        color: "GREEN",
        probability: probabilities[0],
        estimatedTime,
        objective: state === "READY" ? "Scenario principal probable." : state,
        target,
        invalidation,
        displayState: state,
      },
      {
        id: "B",
        label: "Path B",
        role: "ALTERNATIVE",
        color: "BLUE",
        probability: probabilities[1],
        estimatedTime,
        objective: "Scenario alternatif a surveiller.",
        target,
        invalidation,
        displayState: state,
      },
      {
        id: "C",
        label: "Path C",
        role: "CANCELLED",
        color: "GREY",
        probability: probabilities[2],
        estimatedTime: "invalidated if level breaks",
        objective: "Scenario annule si invalidation touchee.",
        target: null,
        invalidation,
        displayState: state,
      },
    ],
    summary:
      state === "READY"
        ? "Chemins probables visuels, sans certitude ni execution."
        : `${state}: timeline defensive active.`,
    confidence: Math.min(confidence, 95),
    liveExecutionAllowed: false,
  };
}

function expectedReplayDirection(decision: SignalDecision): MarketReplayDirection {
  if (decision === "BUY") return "UP";
  if (decision === "SELL") return "DOWN";
  return "FLAT";
}

function replayOutcome(expected: MarketReplayDirection, actual: MarketReplayDirection): MarketReplayOutcome {
  if (expected === "FLAT") return actual === "FLAT" ? "WIN_SIMULATION" : "NO_TRADE_SIMULATION";
  return expected === actual ? "WIN_SIMULATION" : "LOSS_SIMULATION";
}

function createMockMarketReplay(
  symbol: string,
  timeframe: string,
  decision: SignalDecision,
  confidence: number,
  trend: KalosTrend,
  volatility: KalosSignal["volatility"],
  basePrice: number,
  reasons: readonly string[]
): MarketReplay {
  const expected = expectedReplayDirection(decision);
  const decimals = basePrice > 100 ? 2 : 5;
  const step = basePrice > 100 ? 0.72 : 0.00042;
  const frames: MarketReplayFrame[] = Array.from({ length: 6 }, (_, index) => {
    const seenPrice = Number((basePrice + (index - 2) * step * 0.55).toFixed(decimals));
    const actualBias = index % 4 === 1 ? -1 : expected === "DOWN" ? -1 : expected === "FLAT" ? 0 : 1;
    const closePrice = Number((seenPrice + actualBias * step * (0.7 + index * 0.05)).toFixed(decimals));
    const movement = Number((closePrice - seenPrice).toFixed(decimals));
    const actualDirection: MarketReplayDirection = movement > 0 ? "UP" : movement < 0 ? "DOWN" : "FLAT";
    const outcome = replayOutcome(expected, actualDirection);

    return {
      index,
      timestamp: `Replay ${index + 1}`,
      prediction: {
        signal: decision,
        confidence,
        seenPrice,
        seenTrend: trend,
        seenVolatility: volatility,
        kalosSaw: [`Trend ${trend}`, `Volatility ${volatility}`, ...reasons.slice(0, 2)],
      },
      actualResult: {
        closePrice,
        movement,
        direction: actualDirection,
        outcome,
      },
      difference: {
        expectedDirection: expected,
        actualDirection,
        matched: outcome === "WIN_SIMULATION",
        priceDelta: movement,
        note: outcome === "WIN_SIMULATION" ? "Prediction aligned in replay." : "Difference visible in replay.",
      },
    };
  });
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  const winSimulation = frames.filter(frame => frame.actualResult.outcome === "WIN_SIMULATION").length;
  const lossSimulation = frames.filter(frame => frame.actualResult.outcome === "LOSS_SIMULATION").length;

  frames.forEach(frame => {
    if (frame.actualResult.outcome === "WIN_SIMULATION") equity += 1;
    if (frame.actualResult.outcome === "LOSS_SIMULATION") equity -= 1;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
  });

  return {
    module: "market-replay",
    symbol,
    timeframe,
    controls: ["PLAY", "REWIND", "FAST_FORWARD", "PAUSE"],
    frames,
    metrics: {
      winSimulation,
      lossSimulation,
      drawdown,
      precision: winSimulation + lossSimulation === 0 ? 0 : Math.round((winSimulation / (winSimulation + lossSimulation)) * 100),
    },
    liveExecutionAllowed: false,
  };
}

const signalScenarios: readonly KalosSignal[] = [
  {
    symbol: "XAUUSD",
    decision: "BUY",
    confidence: 84,
    tp: 2338.8,
    sl: 2322.2,
    invalidation: 2320.9,
    reasons: [
      "HTF trend remains bullish above structure support.",
      "Liquidity sweep detected below the previous M15 low.",
      "Entry score validated after momentum recovery.",
    ],
    rejectedReasons: [
      "Confidence below 95 percent cap, no guaranteed outcome.",
      "News shield future module not active yet.",
    ],
    timeframe: "M15",
    trend: "BULLISH",
    volatility: "NORMAL",
    riskScore: 31,
    overlayObjects: createMockOverlayObjects("BUY", 2338.8, 2322.2, 2320.9),
    marketBrain: createMockMarketBrain("BUY", 84, "BULLISH", 2320.9, 2338.8, 31),
    futurePath: createMockFuturePath("BUY", 84, 2338.8, 2320.9),
    marketReplay: createMockMarketReplay("XAUUSD", "M15", "BUY", 84, "BULLISH", "NORMAL", 2328.2, [
      "Liquidity sweep detected below the previous M15 low.",
      "Entry score validated after momentum recovery.",
    ]),
    htf: "Bullish",
    mtf: "Pullback complete",
    ltf: "Entry window open",
  },
  {
    symbol: "EURUSD",
    decision: "NO_TRADE",
    confidence: 66,
    tp: 1.0884,
    sl: 1.0831,
    invalidation: 1.0824,
    reasons: [
      "Risk Engine detects weak RR after spread adjustment.",
      "Momentum is mixed across MTF and LTF.",
      "NO_TRADE is valid while data quality is degraded.",
    ],
    rejectedReasons: [
      "Confidence below execution threshold.",
      "Spread state is not ideal for SCALPING.",
    ],
    timeframe: "M5",
    trend: "NEUTRAL",
    volatility: "HIGH",
    riskScore: 74,
    overlayObjects: createMockOverlayObjects("NO_TRADE", 1.0884, 1.0831, 1.0824),
    marketBrain: createMockMarketBrain("NO_TRADE", 66, "NEUTRAL", 1.0824, 1.0884, 74),
    futurePath: createMockFuturePath("NO_TRADE", 66, 1.0884, 1.0824),
    marketReplay: createMockMarketReplay("EURUSD", "M5", "NO_TRADE", 66, "NEUTRAL", "HIGH", 1.085, [
      "Risk Engine detects weak RR after spread adjustment.",
      "Momentum is mixed across MTF and LTF.",
    ]),
    htf: "Range",
    mtf: "No alignment",
    ltf: "Choppy",
  },
  {
    symbol: "GBPUSD",
    decision: "WAIT",
    confidence: 77,
    tp: 1.2792,
    sl: 1.2708,
    invalidation: 1.2699,
    reasons: [
      "HTF structure is constructive but entry is not confirmed.",
      "Liquidity zone is nearby; wait for clean retest.",
      "Journal records WAIT as a valid decision.",
    ],
    rejectedReasons: [
      "Entry score below directional threshold.",
      "Manual confirmation would still be required.",
    ],
    timeframe: "H1",
    trend: "BULLISH",
    volatility: "NORMAL",
    riskScore: 45,
    overlayObjects: createMockOverlayObjects("WAIT", 1.2792, 1.2708, 1.2699),
    marketBrain: createMockMarketBrain("WAIT", 77, "BULLISH", 1.2699, 1.2792, 45),
    futurePath: createMockFuturePath("WAIT", 77, 1.2792, 1.2699, true),
    marketReplay: createMockMarketReplay("GBPUSD", "H1", "WAIT", 77, "BULLISH", "NORMAL", 1.274, [
      "Liquidity zone is nearby; wait for clean retest.",
      "Journal records WAIT as a valid decision.",
    ]),
    htf: "Bullish",
    mtf: "Retest pending",
    ltf: "Waiting",
  },
  {
    symbol: "USDJPY",
    decision: "SELL",
    confidence: 82,
    tp: 155.92,
    sl: 157.11,
    invalidation: 157.28,
    reasons: [
      "Lower highs confirmed in MTF structure.",
      "Momentum favors downside continuation.",
      "Risk remains acceptable in simulation only.",
    ],
    rejectedReasons: [
      "LIVE trading disabled.",
      "Connector execution remains blocked.",
    ],
    timeframe: "M15",
    trend: "BEARISH",
    volatility: "NORMAL",
    riskScore: 37,
    overlayObjects: createMockOverlayObjects("SELL", 155.92, 157.11, 157.28),
    marketBrain: createMockMarketBrain("SELL", 82, "BEARISH", 157.28, 155.92, 37),
    futurePath: createMockFuturePath("SELL", 82, 155.92, 157.28),
    marketReplay: createMockMarketReplay("USDJPY", "M15", "SELL", 82, "BEARISH", "NORMAL", 156.7, [
      "Lower highs confirmed in MTF structure.",
      "Momentum favors downside continuation.",
    ]),
    htf: "Bearish",
    mtf: "Breakdown",
    ltf: "Retest complete",
  },
];

function scenarioForTick(tick: number) {
  return signalScenarios[Math.floor(tick / 3) % signalScenarios.length];
}

function priceWave(tick: number, index: number) {
  return Math.sin((tick + index) * 0.52) * 1.35 + Math.cos((tick + index) * 0.23) * 0.65;
}

function createDemoCandles(tick: number, signal: KalosSignal): readonly OhlcCandle[] {
  const base = signal.symbol === "XAUUSD" ? 2328.2 : signal.symbol === "USDJPY" ? 156.7 : signal.symbol === "GBPUSD" ? 1.274 : 1.085;
  const decimals = base > 100 ? 2 : 5;
  const step = base > 100 ? 0.72 : 0.00042;

  return Array.from({ length: 18 }, (_, index) => {
    const wave = priceWave(tick, index);
    const open = base + wave * step + (index - 8) * step * 0.18;
    const close = open + Math.sin((tick + index) * 0.77) * step * 0.8;
    const high = Math.max(open, close) + step * (0.7 + (index % 3) * 0.15);
    const low = Math.min(open, close) - step * (0.68 + (index % 2) * 0.14);
    const volume = Math.round(900 + Math.abs(Math.sin((tick + index) * 0.41)) * 1500 + index * 36);

    return {
      timestamp: `${String(9 + Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`,
      open: Number(open.toFixed(decimals)),
      high: Number(high.toFixed(decimals)),
      low: Number(low.toFixed(decimals)),
      close: Number(close.toFixed(decimals)),
      volume,
    };
  });
}

function createDemoMarket(tick: number, signal: KalosSignal, nextCandles: readonly OhlcCandle[]): MarketStatus {
  const lastCandle = nextCandles.at(-1);

  return {
    symbol: signal.symbol,
    timeframe: signal.timeframe,
    runtimeMode: tick % 5 === 0 ? "DEMO" : "MOCK",
    price: lastCandle?.close ?? 0,
    spread: signal.symbol === "XAUUSD" ? 0.18 : signal.symbol === "USDJPY" ? 0.012 : 0.00018,
    volume: lastCandle?.volume ?? 0,
    source: tick % 5 === 0 ? "DEMO" : "MOCK",
    session: "Demo simulation feed",
  };
}

function createDemoRisk(signal: KalosSignal): RiskStatus {
  return {
    score: signal.riskScore,
    rr: signal.decision === "NO_TRADE" ? 1.42 : signal.decision === "WAIT" ? 1.88 : 2.35,
    riskPerTrade: 1,
    dailyDrawdown: signal.decision === "NO_TRADE" ? 1.8 : 0.4,
    weeklyDrawdown: signal.decision === "NO_TRADE" ? 2.8 : 1.1,
    totalDrawdown: signal.decision === "NO_TRADE" ? 4.2 : 2.6,
    spreadOk: signal.decision !== "NO_TRADE",
    slPresent: true,
    tpPresent: true,
    journalReady: true,
    liveEnabled: false,
  };
}

function syntheticProfileFor(symbol: SyntheticIndexSymbol) {
  return syntheticIndexProfiles.find(profile => profile.symbol === symbol) ?? syntheticIndexProfiles[0];
}

function createSyntheticCandles(tick: number, profile: SyntheticIndexProfile): readonly OhlcCandle[] {
  const symbolIndex = syntheticIndexSymbols.indexOf(profile.symbol) + 1;
  const decimals = profile.base >= 1000 ? 2 : 4;

  return Array.from({ length: 20 }, (_, index) => {
    const cycle = tick * (0.22 + symbolIndex * 0.015) + index;
    const trend = (index - 9.5) * profile.step * profile.bias;
    const wave =
      Math.sin(cycle * 0.53) * profile.step * (0.95 + symbolIndex * 0.025) +
      Math.cos((tick + index * symbolIndex) * 0.19) * profile.step * 0.46;
    const open = profile.base + trend + wave;
    const close = open + (Math.sin(cycle * 0.84) + profile.bias * 0.36) * profile.step * 0.48;
    const high = Math.max(open, close) + profile.step * (0.72 + (index % 3) * 0.16);
    const low = Math.min(open, close) - profile.step * (0.7 + (index % 2) * 0.18);
    const volume = Math.round(
      profile.volumeBase +
        Math.abs(Math.sin((tick + index + symbolIndex) * 0.37)) * profile.volumeBase * 0.42 +
        index * 54
    );

    return {
      timestamp: `${String(9 + Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`,
      open: Number(open.toFixed(decimals)),
      high: Number(high.toFixed(decimals)),
      low: Number(low.toFixed(decimals)),
      close: Number(close.toFixed(decimals)),
      volume,
    };
  });
}

function createSyntheticSignal(profile: SyntheticIndexProfile, candles: readonly OhlcCandle[]): KalosSignal {
  const lastPrice = candles.at(-1)?.close ?? profile.base;
  const direction = profile.decision === "SELL" ? -1 : 1;
  const volatilityMultiplier = profile.volatility === "HIGH" ? 8.5 : profile.volatility === "NORMAL" ? 6.4 : 4.6;
  const targetDistance = profile.step * volatilityMultiplier;
  const stopDistance = targetDistance * 0.56;
  const tp = profile.decision === "NO_TRADE" ? lastPrice + profile.step * 2.2 : lastPrice + targetDistance * direction;
  const sl = profile.decision === "SELL" ? lastPrice + stopDistance : lastPrice - stopDistance;
  const invalidation = profile.decision === "SELL" ? sl + profile.step * 1.35 : sl - profile.step * 1.35;
  const roundedTp = Number(tp.toFixed(2));
  const roundedSl = Number(sl.toFixed(2));
  const roundedInvalidation = Number(invalidation.toFixed(2));

  const reasons = [
    `${profile.symbol} Deriv synthetic index selectionne en lecture seule.`,
    `${profile.source} feed visible pour analyse KALOS, sans execution.`,
    `Volatilite ${profile.volatility} et structure ${profile.trend} integrees au scenario.`,
  ];
  const rejectedReasons = [
    "LIVE OFF bloque toute execution reelle.",
    "AUTO EXECUTION OFF: aucun ordre Deriv n'est route.",
  ];

  return {
    symbol: profile.symbol,
    decision: profile.decision,
    confidence: profile.confidence,
    tp: roundedTp,
    sl: roundedSl,
    invalidation: roundedInvalidation,
    reasons,
    rejectedReasons,
    timeframe: profile.timeframe,
    trend: profile.trend,
    volatility: profile.volatility,
    riskScore: profile.riskScore,
    overlayObjects: createMockOverlayObjects(profile.decision, roundedTp, roundedSl, roundedInvalidation),
    marketBrain: createMockMarketBrain(profile.decision, profile.confidence, profile.trend, roundedInvalidation, roundedTp, profile.riskScore),
    futurePath: createMockFuturePath(profile.decision, profile.confidence, roundedTp, roundedInvalidation, profile.riskScore > 55),
    marketReplay: createMockMarketReplay(
      profile.symbol,
      profile.timeframe,
      profile.decision,
      profile.confidence,
      profile.trend,
      profile.volatility,
      lastPrice,
      reasons
    ),
    htf: profile.trend === "BULLISH" ? "Bullish" : profile.trend === "BEARISH" ? "Bearish" : "Range",
    mtf: profile.decision === "WAIT" ? "Retest pending" : profile.decision === "NO_TRADE" ? "No alignment" : "Structure active",
    ltf: profile.decision === "NO_TRADE" ? "Blocked" : profile.decision === "WAIT" ? "Waiting" : "Entry watch",
  };
}

function createSyntheticWatchlist(
  selectedSymbol: SyntheticIndexSymbol,
  tick: number,
  dataMode: DataMode
): readonly WatchlistItem[] {
  return syntheticIndexProfiles.map((profile, index) => {
    const sourceMode = dataMode === "REAL_DATA" ? "DEMO" : profile.source;
    const selectedBias = profile.symbol === selectedSymbol ? 0.38 : 0;
    const price = profile.base + Math.sin((tick + index) * 0.41) * profile.step * (2.2 + selectedBias);
    const change = Number((profile.bias * 0.62 + Math.cos((tick + index) * 0.28) * 0.18).toFixed(2));

    return {
      symbol: profile.symbol,
      price: Number(price.toFixed(2)),
      change,
      signal: profile.decision,
      spread: profile.spread,
      runtimeMode: sourceMode,
      confidence: profile.confidence,
      probability: profile.confidence,
      riskScore: profile.riskScore,
      dataQuality: "HEALTHY",
      sourceLabel: "DEMO",
    };
  });
}

export function createSyntheticIndexSnapshot(
  selectedSymbol: SyntheticIndexSymbol,
  tick: number,
  dataMode: DataMode
) {
  const profile = syntheticProfileFor(selectedSymbol);
  const nextCandles = createSyntheticCandles(tick, profile);
  const signal = createSyntheticSignal(profile, nextCandles);
  const lastCandle = nextCandles.at(-1);
  const sourceMode = dataMode === "REAL_DATA" ? "DEMO" : profile.source;
  const market: MarketStatus = {
    symbol: profile.symbol,
    timeframe: profile.timeframe,
    runtimeMode: sourceMode,
    price: lastCandle?.close ?? profile.base,
    spread: profile.spread,
    volume: lastCandle?.volume ?? profile.volumeBase,
    source: sourceMode,
    session: "Deriv Synthetic read-only",
  };

  return {
    market,
    signal,
    risk: createDemoRisk(signal),
    candles: nextCandles,
    watchlist: createSyntheticWatchlist(selectedSymbol, tick, dataMode),
  };
}

function createDemoWatchlist(signal: KalosSignal, market: MarketStatus): readonly WatchlistItem[] {
  return [
    {
      symbol: market.symbol,
      price: market.price,
      change: signal.decision === "SELL" ? -0.28 : 0.42,
      signal: signal.decision,
      spread: market.spread,
      runtimeMode: market.runtimeMode,
      confidence: signal.confidence,
      probability: signal.futurePath.confidence,
      riskScore: signal.riskScore,
      dataQuality: signal.dataQuality ?? market.dataQuality ?? "DEGRADED",
      sourceLabel: market.source === "MOCK" ? "MOCK_DATA" : market.source,
    },
    { symbol: "EURUSD", price: 1.0852, change: -0.08, signal: "NO_TRADE", spread: 0.00015, runtimeMode: "MOCK", confidence: 66, probability: 66, riskScore: 74, dataQuality: "DEGRADED", sourceLabel: "MOCK_DATA" },
    { symbol: "GBPUSD", price: 1.2741, change: 0.16, signal: "WAIT", spread: 0.0002, runtimeMode: "DEMO", confidence: 77, probability: 77, riskScore: 45, dataQuality: "HEALTHY", sourceLabel: "DEMO" },
    { symbol: "USDJPY", price: 156.73, change: -0.22, signal: "SELL", spread: 0.012, runtimeMode: "MOCK", confidence: 82, probability: 82, riskScore: 37, dataQuality: "DEGRADED", sourceLabel: "MOCK_DATA" },
    { symbol: "XAUUSD", price: 2328.42, change: 0.42, signal: "BUY", spread: 0.18, runtimeMode: "MOCK", confidence: 84, probability: 84, riskScore: 31, dataQuality: "DEGRADED", sourceLabel: "MOCK_DATA" },
  ];
}

export function createDemoSnapshot(tick: number) {
  const signal = scenarioForTick(tick);
  const nextCandles = createDemoCandles(tick, signal);
  const market = createDemoMarket(tick, signal, nextCandles);

  return {
    market,
    signal,
    risk: createDemoRisk(signal),
    candles: nextCandles,
    watchlist: createDemoWatchlist(signal, market),
  };
}

export const marketStatus: MarketStatus = {
  symbol: "XAUUSD",
  timeframe: "M15",
  runtimeMode: "MOCK",
  price: 2328.42,
  spread: 0.18,
  volume: 128400,
  source: "DEMO",
  session: "London/New York overlap",
};

export const kalosSignal: KalosSignal = signalScenarios[0];

export const riskStatus: RiskStatus = {
  score: 31,
  rr: 2.35,
  riskPerTrade: 1,
  dailyDrawdown: 0.4,
  weeklyDrawdown: 1.1,
  totalDrawdown: 2.6,
  spreadOk: true,
  slPresent: true,
  tpPresent: true,
  journalReady: true,
  liveEnabled: false,
};

export const connectors: readonly ConnectorStatus[] = [
  {
    id: "deriv-demo",
    name: "Deriv Demo",
    provider: "Deriv",
    accountKind: "DEMO",
    ownerScope: "CURRENT_USER",
    licenseStatus: "ACTIVE",
    connectorStatus: "DISCONNECTED",
    runtimeMode: "MOCK",
    state: "disconnected",
    safetyStatus: "DISCONNECTED",
    executionStatus: "LIVE_BLOCKED",
    accessMode: "DEMO",
    dataQuality: "DISCONNECTED",
    latencyMs: null,
    source: "DEMO",
    message: "Awaiting current-user Deriv Demo read-only health.",
    secretLocation: "BACKEND_ONLY",
    secretStatus: "MISSING",
    secretSaved: false,
    readOnly: true,
    readOnlyStatus: "READ_ONLY",
    liveBlocked: true,
    liveTradingAllowed: false,
    orderPlacementAllowed: false,
    tokenVisible: false,
    warnings: ["MOCK_DATA", "DISCONNECTED", "TOKEN MISSING"],
    readonlyByDefault: true,
  },
  {
    id: "deriv-real",
    name: "Deriv Real",
    provider: "Deriv",
    accountKind: "REAL",
    ownerScope: "CURRENT_USER",
    licenseStatus: "ACTIVE",
    connectorStatus: "DISCONNECTED",
    runtimeMode: "REAL_DATA",
    state: "disconnected",
    safetyStatus: "DISCONNECTED",
    executionStatus: "LIVE_BLOCKED",
    accessMode: "REAL",
    dataQuality: "DISCONNECTED",
    latencyMs: null,
    source: "LIVE",
    message: "Deriv Real is current-user scoped and read-only. Execution remains OFF.",
    secretLocation: "BACKEND_ONLY",
    secretStatus: "MISSING",
    secretSaved: false,
    readOnly: true,
    readOnlyStatus: "READ_ONLY",
    liveBlocked: true,
    liveTradingAllowed: false,
    orderPlacementAllowed: false,
    tokenVisible: false,
    warnings: ["REAL DATA BUT EXECUTION OFF", "DISCONNECTED", "TOKEN MISSING"],
    readonlyByDefault: true,
  },
  {
    id: "mt5-demo",
    name: "MT5 Demo",
    provider: "MT5",
    accountKind: "DEMO",
    ownerScope: "CURRENT_USER",
    licenseStatus: "ACTIVE",
    connectorStatus: "DISCONNECTED",
    runtimeMode: "MOCK",
    state: "disconnected",
    safetyStatus: "DISCONNECTED",
    executionStatus: "LIVE_BLOCKED",
    accessMode: "DEMO",
    dataQuality: "DISCONNECTED",
    latencyMs: null,
    source: "DEMO",
    message: "MT5 Demo personal bridge pending; read-only future bridge.",
    secretLocation: "BACKEND_ONLY",
    secretStatus: "MISSING",
    secretSaved: false,
    readOnly: true,
    readOnlyStatus: "READ_ONLY",
    liveBlocked: true,
    liveTradingAllowed: false,
    orderPlacementAllowed: false,
    tokenVisible: false,
    warnings: ["MOCK_DATA", "DISCONNECTED", "TOKEN MISSING"],
    readonlyByDefault: true,
  },
  {
    id: "mt5-real",
    name: "MT5 Real",
    provider: "MT5",
    accountKind: "REAL",
    ownerScope: "CURRENT_USER",
    licenseStatus: "ACTIVE",
    connectorStatus: "DISCONNECTED",
    runtimeMode: "REAL_DATA",
    state: "disconnected",
    safetyStatus: "DISCONNECTED",
    executionStatus: "LIVE_BLOCKED",
    accessMode: "REAL",
    dataQuality: "DISCONNECTED",
    latencyMs: null,
    source: "LIVE",
    message: "MT5 Real personal bridge requires backend-only secrets; no order route exposed.",
    secretLocation: "BACKEND_ONLY",
    secretStatus: "MISSING",
    secretSaved: false,
    readOnly: true,
    readOnlyStatus: "READ_ONLY",
    liveBlocked: true,
    liveTradingAllowed: false,
    orderPlacementAllowed: false,
    tokenVisible: false,
    warnings: ["REAL DATA BUT EXECUTION OFF", "DISCONNECTED", "TOKEN MISSING"],
    readonlyByDefault: true,
  },
  {
    id: "forex-api",
    name: "Forex API",
    provider: "Forex",
    accountKind: "API",
    ownerScope: "CURRENT_USER",
    licenseStatus: "ACTIVE",
    connectorStatus: "DISCONNECTED",
    runtimeMode: "MOCK",
    state: "disconnected",
    safetyStatus: "DISCONNECTED",
    executionStatus: "LIVE_BLOCKED",
    accessMode: "DEMO",
    dataQuality: "DISCONNECTED",
    latencyMs: null,
    source: "DEMO",
    message: "Forex API personal secret storage is ready; provider runtime pending.",
    secretLocation: "BACKEND_ONLY",
    secretStatus: "MISSING",
    secretSaved: false,
    readOnly: true,
    readOnlyStatus: "READ_ONLY",
    liveBlocked: true,
    liveTradingAllowed: false,
    orderPlacementAllowed: false,
    tokenVisible: false,
    warnings: ["MOCK_DATA", "DISCONNECTED", "TOKEN MISSING"],
    readonlyByDefault: true,
  },
  {
    id: "future-providers",
    name: "Future Providers",
    provider: "Future Providers",
    accountKind: "FUTURE",
    ownerScope: "CURRENT_USER",
    licenseStatus: "ACTIVE",
    connectorStatus: "DISCONNECTED",
    runtimeMode: "MOCK",
    state: "disconnected",
    safetyStatus: "DISCONNECTED",
    executionStatus: "LIVE_BLOCKED",
    accessMode: "DEMO",
    dataQuality: "DISCONNECTED",
    latencyMs: null,
    source: "DEMO",
    message: "Future provider slots are personal and backend-only.",
    secretLocation: "BACKEND_ONLY",
    secretStatus: "MISSING",
    secretSaved: false,
    readOnly: true,
    readOnlyStatus: "READ_ONLY",
    liveBlocked: true,
    liveTradingAllowed: false,
    orderPlacementAllowed: false,
    tokenVisible: false,
    warnings: ["MOCK_DATA", "DISCONNECTED", "TOKEN MISSING"],
    readonlyByDefault: true,
  },
];

export const journalRows: readonly JournalRow[] = [
  {
    id: "JRN-DEMO-1047",
    timestamp: "2026-06-05T09:16:00.000Z",
    symbol: "XAUUSD",
    timeframe: "M15",
    mode: "SHORT_TERM",
    decision: "BUY",
    confidence: 84,
    riskScore: 31,
    source: "DEMO",
    module: "KALOS",
    result: "Demo signal accepted for analysis only",
  },
  {
    id: "JRN-DEMO-1046",
    timestamp: "2026-06-05T09:02:00.000Z",
    symbol: "EURUSD",
    timeframe: "M5",
    mode: "SCALPING",
    decision: "NO_TRADE",
    confidence: 66,
    riskScore: 74,
    source: "DEMO",
    module: "KALOS",
    result: "Blocked by Risk + No-Trade",
  },
  {
    id: "JRN-DEMO-1045",
    timestamp: "2026-06-05T08:44:00.000Z",
    symbol: "GBPUSD",
    timeframe: "H1",
    mode: "LONG_TERM",
    decision: "WAIT",
    confidence: 77,
    riskScore: 45,
    source: "DEMO",
    module: "BACKTEST",
    result: "Waiting for clean retest",
  },
  {
    id: "JRN-DEMO-1044",
    timestamp: "2026-06-05T08:26:00.000Z",
    symbol: "USDJPY",
    timeframe: "M15",
    mode: "SHORT_TERM",
    decision: "SELL",
    confidence: 82,
    riskScore: 37,
    source: "DEMO",
    module: "MANUAL",
    result: "Manual simulation recorded",
  },
  {
    id: "JRN-1042",
    timestamp: "2026-06-04T13:48:00.000Z",
    symbol: "XAUUSD",
    timeframe: "M15",
    mode: "SHORT_TERM",
    decision: "BUY",
    confidence: 84,
    riskScore: 31,
    source: "DEMO",
    module: "KALOS",
    result: "Accepted for simulation",
  },
  {
    id: "JRN-1041",
    timestamp: "2026-06-04T13:32:00.000Z",
    symbol: "EURUSD",
    timeframe: "M5",
    mode: "SCALPING",
    decision: "NO_TRADE",
    confidence: 63,
    riskScore: 72,
    source: "DEMO",
    module: "KALOS",
    result: "Blocked by confidence",
  },
  {
    id: "JRN-1040",
    timestamp: "2026-06-04T13:10:00.000Z",
    symbol: "GBPUSD",
    timeframe: "H1",
    mode: "LONG_TERM",
    decision: "WAIT",
    confidence: 77,
    riskScore: 45,
    source: "DEMO",
    module: "BACKTEST",
    result: "Waiting for structure confirmation",
  },
  {
    id: "JRN-1039",
    timestamp: "2026-06-04T12:44:00.000Z",
    symbol: "USDJPY",
    timeframe: "M15",
    mode: "SHORT_TERM",
    decision: "SELL",
    confidence: 81,
    riskScore: 38,
    source: "DEMO",
    module: "MANUAL",
    result: "Manual simulation only",
  },
];

export const backtestExamples: readonly BacktestSummary[] = [
  {
    id: "BT-DEMO-001",
    symbol: "XAUUSD",
    timeframe: "M15",
    mode: "SHORT_TERM",
    strategy: "KALOS",
    dataSource: "DEMO",
    period: "2026-05-01 -> 2026-05-31",
    totalTrades: 42,
    winRate: 57.1,
    profitFactor: 1.42,
    maxDrawdown: 4.8,
    netProfit: 368.5,
    noTradeCount: 119,
    recommendation: "Keep RR filter and review high-volatility windows.",
  },
  {
    id: "BT-DEMO-002",
    symbol: "EURUSD",
    timeframe: "M5",
    mode: "SCALPING",
    strategy: "KALOS",
    dataSource: "DEMO",
    period: "2026-05-15 -> 2026-05-31",
    totalTrades: 31,
    winRate: 48.4,
    profitFactor: 0.96,
    maxDrawdown: 6.2,
    netProfit: -42.7,
    noTradeCount: 168,
    recommendation: "Do not demo as executable; show NO_TRADE filter behavior.",
  },
  {
    id: "BT-DEMO-003",
    symbol: "GBPUSD",
    timeframe: "H1",
    mode: "LONG_TERM",
    strategy: "KALOS",
    dataSource: "DEMO",
    period: "2026-04-01 -> 2026-05-31",
    totalTrades: 18,
    winRate: 61.1,
    profitFactor: 1.68,
    maxDrawdown: 3.9,
    netProfit: 512.4,
    noTradeCount: 74,
    recommendation: "Stable for explanation demo; not production proof.",
  },
];

export const watchlist: readonly WatchlistItem[] = [
  { symbol: "XAUUSD", price: 2328.42, change: 0.42, signal: "BUY", spread: 0.18, runtimeMode: "MOCK", confidence: 84, probability: 84, riskScore: 31, dataQuality: "DEGRADED", sourceLabel: "MOCK_DATA" },
  { symbol: "EURUSD", price: 1.0852, change: -0.08, signal: "NO_TRADE", spread: 0.00015, runtimeMode: "MOCK", confidence: 66, probability: 66, riskScore: 74, dataQuality: "DEGRADED", sourceLabel: "MOCK_DATA" },
  { symbol: "GBPUSD", price: 1.2741, change: 0.16, signal: "WAIT", spread: 0.0002, runtimeMode: "DEMO", confidence: 77, probability: 77, riskScore: 45, dataQuality: "HEALTHY", sourceLabel: "DEMO" },
  { symbol: "USDJPY", price: 156.73, change: -0.22, signal: "SELL", spread: 0.012, runtimeMode: "MOCK", confidence: 82, probability: 82, riskScore: 37, dataQuality: "DEGRADED", sourceLabel: "MOCK_DATA" },
  { symbol: "BTCUSD", price: 68240, change: 1.1, signal: "WAIT", spread: 12.4, runtimeMode: "MOCK", confidence: null, probability: null, riskScore: null, dataQuality: null, sourceLabel: "MOCK_DATA" },
];

export const alerts: readonly AlertItem[] = [
  {
    id: "ALT-1",
    severity: "CRITICAL",
    title: "DEMO_MODE active",
    detail: "ENABLE_LIVE_TRADING is false",
    time: "13:49",
  },
  {
    id: "ALT-2",
    severity: "WARNING",
    title: "Forex data delayed",
    detail: "MODE_SIMULATION fallback active",
    time: "13:45",
  },
  {
    id: "ALT-3",
    severity: "INFO",
    title: "Journal ready",
    detail: "NO_TRADE decisions are stored",
    time: "13:40",
  },
];

export const candles: readonly OhlcCandle[] = [
  { timestamp: "13:00", open: 2323.8, high: 2325.4, low: 2322.8, close: 2324.9, volume: 920 },
  { timestamp: "13:15", open: 2324.9, high: 2326.2, low: 2324.2, close: 2325.8, volume: 980 },
  { timestamp: "13:30", open: 2325.8, high: 2326.1, low: 2323.5, close: 2324.1, volume: 1160 },
  { timestamp: "13:45", open: 2324.1, high: 2325.1, low: 2321.9, close: 2322.7, volume: 1420 },
  { timestamp: "14:00", open: 2322.7, high: 2324.0, low: 2321.7, close: 2323.6, volume: 1180 },
  { timestamp: "14:15", open: 2323.6, high: 2327.3, low: 2323.2, close: 2326.8, volume: 1740 },
  { timestamp: "14:30", open: 2326.8, high: 2329.4, low: 2325.9, close: 2328.2, volume: 1880 },
  { timestamp: "14:45", open: 2328.2, high: 2329.2, low: 2326.5, close: 2327.0, volume: 1360 },
  { timestamp: "15:00", open: 2327.0, high: 2330.5, low: 2326.8, close: 2329.8, volume: 2040 },
  { timestamp: "15:15", open: 2329.8, high: 2331.2, low: 2328.1, close: 2328.4, volume: 1640 },
  { timestamp: "15:30", open: 2328.4, high: 2332.0, low: 2328.0, close: 2331.4, volume: 2180 },
  { timestamp: "15:45", open: 2331.4, high: 2333.1, low: 2329.6, close: 2330.2, volume: 1760 },
  { timestamp: "16:00", open: 2330.2, high: 2332.6, low: 2328.8, close: 2331.9, volume: 1910 },
  { timestamp: "16:15", open: 2331.9, high: 2334.2, low: 2330.9, close: 2333.6, volume: 2260 },
];
