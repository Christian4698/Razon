import { getRealismAuditReport } from "../realism/realismAuditService";
import { getShadowTradingReport } from "../shadow/shadowTradingService";

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

export interface DemoObservationIncidentSummary {
  readonly feedInterruption: number;
  readonly latencySpike: number;
  readonly shadowPnlAnomaly: number;
  readonly drawdownSpike: number;
  readonly confidenceDrift: number;
  readonly missingTicksCandles: number;
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
  readonly incidentSummary: DemoObservationIncidentSummary;
  readonly thresholds: {
    readonly daysObserved: 14;
    readonly minimumSignals: 3000;
    readonly realisticSharpe: 1.5;
    readonly realisticDrawdown: 8;
    readonly signalLeakage: 0;
    readonly simulationBias: 25;
    readonly confidenceDrift: 10;
    readonly feedUptime: 95;
  };
  readonly checks: {
    readonly daysObservedOk: boolean;
    readonly minimumSignalsOk: boolean;
    readonly realisticSharpeOk: boolean;
    readonly realisticDrawdownOk: boolean;
    readonly signalLeakageOk: boolean;
    readonly simulationBiasOk: boolean;
    readonly confidenceDriftOk: boolean;
    readonly feedUptimeOk: boolean;
  };
  readonly realReadiness: "NOT_READY";
  readonly liveExecutionEnabled: false;
  readonly orderPlacementAllowed: false;
  readonly autoExecution: false;
  readonly confirmRealStatus: 403;
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function dateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function buildDailyMetrics(): readonly DemoObservationDailyMetrics[] {
  const shadow = getShadowTradingReport();
  const realism = getRealismAuditReport();
  const confidenceDrift = round(100 - shadow.confidenceStability, 2);

  return [
    {
      date: dateDaysAgo(0),
      signalsCount: shadow.signalsObserved,
      virtualPnL: shadow.weeklyPnl,
      realisticPnL: realism.metrics.realisticPnL,
      realisticSharpe: realism.metrics.realisticSharpe,
      realisticDrawdown: realism.metrics.realisticDrawdown,
      winrate: shadow.winrate,
      noTradeRate: shadow.noTradeRate,
      simulationBias: realism.simulationBias,
      confidenceDrift,
      bestMarket: "Boom 500",
      worstMarket: realism.simulationBias > 25 ? "Flash move stress basket" : "n/a",
      disabledMarkets: realism.simulationBias > 25 ? ["Flash move stress basket"] : [],
      feedUptime: realism.latency.stable ? 98.7 : 91.2,
      incidentCount: realism.simulationBias > 25 ? 1 : 0,
    },
  ];
}

function incidentSummary(days: readonly DemoObservationDailyMetrics[]): DemoObservationIncidentSummary {
  return {
    feedInterruption: days.filter(day => day.feedUptime < 95).length,
    latencySpike: 0,
    shadowPnlAnomaly: days.filter(day => day.simulationBias > 25).length,
    drawdownSpike: days.filter(day => day.realisticDrawdown > 8).length,
    confidenceDrift: days.filter(day => day.confidenceDrift > 10).length,
    missingTicksCandles: 0,
  };
}

function readinessScore(checks: DemoObservationGateReport["checks"]) {
  const weights: Array<[boolean, number]> = [
    [checks.daysObservedOk, 20],
    [checks.minimumSignalsOk, 15],
    [checks.realisticSharpeOk, 15],
    [checks.realisticDrawdownOk, 15],
    [checks.signalLeakageOk, 15],
    [checks.simulationBiasOk, 10],
    [checks.confidenceDriftOk, 5],
    [checks.feedUptimeOk, 5],
  ];

  return weights.reduce((total, [ok, weight]) => total + (ok ? weight : 0), 0);
}

function gateStatus(score: number, blockers: readonly string[]): DemoObservationGateStatus {
  if (blockers.includes("REAL_PREP_LOCKED")) return "REAL_PREP_LOCKED";
  if (score >= 95 && blockers.length === 0) return "DEMO_STABLE";
  if (score < 60) return "DEMO_UNSTABLE";
  return "DEMO_OBSERVATION_RUNNING";
}

export function getDemoObservationGateReport(): DemoObservationGateReport {
  const days = buildDailyMetrics();
  const latest = days.at(-1);
  const realism = getRealismAuditReport();
  const daysObserved = days.length;
  const observedSignals = days.reduce((total, day) => total + day.signalsCount, 0);
  const avgFeedUptime = days.reduce((total, day) => total + day.feedUptime, 0) / Math.max(days.length, 1);
  const maxConfidenceDrift = Math.max(...days.map(day => day.confidenceDrift));
  const maxSimulationBias = Math.max(...days.map(day => day.simulationBias));
  const maxDrawdown = Math.max(...days.map(day => day.realisticDrawdown));
  const minSharpe = Math.min(...days.map(day => day.realisticSharpe));
  const checks = {
    daysObservedOk: daysObserved >= 14,
    minimumSignalsOk: observedSignals >= 3000,
    realisticSharpeOk: minSharpe >= 1.5,
    realisticDrawdownOk: maxDrawdown <= 8,
    signalLeakageOk: realism.signalLeakage === 0,
    simulationBiasOk: maxSimulationBias <= 25,
    confidenceDriftOk: maxConfidenceDrift <= 10,
    feedUptimeOk: avgFeedUptime >= 95,
  };
  const blockers = [
    checks.daysObservedOk ? null : "daysObserved below 14",
    checks.minimumSignalsOk ? null : "minimumSignals below 3000",
    checks.realisticSharpeOk ? null : "realisticSharpe below 1.5",
    checks.realisticDrawdownOk ? null : "realisticDrawdown above 8",
    checks.signalLeakageOk ? null : "signalLeakage detected",
    checks.simulationBiasOk ? null : "simulationBias above 25",
    checks.confidenceDriftOk ? null : "confidenceDrift above 10",
    checks.feedUptimeOk ? null : "feedUptime below 95%",
    "REAL_PREP_LOCKED",
  ].filter((item): item is string => Boolean(item));
  const score = readinessScore(checks);

  return {
    generatedAt: new Date().toISOString(),
    gate: "14_DAY_DEMO_OBSERVATION",
    daysObserved,
    daysCompleted: daysObserved,
    daysRemaining: Math.max(0, 14 - daysObserved),
    minimumSignals: 3000,
    observedSignals,
    gateStatus: gateStatus(score, blockers),
    blockers,
    trend: latest && latest.realisticSharpe >= 1.5 && latest.realisticDrawdown <= 8 ? "STABLE" : "DEGRADING",
    readinessScore: clamp(score, 0, 100),
    dailyMetrics: days,
    incidentSummary: incidentSummary(days),
    thresholds: {
      daysObserved: 14,
      minimumSignals: 3000,
      realisticSharpe: 1.5,
      realisticDrawdown: 8,
      signalLeakage: 0,
      simulationBias: 25,
      confidenceDrift: 10,
      feedUptime: 95,
    },
    checks,
    realReadiness: "NOT_READY",
    liveExecutionEnabled: false,
    orderPlacementAllowed: false,
    autoExecution: false,
    confirmRealStatus: 403,
  };
}
