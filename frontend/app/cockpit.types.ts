export type CockpitPage =
  | "dashboard"
  | "kalos"
  | "market-chart"
  | "trade-center"
  | "connectors"
  | "journal"
  | "risk"
  | "settings";

export type SignalDecision = "BUY" | "SELL" | "WAIT" | "NO_TRADE" | "DATA_LOW" | "INVALID";

export type ActionDisplayMode = "standard" | "deriv";

export type TradingMode = "ANALYSE_SEULEMENT" | "MANUEL" | "SEMI_AUTO" | "AUTO";

export type StrategyMode = "SCALPING" | "SHORT_TERM" | "LONG_TERM";

export type RuntimeMode = "LIVE" | "DEMO" | "MOCK" | "REAL_DATA";

export type ConnectorState = "connected" | "disconnected" | "delayed";

export type ConnectorSafetyStatus = "DISCONNECTED" | "CONNECTED_DEMO" | "CONNECTED_REAL_READONLY" | "LIVE_BLOCKED";

export type ConnectorRuntimeMode = "MOCK" | "DEMO" | "REAL_DATA";

export type ConnectorProvider = "Deriv" | "MT5" | "Forex" | "Future Providers";

export type ConnectorAccountKind = "DEMO" | "REAL" | "API" | "FUTURE";

export type ConnectorRuntimeStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "CONNECTED_DEMO" | "DEGRADED" | "ERROR";

export type ConnectorSecretStatus = "MISSING" | "SAVED" | "ROTATION_REQUIRED" | "INVALID";

export type LicenseStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED" | "MISSING";
export type LicensePlan = "STARTER" | "PRO" | "ELITE" | "LIFETIME" | "NONE";
export type LicenseDuration = "1_MONTH" | "2_MONTHS" | "3_MONTHS" | "6_MONTHS" | "1_YEAR" | "LIFETIME";
export type UserRole = "OWNER" | "ADMIN" | "USER";

export type DataQuality = "GOOD" | "HEALTHY" | "DEGRADED" | "STALE" | "INVALID" | "DISCONNECTED";

export interface ConnectorUserScope {
  readonly scope: "CURRENT_USER";
  readonly userId: string;
  readonly displayName: string;
}

export interface ConnectorLicenseSnapshot {
  readonly status: LicenseStatus;
  readonly plan: string;
  readonly expiryDate: string | null;
  readonly deviceLimit: number | null;
  readonly activeDevices: number | null;
  readonly sessionLimit: number | null;
  readonly activeSessions: number | null;
  readonly engineStatus: "PENDING" | "READY";
  readonly message: string;
}

export interface SafeLicense {
  readonly id: string;
  readonly userId: string;
  readonly plan: Exclude<LicensePlan, "NONE">;
  readonly duration: LicenseDuration;
  readonly status: Exclude<LicenseStatus, "MISSING">;
  readonly licenseKeyPreview: string;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly expiresAt: string | null;
  readonly suspendedAt: string | null;
  readonly revokedAt: string | null;
  readonly subscriptionId: string;
}

export interface LicenseDevice {
  readonly id: string;
  readonly userId: string;
  readonly licenseId: string;
  readonly label: string;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly revoked: boolean;
}

export interface LicenseUserSession {
  readonly id: string;
  readonly userId: string;
  readonly licenseId: string;
  readonly deviceId: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly revoked: boolean;
}

export interface LicenseStatusSnapshot {
  readonly userId: string;
  readonly license: SafeLicense | null;
  readonly plan: LicensePlan;
  readonly status: LicenseStatus;
  readonly expiryDate: string | null;
  readonly deviceLimit: number | null;
  readonly activeDevices: number;
  readonly sessionLimit: number | null;
  readonly activeSessions: number;
  readonly devices: readonly LicenseDevice[];
  readonly sessions: readonly LicenseUserSession[];
  readonly dashboardBlocked: boolean;
  readonly limitedReadOnly: boolean;
  readonly readOnly: true;
  readonly liveExecutionEnabled: false;
  readonly automaticTradingAllowed: false;
  readonly message: string;
  readonly warnings: readonly string[];
}

export type DataMode = "REAL_DATA" | "DEMO_DATA";

export interface DataModeAuditEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly from: DataMode;
  readonly to: DataMode;
  readonly status: "APPLIED" | "BLOCKED";
  readonly reason: string;
}

export type KalosOverlayName =
  | "BOS"
  | "CHoCH"
  | "Liquidity Sweep"
  | "Strong High"
  | "Weak Low"
  | "Entry Zone"
  | "TP"
  | "SL"
  | "Invalidation"
  | "Trend Projection"
  | "Buy/Sell Arrow"
  | "Signal Ball";

export type KalosOverlayStatus = "ACCEPTED" | "REJECTED" | "NEUTRAL";

export type KalosOverlayObjectType = "LABEL" | "ARROW" | "SIGNAL_BALL" | "ZONE" | "LEVEL" | "PROJECTION";

export interface KalosOverlayObject {
  readonly id: string;
  readonly type: KalosOverlayObjectType;
  readonly label: KalosOverlayName | string;
  readonly price?: number;
  readonly fromPrice?: number;
  readonly toPrice?: number;
  readonly direction?: "BUY" | "SELL";
  readonly status: KalosOverlayStatus;
  readonly color: string;
  readonly reason: string;
}

export type KalosTrend = "BULLISH" | "BEARISH" | "NEUTRAL";

export type KalosMarketBrainScenario = "CONTINUE" | "REVERSE" | "WAIT" | "CANCEL";

export type KalosMarketBrainIntention =
  | "ACCUMULATION"
  | "DISTRIBUTION"
  | "MANIPULATION"
  | "EXPANSION"
  | "CONSOLIDATION";

export interface KalosMarketBrainExpectedPath {
  readonly step: "LIQUIDITY_TEST" | "RETEST" | "EXPANSION" | "REVERSAL_CHECK" | "WAIT_CONFIRMATION" | "INVALIDATION";
  readonly hypothesis: string;
  readonly probability: number;
  readonly price?: number;
}

export interface KalosMarketBrain {
  readonly module: "kalos-market-brain";
  readonly signal: SignalDecision;
  readonly confidence: number;
  readonly scenario: KalosMarketBrainScenario;
  readonly explanation: string;
  readonly invalidation: number | null;
  readonly expectedPath: readonly KalosMarketBrainExpectedPath[];
  readonly timingScore: number;
  readonly riskScore: number;
  readonly structure: KalosTrend;
  readonly intention: KalosMarketBrainIntention;
  readonly rejectedReasons: readonly string[];
  readonly liveExecutionAllowed: false;
}

export type FuturePathEngineState = "READY" | "WAIT" | "INCERTAIN" | "DATA_LOW";

export type FuturePathRole = "MAIN" | "ALTERNATIVE" | "CANCELLED";

export type FuturePathColor = "GREEN" | "BLUE" | "GREY";

export interface FuturePath {
  readonly id: "A" | "B" | "C";
  readonly label: "Path A" | "Path B" | "Path C";
  readonly role: FuturePathRole;
  readonly color: FuturePathColor;
  readonly probability: number;
  readonly estimatedTime: string;
  readonly objective: string;
  readonly target: number | null;
  readonly invalidation: number | null;
  readonly displayState: FuturePathEngineState;
}

export interface FuturePathEngine {
  readonly module: "future-path-engine";
  readonly state: FuturePathEngineState;
  readonly paths: readonly [FuturePath, FuturePath, FuturePath];
  readonly summary: string;
  readonly confidence: number;
  readonly liveExecutionAllowed: false;
}

export type MarketReplayControlAction = "PLAY" | "REWIND" | "FAST_FORWARD" | "PAUSE";

export type MarketReplayDirection = "UP" | "DOWN" | "FLAT";

export type MarketReplayOutcome = "WIN_SIMULATION" | "LOSS_SIMULATION" | "NO_TRADE_SIMULATION";

export interface MarketReplayFrame {
  readonly index: number;
  readonly timestamp: string;
  readonly prediction: {
    readonly signal: SignalDecision;
    readonly confidence: number;
    readonly seenPrice: number;
    readonly seenTrend: KalosTrend;
    readonly seenVolatility: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
    readonly kalosSaw: readonly string[];
  };
  readonly actualResult: {
    readonly closePrice: number;
    readonly movement: number;
    readonly direction: MarketReplayDirection;
    readonly outcome: MarketReplayOutcome;
  };
  readonly difference: {
    readonly expectedDirection: MarketReplayDirection;
    readonly actualDirection: MarketReplayDirection;
    readonly matched: boolean;
    readonly priceDelta: number;
    readonly note: string;
  };
}

export interface MarketReplay {
  readonly module: "market-replay";
  readonly symbol: string;
  readonly timeframe: string;
  readonly controls: readonly MarketReplayControlAction[];
  readonly frames: readonly MarketReplayFrame[];
  readonly metrics: {
    readonly winSimulation: number;
    readonly lossSimulation: number;
    readonly drawdown: number;
    readonly precision: number;
  };
  readonly liveExecutionAllowed: false;
}

export type SyntheticIndexSymbol =
  | "Boom 500"
  | "Boom 1000"
  | "Crash 500"
  | "Crash 1000"
  | "Volatility 10"
  | "Volatility 25"
  | "Volatility 50"
  | "Volatility 75"
  | "Volatility 100";

export type ChartContextAction =
  | "refresh_data"
  | "recalculate_signal"
  | "toggle_kalos"
  | "toggle_overlays"
  | "change_timeframe"
  | "manual_mode"
  | "semi_auto_mode"
  | "auto_mode";

export interface OhlcCandle {
  readonly timestamp: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface DemoModeConfig {
  readonly enabled: true;
  readonly name: "DEMO_MODE";
  readonly dataSource: "SIMULATION";
  readonly accountBalance: number;
  readonly currency: "USD";
  readonly tickMs: number;
  readonly liveTradingEnabled: false;
}

export interface KalosSignal {
  readonly symbol: string;
  readonly decision: SignalDecision;
  readonly confidence: number;
  readonly tp: number;
  readonly sl: number;
  readonly invalidation: number;
  readonly reasons: readonly string[];
  readonly rejectedReasons: readonly string[];
  readonly timeframe: string;
  readonly trend: KalosTrend;
  readonly volatility: "LOW" | "NORMAL" | "HIGH";
  readonly riskScore: number;
  readonly overlayObjects: readonly KalosOverlayObject[];
  readonly marketBrain: KalosMarketBrain;
  readonly futurePath: FuturePathEngine;
  readonly marketReplay: MarketReplay;
  readonly htf: string;
  readonly mtf: string;
  readonly ltf: string;
  readonly dataSource?: "MOCK" | "DEMO" | "REAL_DATA";
  readonly dataSourceLabel?: string;
  readonly sourceStatus?: "CONNECTED" | "DELAYED" | "MOCK" | "DISCONNECTED" | "UNKNOWN";
  readonly syncStatus?: "IN_SYNC" | "LAGGING" | "OUT_OF_SYNC" | "UNKNOWN";
  readonly freshnessSeconds?: number | null;
  readonly latencyMs?: number | null;
  readonly dataQuality?: "HEALTHY" | "DEGRADED" | "STALE" | "INVALID" | "DISCONNECTED";
  readonly lastTickAt?: string | null;
  readonly lastCandleAt?: string | null;
  readonly signalHorizon?: SignalHorizon | null;
  readonly statisticalRisk?: StatisticalRisk | null;
  readonly adaptiveHorizon?: AdaptiveHorizon | null;
  readonly backtestValidation?: BacktestMonteCarloSummary | null;
}

export type TimeframeAgreement = "ALIGNED" | "PARTIAL" | "CONFLICT" | "STRONG_CONFLICT";
export type AdaptiveRiskMode = "NORMAL" | "CAUTION" | "DEFENSIVE" | "NO_TRADE";
export type AdaptiveRecommendedAction = "TRADE_ALLOWED_SIMULATION" | "TAKE_PROFIT_QUICKLY" | "HOLD_CAUTIOUSLY" | "NO_TRADE";

export interface AdaptiveHorizon {
  readonly selectedHorizon: SignalHorizonName;
  readonly reason: string;
  readonly validForSeconds: number;
  readonly profitWindowSeconds: number;
  readonly recommendedAction: AdaptiveRecommendedAction;
  readonly noTrade: boolean;
  readonly noTradeReason: string | null;
  readonly timeframeAgreement: TimeframeAgreement;
  readonly riskMode: AdaptiveRiskMode;
  readonly confidenceAdjustment: number;
  readonly fixedHorizon: SignalHorizonName;
  readonly comparison: {
    readonly accuracyBefore: number;
    readonly accuracyAfter: number;
    readonly noTradeRate: number;
    readonly drawdownBefore: number;
    readonly drawdownAfter: number;
    readonly pnlBefore: number;
    readonly pnlAfter: number;
    readonly recommendedDefault: SignalHorizonName;
  };
  readonly liveExecutionAllowed: false;
}

export interface BacktestMonteCarloSummary {
  readonly backtestScore: number;
  readonly monteCarloScore: number;
  readonly riskOfRuin: number;
  readonly recommendedMode: string;
  readonly recommendedHorizon: SignalHorizonName;
  readonly realReadiness: "READY" | "NOT_READY";
  readonly realReadinessLabel: string;
  readonly reasons: readonly string[];
  readonly totalSignals: number;
  readonly sharpe: number;
  readonly maxDrawdown: number;
  readonly productionConfidence?: {
    readonly productionConfidence: "LOW" | "MEDIUM" | "HIGH";
    readonly overfitRisk: string;
    readonly generalizationGap: number;
    readonly trainScore: number;
    readonly validationScore: number;
    readonly testScore: number;
    readonly realReadiness: "NOT_READY";
  };
}

export type SharpeStatus = "POOR" | "ACCEPTABLE" | "GOOD" | "EXCELLENT";
export type CalibrationStatus = "UNCALIBRATED" | "CALIBRATED" | "DEGRADED";
export type VolatilityRegime = "TREND" | "RANGE" | "CHAOS" | "SPIKE";

export interface StatisticalRisk {
  readonly action: SignalDecision;
  readonly direction: "UP" | "DOWN" | "WAIT";
  readonly confidence: number;
  readonly calibratedConfidence: number;
  readonly expectedValue: number;
  readonly sharpeRatio: number;
  readonly sharpeStatus: SharpeStatus;
  readonly drawdown: {
    readonly currentDrawdown: number;
    readonly maxDrawdown: number;
    readonly dailyDrawdown: number;
    readonly sessionDrawdown: number;
    readonly riskLock: boolean;
  };
  readonly kellyFraction: number;
  readonly recommendedStake: number;
  readonly riskReward: number;
  readonly volatilityRegime: VolatilityRegime;
  readonly calibration: {
    readonly announcedConfidence: number;
    readonly calibratedConfidence: number;
    readonly observedWinRate: number | null;
    readonly calibrationError: number | null;
    readonly brierScore: number | null;
    readonly status: CalibrationStatus;
  };
  readonly noTradeReason: string | null;
  readonly sampleSize: number;
  readonly liveExecutionAllowed: false;
}

export type SignalHorizonName = "SCALPING" | "SHORT" | "LONG";

export type SignalLifecycleStatus = "ACTIVE" | "EXPIRED" | "INVALIDATED" | "REFRESHED" | "NO_TRADE";
export type ShadowLifecycleStatus = "CREATED" | "ACTIVE" | "EXPIRED" | "CLOSED" | "INVALIDATED";

export interface SignalHorizonStats {
  readonly horizon: SignalHorizonName;
  readonly score: number;
  readonly sampleSize: number;
  readonly survives: number;
  readonly expires: number;
  readonly invalidated: number;
  readonly refreshed: number;
  readonly avgPredictionLifeSeconds: number;
  readonly avgDrawdown: number;
  readonly avgProfitDurationSeconds: number;
}

export interface SignalHorizonValidation {
  readonly sampleSize: number;
  readonly avgPredictionLifeSeconds: number;
  readonly bestHorizon: SignalHorizonName;
  readonly worstHorizon: SignalHorizonName;
  readonly avgDrawdown: number;
  readonly avgProfitDurationSeconds: number;
  readonly horizons: Record<SignalHorizonName, SignalHorizonStats>;
}

export interface SignalHorizon {
  readonly selected: SignalHorizonName;
  readonly generatedAt: string;
  readonly firstEntryTime: string | null;
  readonly expirationTime: string;
  readonly invalidationTime: string | null;
  readonly durationAliveSeconds: number;
  readonly maxProfitWindowSeconds: number;
  readonly maxDrawdown: number;
  readonly updateFrequencySeconds: number;
  readonly remainingSeconds: number;
  readonly status: SignalLifecycleStatus;
  readonly validation: SignalHorizonValidation;
}

export interface ShadowSignalRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly market: string;
  readonly direction: "UP" | "DOWN" | "WAIT";
  readonly confidence: number;
  readonly entry: number;
  readonly virtualExit: number;
  readonly TP: number;
  readonly SL: number;
  readonly expiry: string;
  readonly expectedValue: number;
  readonly riskReward: number;
  readonly signalHorizon: SignalHorizonName;
  readonly capitalModel: "FIXED_FRACTION_SIMULATION";
  readonly pnlSimulated: number;
  readonly result: "WIN" | "LOSS" | "EXPIRED" | "INVALIDATED";
  readonly lifecycle: ShadowLifecycleStatus;
}

export interface ShadowTradingReport {
  readonly generatedAt: string;
  readonly mode: "SHADOW_TRADING";
  readonly pipeline: readonly string[];
  readonly modes: readonly SignalHorizonName[];
  readonly minimumLiveSignalsRequired: 500;
  readonly signalsObserved: number;
  readonly todayPnl: number;
  readonly weeklyPnl: number;
  readonly virtualBalance: number;
  readonly winrate: number;
  readonly avgDurationSeconds: number;
  readonly drawdown: number;
  readonly sharpe: number;
  readonly noTradeRate: number;
  readonly profitFactor: number;
  readonly rollingSharpe: number;
  readonly rollingDrawdown: number;
  readonly signalDecay: number;
  readonly confidenceStability: number;
  readonly marketStability: number;
  readonly regimeChanges: number;
  readonly rules: {
    readonly rollingSharpeOk: boolean;
    readonly drawdownOk: boolean;
    readonly signalDecayOk: boolean;
    readonly confidenceDriftOk: boolean;
  };
  readonly realReadiness: "NOT_READY";
  readonly realReadinessReasons: readonly string[];
  readonly liveExecutionEnabled: false;
  readonly orderPlacementAllowed: false;
  readonly autoExecution: false;
  readonly forbiddenRoutes: readonly string[];
  readonly journal: readonly ShadowSignalRecord[];
}

export type DemoObservationGateStatus =
  | "DEMO_OBSERVATION_RUNNING"
  | "DEMO_STABLE"
  | "DEMO_UNSTABLE"
  | "REAL_PREP_LOCKED";

export interface DemoObservationDailyMetrics {
  readonly date: string;
  readonly signalsCount: number;
  readonly virtualPnL: number;
  readonly realisticPnL: number;
  readonly realisticSharpe: number;
  readonly realisticDrawdown: number;
  readonly winrate: number;
  readonly noTradeRate: number;
  readonly simulationBias: number;
  readonly confidenceDrift: number;
  readonly bestMarket: string;
  readonly worstMarket: string;
  readonly disabledMarkets: readonly string[];
  readonly feedUptime: number;
  readonly incidentCount: number;
}

export interface DemoObservationGateReport {
  readonly generatedAt: string;
  readonly gate: "14_DAY_DEMO_OBSERVATION";
  readonly daysObserved: number;
  readonly daysCompleted: number;
  readonly daysRemaining: number;
  readonly minimumSignals: number;
  readonly observedSignals: number;
  readonly gateStatus: DemoObservationGateStatus;
  readonly blockers: readonly string[];
  readonly trend: "IMPROVING" | "STABLE" | "DEGRADING";
  readonly readinessScore: number;
  readonly dailyMetrics: readonly DemoObservationDailyMetrics[];
  readonly incidentSummary: {
    readonly feedInterruption: number;
    readonly latencySpike: number;
    readonly shadowPnlAnomaly: number;
    readonly drawdownSpike: number;
    readonly confidenceDrift: number;
    readonly missingTicksCandles: number;
  };
  readonly realReadiness: "NOT_READY";
  readonly liveExecutionEnabled: false;
  readonly orderPlacementAllowed: false;
  readonly autoExecution: false;
  readonly confirmRealStatus: 403;
}

export interface ConnectorStatus {
  readonly id: string;
  readonly name: string;
  readonly provider?: ConnectorProvider;
  readonly accountKind?: ConnectorAccountKind;
  readonly ownerScope?: "CURRENT_USER";
  readonly ownerUserId?: string;
  readonly licenseStatus?: LicenseStatus;
  readonly connectorStatus?: ConnectorRuntimeStatus;
  readonly runtimeMode: RuntimeMode | ConnectorRuntimeMode;
  readonly state: ConnectorState;
  readonly safetyStatus: ConnectorSafetyStatus;
  readonly executionStatus: "LIVE_BLOCKED";
  readonly accessMode: "DEMO" | "REAL";
  readonly dataQuality?: DataQuality;
  readonly sourceStatus?: "CONNECTED" | "DELAYED" | "MOCK" | "DISCONNECTED" | "UNKNOWN";
  readonly syncStatus?: "IN_SYNC" | "LAGGING" | "OUT_OF_SYNC" | "UNKNOWN";
  readonly latencyMs: number | null;
  readonly lastTickAt?: string | null;
  readonly lastCandleAt?: string | null;
  readonly freshnessSeconds?: number | null;
  readonly source: "LIVE" | "DEMO" | "MOCK" | "PERSONAL_DERIV_DEMO" | "PERSONAL_DERIV_DEMO_OAUTH";
  readonly message: string;
  readonly secretLocation: "BACKEND_ONLY";
  readonly secretStatus?: ConnectorSecretStatus;
  readonly secretSaved?: boolean;
  readonly secretLastUpdatedAt?: string | null;
  readonly secretMaskedPreview?: string;
  readonly saved?: boolean;
  readonly connected?: boolean;
  readonly lastTestAt?: string | null;
  readonly accountType?: "DEMO" | "REAL" | "UNKNOWN" | null;
  readonly loginid?: string | null;
  readonly brokerLoginId?: string | null;
  readonly status?: "CONNECTED" | "DISCONNECTED";
  readonly personalSource?: "PERSONAL_DERIV_DEMO" | "PERSONAL_DERIV_DEMO_OAUTH" | null;
  readonly accountId?: string | null;
  readonly authType?: "PAT" | "OAUTH" | "UNKNOWN";
  readonly readOnly?: true;
  readonly readOnlyStatus?: "READ_ONLY";
  readonly liveBlocked?: true;
  readonly liveTradingAllowed?: false;
  readonly orderPlacementAllowed?: false;
  readonly tokenVisible?: false;
  readonly allowedDevicesCount?: number | null;
  readonly activeDevicesCount?: number | null;
  readonly activeSessionsCount?: number | null;
  readonly warnings?: readonly string[];
  readonly readonlyByDefault: true;
}

export interface MarketStatus {
  readonly symbol: string;
  readonly timeframe: string;
  readonly runtimeMode: RuntimeMode;
  readonly price: number;
  readonly spread: number;
  readonly volume: number;
  readonly source: "LIVE" | "DEMO" | "MOCK";
  readonly session: string;
  readonly fallback?: "NONE" | "MOCK_DATA";
  readonly dataQuality?: "HEALTHY" | "DEGRADED" | "STALE" | "INVALID" | "DISCONNECTED";
  readonly sourceStatus?: "CONNECTED" | "DELAYED" | "MOCK" | "DISCONNECTED" | "UNKNOWN";
  readonly syncStatus?: "IN_SYNC" | "LAGGING" | "OUT_OF_SYNC" | "UNKNOWN";
  readonly latencyMs?: number | null;
  readonly freshnessSeconds?: number | null;
  readonly missingCandles?: number;
  readonly spreadQuality?: "NORMAL" | "WIDE" | "ABNORMAL" | "UNKNOWN";
  readonly lastTickAt?: string | null;
  readonly lastCandleAt?: string | null;
}

export interface RiskStatus {
  readonly score: number;
  readonly rr: number;
  readonly riskPerTrade: number;
  readonly dailyDrawdown: number;
  readonly weeklyDrawdown: number;
  readonly totalDrawdown: number;
  readonly spreadOk: boolean;
  readonly slPresent: boolean;
  readonly tpPresent: boolean;
  readonly journalReady: boolean;
  readonly liveEnabled: boolean;
}

export interface JournalRow {
  readonly id: string;
  readonly timestamp: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly mode: StrategyMode;
  readonly decision: SignalDecision;
  readonly confidence: number;
  readonly riskScore: number;
  readonly source: "LIVE" | "DEMO" | "MOCK";
  readonly sourceLabel?: string;
  readonly fallback?: "NONE" | "MOCK_DATA";
  readonly module: "KALOS" | "BACKTEST" | "MANUAL" | "AUTO";
  readonly result: string;
}

export interface BacktestSummary {
  readonly id: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly mode: StrategyMode;
  readonly strategy: "KALOS";
  readonly dataSource: "MOCK" | "DEMO";
  readonly period: string;
  readonly totalTrades: number;
  readonly winRate: number;
  readonly profitFactor: number;
  readonly maxDrawdown: number;
  readonly netProfit: number;
  readonly noTradeCount: number;
  readonly recommendation: string;
}

export interface WatchlistItem {
  readonly symbol: string;
  readonly price: number;
  readonly change: number;
  readonly signal: SignalDecision;
  readonly spread: number;
  readonly runtimeMode: RuntimeMode;
  readonly confidence?: number | null;
  readonly probability?: number | null;
  readonly riskScore?: number | null;
  readonly dataQuality?: DataQuality | null;
  readonly sourceLabel?: string;
}

export interface AlertItem {
  readonly id: string;
  readonly severity: "INFO" | "WARNING" | "CRITICAL";
  readonly title: string;
  readonly detail: string;
  readonly time: string;
}

export interface CockpitState {
  readonly kalosEnabled: boolean;
  readonly tradingMode: TradingMode;
  readonly strategyMode: StrategyMode;
  readonly dataMode: DataMode;
  readonly analysisInProgress: boolean;
  readonly tradeInProgress: boolean;
  readonly emergencyStop: boolean;
  readonly dataModeAudit: readonly DataModeAuditEntry[];
  readonly lastAction: string;
}
