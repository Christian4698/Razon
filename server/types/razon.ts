export type RazonMode = "demo" | "backtest" | "live";

export type RazonDataMode = "REAL_DATA" | "DEMO_DATA";

export type RazonDataModeChangeStatus = "APPLIED" | "BLOCKED";

export type RazonConnectionState = "connected" | "disconnected";

export type RazonConnectorSafetyStatus = "DISCONNECTED" | "CONNECTED_DEMO" | "CONNECTED_REAL_READONLY" | "LIVE_BLOCKED";

export type RazonSignalDecision = "BUY" | "SELL" | "WAIT" | "NO_TRADE" | "DATA_LOW" | "INVALID";

export type RazonSyntheticIndexName =
  | "Boom 500"
  | "Boom 1000"
  | "Crash 500"
  | "Crash 1000"
  | "Volatility 10"
  | "Volatility 25"
  | "Volatility 50"
  | "Volatility 75"
  | "Volatility 100";

export type RazonFrappeDollarSignalType = "BOOM" | "CRASH" | "VOLATILITY_MOVE";

export type RazonFrappeDollarDirection = "BUY" | "SELL" | "WAIT";

export type RazonMarketBrainScenario = "CONTINUE" | "REVERSE" | "WAIT" | "CANCEL";

export type RazonMarketBrainIntention =
  | "ACCUMULATION"
  | "DISTRIBUTION"
  | "MANIPULATION"
  | "EXPANSION"
  | "CONSOLIDATION";

export type RazonMarketBrainStructure = "BULLISH" | "BEARISH" | "NEUTRAL";

export type RazonFuturePathState = "READY" | "WAIT" | "INCERTAIN" | "DATA_LOW";

export type RazonFuturePathRole = "MAIN" | "ALTERNATIVE" | "CANCELLED";

export type RazonFuturePathColor = "GREEN" | "BLUE" | "GREY";

export type RazonMarketReplayControlAction = "PLAY" | "REWIND" | "FAST_FORWARD" | "PAUSE";

export type RazonMarketReplayDirection = "UP" | "DOWN" | "FLAT";

export type RazonMarketReplayOutcome = "WIN_SIMULATION" | "LOSS_SIMULATION" | "NO_TRADE_SIMULATION";

export interface RazonDataModeAuditEvent {
  id: string;
  timestamp: string;
  from: RazonDataMode;
  to: RazonDataMode;
  status: RazonDataModeChangeStatus;
  reason: string;
}

export interface RazonDataModeState {
  mode: RazonDataMode;
  labels: string[];
  liveExecutionEnabled: false;
  realAccountConnected: false;
  lastChangedAt: string | null;
}

export interface RazonDataModeChangeRequest {
  targetMode: RazonDataMode;
  confirmationSteps: {
    warningAccepted: boolean;
    safetyAccepted: boolean;
    typedPhrase: "JE COMPRENDS" | string;
  };
  safetyContext: {
    emergencyStop: boolean;
    analysisInProgress: boolean;
    tradeInProgress: boolean;
    liveEnabled: false;
  };
}

export interface RazonDataModeChangeResult {
  status: RazonDataModeChangeStatus;
  mode: RazonDataMode;
  reason: string;
  auditEvent: RazonDataModeAuditEvent;
}

export interface RazonMarketInput {
  symbol?: string;
  price: number | null;
  volume: number | null;
  rsi: number | null;
  ema: number | null;
  atr: number | null;
  momentum?: number | null;
  trend?: string;
  marketStrength?: number;
  volatility?: string;
}

export interface RazonMarketCandle {
  timestamp: string;
  price: number;
  volume: number;
}

export interface RazonMarketSnapshot {
  mode: RazonMode;
  source: "simulated-v1" | "provider-backed";
  instrument: string;
  generatedAt: string;
  input: RazonMarketInput;
  candles: RazonMarketCandle[];
  verifiedPerformance: false;
  performanceMessage: "No verified performance yet";
}

export interface RazonSignalOutput {
  signal: RazonSignalDecision;
  decision?: RazonSignalDecision;
  confidence: number;
  probability?: number;
  risk?: "low" | "medium" | "high";
  entry: number | null;
  entryZone?: [number, number] | null;
  sl: number | null;
  tp: number | null;
  invalidationLevel?: number | null;
  reasons: string[];
  whyBuy?: string[];
  whySell?: string[];
  whyWait?: string[];
  currentPrice?: number | null;
  invalidation?: number | null;
  symbol?: string;
  timeframe?: string;
  source?: string;
  decimals?: number;
  priceValidation?: {
    readonly valid: boolean;
    readonly reasonCode: "INVALID_SIGNAL_PRICE_RELATION" | null;
    readonly reasons: readonly string[];
    readonly entry: number | null;
    readonly currentPrice: number | null;
    readonly tp: number | null;
    readonly sl: number | null;
    readonly invalidation: number | null;
    readonly symbol: string;
    readonly timeframe: string;
    readonly source: string;
    readonly decimals: number;
  };
}

export interface RazonFrappeDollarVisualMarker {
  kind:
    | "IMPULSE_BALL"
    | "BOS_LABEL"
    | "CHOCH_LABEL"
    | "LIQUIDITY_SWEEP"
    | "ENTRY_ZONE"
    | "TP_ZONE"
    | "SL_ZONE"
    | "INVALIDATION";
  label: string;
  color: string;
  status: "ACCEPTED" | "REJECTED" | "WAITING";
}

export interface RazonFrappeDollarSignalOutput {
  market: RazonSyntheticIndexName;
  signalType: RazonFrappeDollarSignalType;
  direction: RazonFrappeDollarDirection;
  confidence: number;
  entryZone: [number, number] | null;
  stopLoss: number | null;
  takeProfit: number | null;
  invalidation: number | null;
  reason: string;
  visualMarker: RazonFrappeDollarVisualMarker;
  journalRequired: true;
  liveAutoExecutionAllowed: false;
}

export interface RazonMarketBrainExpectedPath {
  step:
    | "LIQUIDITY_TEST"
    | "RETEST"
    | "EXPANSION"
    | "REVERSAL_CHECK"
    | "WAIT_CONFIRMATION"
    | "INVALIDATION";
  hypothesis: string;
  probability: number;
  price?: number;
}

export interface RazonMarketBrainOutput {
  module: "kalos-market-brain";
  signal: RazonSignalDecision | "NO_TRADE";
  confidence: number;
  scenario: RazonMarketBrainScenario;
  explanation: string;
  invalidation: number | null;
  expectedPath: RazonMarketBrainExpectedPath[];
  timingScore: number;
  riskScore: number;
  structure: RazonMarketBrainStructure;
  intention: RazonMarketBrainIntention;
  rejectedReasons: string[];
  liveExecutionAllowed: false;
}

export interface RazonFuturePath {
  id: "A" | "B" | "C";
  label: "Path A" | "Path B" | "Path C";
  role: RazonFuturePathRole;
  color: RazonFuturePathColor;
  probability: number;
  estimatedTime: string;
  objective: string;
  target: number | null;
  invalidation: number | null;
  displayState: RazonFuturePathState;
}

export interface RazonFuturePathEngineOutput {
  module: "future-path-engine";
  state: RazonFuturePathState;
  paths: [RazonFuturePath, RazonFuturePath, RazonFuturePath];
  summary: string;
  confidence: number;
  liveExecutionAllowed: false;
}

export interface RazonMarketReplayFrame {
  index: number;
  timestamp: string;
  prediction: {
    signal: RazonSignalDecision | "NO_TRADE";
    confidence: number;
    seenPrice: number;
    seenTrend: RazonMarketBrainStructure;
    seenVolatility: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
    kalosSaw: string[];
  };
  actualResult: {
    closePrice: number;
    movement: number;
    direction: RazonMarketReplayDirection;
    outcome: RazonMarketReplayOutcome;
  };
  difference: {
    expectedDirection: RazonMarketReplayDirection;
    actualDirection: RazonMarketReplayDirection;
    matched: boolean;
    priceDelta: number;
    note: string;
  };
}

export interface RazonMarketReplayOutput {
  module: "market-replay";
  symbol: string;
  timeframe: string;
  controls: RazonMarketReplayControlAction[];
  frames: RazonMarketReplayFrame[];
  metrics: {
    winSimulation: number;
    lossSimulation: number;
    drawdown: number;
    precision: number;
  };
  liveExecutionAllowed: false;
}

export interface RazonJournalEntry {
  id: string;
  timestamp: string;
  input: RazonMarketInput;
  decision: RazonSignalDecision;
  confidence: number;
  reasons: string[];
}

export interface RazonJournalDecisionSummary {
  title: "Why BUY" | "Why SELL" | "Why WAIT";
  decision: RazonSignalDecision;
  entries: RazonJournalEntry[];
}

export interface RazonRiskState {
  mode: RazonMode;
  automaticTradingAllowed: false;
  mt5Connected: false;
  liveExecutionEnabled: false;
  positions: [];
  rules: Array<{
    id: string;
    label: string;
    status: "enforced" | "not_configured";
    description: string;
  }>;
  verifiedPerformance: false;
  performanceMessage: "No verified performance yet";
}

export interface RazonBacktestState {
  mode: "backtest";
  status: "ready_no_dataset";
  verifiedPerformance: false;
  performanceMessage: "No verified performance yet";
  results: null;
  message: string;
}

export interface RazonStatus {
  app: "RAZON";
  tagline: "AI Trading Analysis Platform";
  state: RazonConnectionState;
  mode: RazonMode;
  dataMode: RazonDataMode;
  dataModeLabels: string[];
  api: "online";
  automaticTradingAllowed: false;
  mt5Connected: false;
  liveExecutionEnabled: false;
  verifiedPerformance: false;
  performanceMessage: "No verified performance yet";
  timestamp: string;
}
