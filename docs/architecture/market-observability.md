# Market Data Observability Architecture

Status: Design and contracts only
Scope: DEMO market data preparation, data quality, KALOS guardrails and
dashboard metrics

This document defines the observability layer required before connecting Deriv
or MT5 DEMO market data.

No connector is implemented by this phase. No LIVE flag is changed. No order
path is created or enabled.

Required runtime safety remains:

- `ENABLE_LIVE_TRADING=false`
- `ALLOW_AUTO_EXECUTION=false`
- `MODE_SIMULATION=true`
- connector order placement flags remain false

## Purpose

Market Data Observability sits between future read-only market data providers
and KALOS. It answers one question before analysis:

```text
Is this market data fresh, complete, readable and safe enough for analysis?
```

It does not connect to brokers, does not authenticate external accounts and
does not execute orders.

## Logical Diagram

```text
Future Deriv DEMO / MT5 DEMO / Mock Source
  -> Market Data Normalizer
  -> Market Data Health Model
  -> Data Quality Rules
  -> KALOS Data Guard
  -> KALOS analysis or refusal state
  -> Dashboard Metrics
  -> Journal / Audit context
```

Observability is a read-only control plane. It should be reusable by Deriv,
MT5, Forex, TradingView and Mock sources once connectors are implemented.

## Market Data Health Model

The health model measures data delivery, freshness and structural integrity.

### Metrics

- `latencyMs`: time between provider request or tick receipt and normalized
  market snapshot availability.
- `freshnessSeconds`: age of the latest usable tick or candle compared with
  the current server time.
- `missingCandles`: number of expected candles that are absent for the selected
  timeframe and lookback window.
- `spreadQuality`: qualitative spread state after comparing current spread with
  symbol policy and recent spread baseline.
- `tickRate`: observed ticks per minute for the current symbol and source.
- `sourceStatus`: current feed status exposed by the source boundary.
- `syncStatus`: whether tick, candle and dashboard snapshots refer to the same
  recent market state.

### Source Status

```text
CONNECTED
DELAYED
MOCK
DISCONNECTED
UNKNOWN
```

### Sync Status

```text
IN_SYNC
LAGGING
OUT_OF_SYNC
UNKNOWN
```

### Spread Quality

```text
NORMAL
WIDE
ABNORMAL
UNKNOWN
```

`UNKNOWN` is not acceptable for executable workflows. In this phase there are
no executable workflows, but KALOS should still display the condition and avoid
directional certainty.

## Data Quality Rules

The quality state is derived from health metrics. A single severe failure can
force a worse state.

### States

```text
HEALTHY
DEGRADED
STALE
INVALID
DISCONNECTED
```

### State Meaning

- `HEALTHY`: data is fresh, synchronized, structurally complete and readable.
- `DEGRADED`: analysis can continue with caution, but KALOS must display data
  quality warnings.
- `STALE`: latest tick or candle is too old for directional analysis.
- `INVALID`: source, price, candles, timeframe or normalized fields are
  impossible, unknown or internally inconsistent.
- `DISCONNECTED`: no usable source session or provider response exists.

### Rule Matrix

```text
sourceStatus = DISCONNECTED
  -> DISCONNECTED

sourceStatus = UNKNOWN
  -> INVALID

freshnessSeconds exceeds policy
  -> STALE

missingCandles exceeds policy
  -> DEGRADED or INVALID depending on severity

spreadQuality = WIDE
  -> DEGRADED

spreadQuality = ABNORMAL
  -> INVALID for execution, WAIT for analysis display

tickRate below symbol policy
  -> DEGRADED or STALE

syncStatus = OUT_OF_SYNC
  -> DEGRADED or INVALID depending on latest usable timestamp
```

Recommended default policy for DEMO readiness:

- `HEALTHY`: no missing critical candle, freshness inside timeframe tolerance,
  spread normal, source connected and in sync.
- `DEGRADED`: minor missing candles, delayed feed, wide spread, low tick rate
  or lagging sync.
- `STALE`: latest tick/candle is older than the accepted freshness policy.
- `INVALID`: unknown source, impossible prices, negative spread, invalid
  timeframe, malformed candles or contradictory timestamps.
- `DISCONNECTED`: provider unavailable or no feed session.

## KALOS Data Guard

KALOS Data Guard is the read-only gate that converts market data health into
safe analysis behavior.

It runs before KALOS produces final analysis and before any dashboard signal is
treated as actionable.

### Required Guard Rules

```text
old data
  -> NO_TRADE

abnormal spread
  -> WAIT

candle gaps
  -> DATA_LOW

unknown source
  -> INVALID
```

Detailed behavior:

- `STALE` data forces `NO_TRADE`. KALOS must explain that the source is too old
  for directional analysis.
- `ABNORMAL` spread forces `WAIT`. KALOS may show structure, but it must not
  present a directional action.
- `missingCandles` above policy sets `DATA_LOW`. Future-path and replay panels
  should display low-data state instead of confident scenarios.
- `UNKNOWN` source status or malformed source identity sets `INVALID`. KALOS
  should refuse analysis until the source is identified.
- `DISCONNECTED` feed blocks provider-backed analysis and may fall back to
  visible MOCK only when the user-facing source label explicitly says `MOCK`.

KALOS Data Guard does not place orders, does not prepare orders and does not
change execution flags.

## Dashboard Metrics Specification

Dashboard display is specification-only in this phase.

Required metrics:

- `Data Source`: `MOCK`, `DEMO` or `REAL_DATA`, plus source label such as
  Deriv Demo or MT5 Demo.
- `Data Quality`: `HEALTHY`, `DEGRADED`, `STALE`, `INVALID` or
  `DISCONNECTED`.
- `Last Candle`: timestamp of latest normalized candle.
- `Last Tick`: timestamp of latest normalized tick.
- `Latence`: normalized latency in milliseconds.
- `Freshness`: age in seconds of latest usable market input.

Display rules:

- `LIVE OFF` must stay visible near all market data status surfaces.
- `AUTO EXECUTION OFF` must remain visible where trading mode is shown.
- `INVALID`, `STALE` and `DISCONNECTED` states must use refusal language, not
  opportunity language.
- `DEGRADED` must display caution language and prevent overconfident KALOS
  explanations.
- Dashboard metrics are read-only. They must not expose broker secrets.

## Typed Contracts

These contracts define the intended TypeScript shape. They are documentation in
this phase, not implemented runtime code.

```ts
export type MarketDataSourceMode = "MOCK" | "DEMO" | "REAL_DATA";

export type MarketDataSourceStatus =
  | "CONNECTED"
  | "DELAYED"
  | "MOCK"
  | "DISCONNECTED"
  | "UNKNOWN";

export type MarketDataSyncStatus =
  | "IN_SYNC"
  | "LAGGING"
  | "OUT_OF_SYNC"
  | "UNKNOWN";

export type SpreadQuality =
  | "NORMAL"
  | "WIDE"
  | "ABNORMAL"
  | "UNKNOWN";

export type MarketDataQualityState =
  | "HEALTHY"
  | "DEGRADED"
  | "STALE"
  | "INVALID"
  | "DISCONNECTED";

export interface MarketDataHealthModel {
  readonly symbol: string;
  readonly timeframe: string;
  readonly source: MarketDataSourceMode;
  readonly sourceLabel: string;
  readonly sourceStatus: MarketDataSourceStatus;
  readonly latencyMs: number | null;
  readonly freshnessSeconds: number | null;
  readonly missingCandles: number;
  readonly spreadQuality: SpreadQuality;
  readonly tickRate: number | null;
  readonly syncStatus: MarketDataSyncStatus;
  readonly qualityState: MarketDataQualityState;
  readonly lastTickAt: string | null;
  readonly lastCandleAt: string | null;
  readonly generatedAt: string;
  readonly reasons: readonly string[];
}
```

```ts
export type DataQualityRuleCode =
  | "SOURCE_DISCONNECTED"
  | "SOURCE_UNKNOWN"
  | "DATA_STALE"
  | "MISSING_CANDLES"
  | "SPREAD_WIDE"
  | "SPREAD_ABNORMAL"
  | "LOW_TICK_RATE"
  | "OUT_OF_SYNC"
  | "MALFORMED_DATA";

export interface DataQualityRuleResult {
  readonly code: DataQualityRuleCode;
  readonly state: MarketDataQualityState;
  readonly severity: "info" | "warning" | "critical";
  readonly explanation: string;
  readonly recommendedAction: string;
}
```

```ts
export type KalosDataGuardAction =
  | "ALLOW_ANALYSIS"
  | "WAIT"
  | "NO_TRADE"
  | "DATA_LOW"
  | "INVALID";

export interface KalosDataGuardOutput {
  readonly action: KalosDataGuardAction;
  readonly dataQuality: MarketDataQualityState;
  readonly decisionOverride: "WAIT" | "NO_TRADE" | null;
  readonly dashboardBadge:
    | "DATA_OK"
    | "DATA_WARNING"
    | "DATA_LOW"
    | "DATA_STALE"
    | "DATA_INVALID"
    | "DATA_DISCONNECTED";
  readonly journalCode: DataQualityRuleCode | null;
  readonly reasons: readonly string[];
  readonly rejectedReasons: readonly string[];
}
```

```ts
export interface DashboardMarketDataMetrics {
  readonly dataSource: MarketDataSourceMode;
  readonly dataSourceLabel: string;
  readonly dataQuality: MarketDataQualityState;
  readonly lastCandleAt: string | null;
  readonly lastTickAt: string | null;
  readonly latencyMs: number | null;
  readonly freshnessSeconds: number | null;
  readonly liveOffVisible: true;
  readonly autoExecutionOffVisible: true;
}
```

## Reusable Components

Future implementation should reuse:

- normalized market ticker and candle contracts
- connector health surface
- market aggregator snapshot flow
- KALOS stale data and NO_TRADE behavior
- Future Path `DATA_LOW` display state
- dashboard status pills
- Journal reason codes and audit context

## Modules To Avoid Touching

This phase should not modify:

- execution engine behavior
- order validation behavior
- connector order functions
- emergency stop behavior
- live trading flags
- data mode activation rules
- broker authentication logic

## Implementation Order For A Future Phase

1. Add typed contracts under a market observability module.
2. Add pure quality rule evaluation with unit tests.
3. Add KALOS Data Guard as a pure mapping layer.
4. Add dashboard metric view models.
5. Add read-only API response fields.
6. Only then connect Deriv DEMO or MT5 DEMO data sources.

## Risks

- False confidence if the dashboard displays `CONNECTED` without data quality
  context.
- Over-analysis if KALOS receives stale candles but no freshness metadata.
- Source confusion if `MOCK`, `DEMO` and `REAL_DATA` are not displayed
  separately from feed connection state.
- Security leakage if provider labels or health payloads expose credentials.
- Future connector work may bypass observability unless this contract becomes
  a mandatory input to KALOS.

## Acceptance Criteria

- Market health includes latency, freshness, candle gaps, spread quality, tick
  rate, source status and sync status.
- Data quality always resolves to one of `HEALTHY`, `DEGRADED`, `STALE`,
  `INVALID` or `DISCONNECTED`.
- KALOS Data Guard maps stale data to `NO_TRADE`, abnormal spread to `WAIT`,
  candle gaps to `DATA_LOW` and unknown source to `INVALID`.
- Dashboard metrics can display Data Source, Data Quality, Last Candle, Last
  Tick, Latence and Freshness.
- No connector is created.
- No order path is created.
- LIVE remains OFF.
