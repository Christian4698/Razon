# RAZON - Product Specification

Version: Final Documentation
Status: Implementation In Progress
Priority: Critical

## Vision

RAZON is a professional platform for probabilistic market analysis,
explainable decision support, capital protection, and controlled execution.

RAZON must follow this order:

```text
Observe -> Understand -> Filter -> Explain -> Validate Risk -> Journal -> Execute only if authorized
```

RAZON must never be presented as a magic predictor, a guaranteed-profit system,
or a raw BUY/SELL generator.

## Product Principles

- Capital protection comes before performance.
- NO_TRADE is a valid decision.
- Confidence is not certainty.
- Analysis and execution are separate responsibilities.
- Risk Engine and No-Trade Engine are mandatory before execution.
- Journal must record accepted and refused decisions.
- LIVE trading is disabled by default.
- MOCK data cannot be used for execution.

## Global Architecture

RAZON is organized into these areas:

- `backend/src/core`: contracts, types, constants and errors.
- `backend/src/modules/kalos`: probabilistic analysis engine.
- `backend/src/modules/kalos/market-brain`: `kalos-market-brain`
  interpretation layer.
- `backend/src/modules/kalos/future-path-engine`: `future-path-engine`
  visual timeline layer.
- `backend/src/modules/kalos-overlay`: planned chart overlay boundary for
  KALOS annotations.
- `backend/src/modules/synthetic-indices`: planned synthetic indices analysis
  boundary.
- `backend/src/modules/frappe-dollar`: planned volatile-market strategy
  boundary.
- `backend/src/modules/data-mode`: protected REAL_DATA / DEMO_DATA control
  boundary.
- `backend/src/modules/audit`: control-plane audit events for data-mode and
  safety changes.
- `backend/src/modules/market-observability`: planned read-only market data
  health, data quality and KALOS Data Guard boundary.
- `backend/src/modules/risk`: capital protection and risk validation.
- `backend/src/modules/no-trade`: explicit refusal engine.
- `backend/src/modules/backtesting`: historical/mock signal validation.
- `backend/src/modules/journal`: decision log and audit trail.
- `backend/src/modules/execution`: controlled order preparation and validation.
- `backend/src/modules/connectors`: MT5, Deriv, Forex, TradingView and Mock
  boundaries.
- `backend/src/modules/ai`: explainable advisory engine.
- `backend/src/modules/security`: encryption, vault, auth, permissions, rate
  limiting and security audit.
- `backend/src/modules/monitoring`: health, system status, incidents and
  fail-safe.
- `frontend` and `client`: cockpit dashboard, mobile-ready UI and PWA shell.
- `infrastructure/security`: production checklist and incident response.

## Modes

Trading control modes:

- `MANUAL`: user controls actions.
- `SEMI_AUTO`: RAZON prepares and validates; user confirms.
- `AUTO`: future controlled mode; disabled by default.

Market strategy modes:

- `SCALPING`
- `SHORT_TERM`
- `LONG_TERM`

Runtime source modes:

- `MOCK`
- `DEMO`
- `LIVE`

The current UI and reports must clearly display MOCK / DEMO / LIVE.

Data modes:

- `REAL_DATA`: broker/API data can be read for real analysis. If LIVE is OFF,
  execution remains disabled and no real order can be sent.
- `DEMO_DATA`: simulated data only. It has no real impact and must display
  `DEMO_MODE`, `MOCK` and `NO REAL IMPACT` labels wherever analysis state is
  shown.

The current UI must clearly display `REAL_DATA` or `DEMO_DATA` on every cockpit
surface. A data mode must never mislead the user about whether the data is real
or simulated.

## Data Mode Control

Data Mode Control is a protected Settings module for switching between
`REAL_DATA` and `DEMO_DATA`.

Access rules:

- The DEMO/REAL switch must not be directly accessible from the dashboard.
- Access is allowed only from Settings > Confidentialite & Securite.
- The switch requires a 3-step confirmation.
- The user must type exactly `JE COMPRENDS`.
- A clear warning must be displayed before every change.
- Every attempted mode change must be journaled in the control audit trail.
- Mode change is blocked while an analysis or trade workflow is in progress.
- Emergency Stop is always prioritary and blocks data-mode changes.

Data Mode Control changes data source visibility only. It must not connect a
real account, activate LIVE or execute an order.

## Market Data Observability

Market Data Observability is the read-only quality boundary that prepares
RAZON/KALOS for DEMO market data before Deriv or MT5 connectors are activated.

Reference documentation:

- `docs/architecture/market-observability.md`

The observability layer measures:

- `latencyMs`
- `freshnessSeconds`
- `missingCandles`
- `spreadQuality`
- `tickRate`
- `sourceStatus`
- `syncStatus`

Data quality states:

- `HEALTHY`
- `DEGRADED`
- `STALE`
- `INVALID`
- `DISCONNECTED`

KALOS Data Guard rules:

- old data forces `NO_TRADE`
- abnormal spread forces `WAIT`
- candle gaps display `DATA_LOW`
- unknown source sets `INVALID`

Dashboard metric specification:

- Data Source
- Data Quality
- Last Candle
- Last Tick
- Latence
- Freshness

Market Data Observability is design and contract only until a future
implementation phase. It must not connect Deriv, connect MT5, activate LIVE,
enable execution or create an order route.

## KALOS

KALOS is the main probabilistic analysis engine. It analyzes:

- market structure
- liquidity
- trend
- momentum
- volatility
- entry score
- no-trade context
- HTF / MTF / LTF layers
- historical calibration samples when available

Outputs:

- decision
- `BUY`
- `SELL`
- `WAIT`
- `NO_TRADE`
- confidence
- reasons
- rejectedReasons
- TP
- SL
- invalidation
- trend
- timeframe
- volatility
- riskScore
- overlayObjects
- marketBrain
- futurePath
- marketReplay

KALOS visual intelligence prepares:

- HH, HL, LH, LL
- BOS and CHoCH
- Breakout and Retest
- Support and Resistance
- Liquidity Sweep
- Buy Side Liquidity and Sell Side Liquidity
- Order Block and Fair Value Gap
- Strong High and Weak Low
- Supply Zone and Demand Zone

KALOS Market Brain:

`kalos-market-brain` is the interpretation layer. It exists so KALOS can
understand context, not only detect labels.

Pipeline:

- Step 1 - read market: candles, swings, volatility, impulse and trend.
- Step 2 - build structure: HH, HL, LH, LL, BOS and CHoCH.
- Step 3 - detect intention: accumulation, distribution, manipulation,
  expansion and consolidation.
- Step 4 - verify liquidity: BSL, SSL, sweep, grab and fake breakout.
- Step 5 - generate scenario: continuity, reversal, wait or cancellation.

Output contract:

- `signal`
- `confidence`
- `scenario`
- `explanation`
- `invalidation`
- `expectedPath`
- `timingScore`
- `riskScore`

UI display:

- `KALOS THINKING…`
- Structure: `BULLISH` / `BEARISH`
- Confidence: `XX%`
- Scenario: `CONTINUE` / `REVERSE` / `WAIT`
- Reason: probability-based hypothesis text

Market Brain must use probability, hypothesis and confidence wording. It must
not promise certainty, must not display 100% certainty, must not activate LIVE
and must not execute orders.

KALOS Visual Timeline:

`future-path-engine` draws multiple probable future paths from the KALOS
decision and Market Brain scenario.

Paths:

- green path: main scenario
- blue path: alternative scenario
- grey path: cancelled scenario

Each path displays:

- probability
- estimated time
- objective
- invalidation level

Example:

- Path A: 72%
- Path B: 21%
- Path C: 7%

Display rules:

- confidence below 70: display `WAIT`
- scenario conflict: display `INCERTAIN`
- weak data: display `DATA LOW`
- `100%` must never be displayed

Future Path Engine is visual-only and cannot activate LIVE, connect a real
account or execute an order.

KALOS Market Replay:

Market Replay replays market candles and shows what KALOS saw at a precise
instant.

Controls:

- replay market
- rewind
- fast-forward
- pause

Interface:

- `Prediction`
- `Actual Result`
- `Difference`

Metrics:

- win simulation
- loss simulation
- drawdown
- precision

Market Replay is simulation-only. It must not connect a real account, activate
LIVE or execute a real order.

Confidence policy:

- below 80: blocked for executable directional signals
- 80 to 94: cautious signal
- 95: maximum premium confidence
- above 95: forbidden
- 100: forbidden

KALOS never executes and never promises certainty.

KALOS also blocks executable directional signals when SL is absent, TP is absent,
market state is too chaotic, or fresh data is not available.

KALOS must consume future Market Data Observability results before trusting
provider-backed candles or ticks. `STALE`, `INVALID` and `DISCONNECTED` data
must prevent directional certainty. `DATA_LOW` must remain a visible low-data
state instead of an executable setup.

## Kalos Overlay Engine

Kalos Overlay Engine is responsible for displaying analysis annotations on the
chart only. It must support:

- BOS
- CHoCH
- Liquidity Sweep
- Strong High
- Weak Low
- Entry Zone
- TP
- SL
- Invalidation
- Trend Projection
- Buy/Sell Arrow
- Signal Ball

The overlay layer is visual and journalable. It must not place, modify or close
orders.

## Synthetic Indices Engine

Synthetic Indices Engine is the Deriv synthetic-market specialist boundary. It
is represented conceptually by `backend/src/modules/synthetic-indices/`.

Target markets:

- Boom 500
- Boom 1000
- Crash 500
- Crash 1000
- Volatility 10
- Volatility 25
- Volatility 50
- Volatility 75
- Volatility 100

The engine tracks:

- Deriv display symbol
- Deriv provider symbol
- family: `BOOM`, `CRASH`, `VOLATILITY`
- default risk profile
- MOCK/DEMO analysis context
- synthetic-specific risk envelope

Synthetic indices support remains analysis-only until connectors, risk rules,
data quality and DEMO validation are complete. It must not connect to a real
account by default.

## FrappeDollar Engine

FrappeDollar Engine is represented conceptually by
`backend/src/modules/frappe-dollar/`. It is a planned strategy for fast
movements on volatile Deriv synthetic markets.

It analyzes:

- strong impulse
- candle acceleration
- BOS break
- CHoCH confirmation
- liquidity sweep
- probable continuation
- SL/TP distance
- false-signal risk

Output contract:

- `signalType`: `BOOM`, `CRASH`, `VOLATILITY_MOVE`
- `direction`: `BUY`, `SELL`, `WAIT`
- `confidence`
- `entryZone`
- `stopLoss`
- `takeProfit`
- `invalidation`
- `reason`
- `visualMarker`

FrappeDollar output is advisory and must pass Risk Engine, No-Trade Engine and
Journal before any future controlled execution path.

FrappeDollar safety rules:

- no trade without SL
- no trade without TP
- no signal if the market is unreadable
- no LIVE auto-execution
- journal every signal

## Chart Context Menu

Chart Context Menu is a planned right-click chart control surface. It includes:

- refresh data
- recalculate signal
- show/hide Kalos
- show/hide overlays
- change timeframe
- manual / semi-auto / auto mode

The menu is a cockpit control surface only. Refresh and recalculation actions
must stay read-only/mock until safe data and execution gates are explicitly
enabled.

## Risk Engine

Risk Engine validates:

- position size
- risk per trade
- open risk
- RR minimum 1:2
- SL validity
- TP validity
- daily drawdown
- weekly drawdown
- total drawdown
- symbol exposure
- total exposure
- spread
- slippage
- journal availability
- MOCK execution block

Risk Engine must not be bypassed by KALOS, Backtesting, Execution or AI.

## No-Trade Engine

No-Trade Engine blocks unsafe conditions:

- confidence below threshold
- RR below 1:2
- spread too high
- slippage too high
- abnormal volatility
- insufficient data
- drawdown limit reached
- too many open positions
- chaotic market
- future news/event shield active
- AUTO mode disabled
- Risk Engine refusal

Every refusal returns a reason code, explanation, severity and recommended
action.

## Backtesting

Backtesting validates KALOS and RAZON signals on historical or mock candles
before any real execution.

Inputs:

- symbol
- timeframe
- historical period
- mode: `SCALPING`, `SHORT_TERM`, `LONG_TERM`
- strategy: `KALOS`
- initial capital
- risk per trade
- simulated spread
- simulated slippage

Required metrics:

- total trades
- win rate
- loss rate
- profit factor
- expectancy
- max drawdown
- average RR
- losing streak
- winning streak
- net profit
- average win
- average loss

Backtest output must clearly state whether data is simulated. A backtest is not
a promise of future performance.

## Journal And Audit

Journal records every decision:

- BUY
- SELL
- WAIT
- NO_TRADE
- errors
- backtests
- refusals
- manual actions
- execution attempts

Each decision should include symbol, timeframe, mode, confidence, risk score,
accepted reasons, rejected reasons, entry, SL, TP, invalidation, RR, spread,
slippage, volatility, data source, trigger module, result and error when
available.

Audit trail must explain why RAZON accepted or refused a trade.

## Execution

Execution Engine prepares and validates orders only. Real trading is not active
by default.

Before any execution:

- confidence >= 80
- RR >= 1:2
- SL present
- TP present
- journal ready
- source data is not MOCK
- Risk Engine validated
- No-Trade Engine is not blocking
- connector connected
- AUTO enabled or manual confirmation received
- Emergency Stop inactive
- Kill Switch inactive

LIVE requires `ENABLE_LIVE_TRADING=true` and production confirmation.

## Connectors

Supported connector boundaries:

- MT5
- Deriv
- Forex API
- TradingView
- Mock

Deriv Connector:

- supports Deriv Demo and Deriv Real profiles
- uses backend-only API token configuration
- reads WebSocket market data by default
- allows `REAL_DATA` to read real market data when configured
- remains read-only unless a future production approval explicitly changes
  execution policy

MT5 Bridge Connector:

- supports MT5 Demo and MT5 Real profiles
- is planned for communication with a local MQL5 EA bridge
- keeps MT5 login, password, server and bridge settings backend-only
- allows `REAL_DATA` to read real account market data when configured
- exposes no frontend broker secret

Common functions:

- `connect`
- `disconnect`
- `testConnection`
- `getConnectionStatus`
- `getCandles`
- `getTick`
- `getSpread`
- `getAccountInfo`
- `getOpenPositions`
- prepared `placeOrder`, `closeOrder`, `modifyOrder`

Connector safety statuses:

- `DISCONNECTED`
- `CONNECTED_DEMO`
- `CONNECTED_REAL_READONLY`
- `LIVE_BLOCKED`

Secrets must stay server-side or in a secure vault.

Connector execution remains blocked in this phase:

- LIVE trading stays OFF.
- No real order is authorized.
- Deriv and MT5 real profiles are read-only for data.
- Order placement, close and modify requests return blocked status.

## Explainable AI

AI analyzes journal, backtests, trade results, NO_TRADE decisions, KALOS
metrics, drawdown and performance by symbol/timeframe/mode.

AI may suggest improvements, but it must never:

- open a trade
- modify Risk Engine alone
- increase risk automatically
- remove No-Trade Engine
- promise profit
- replace KALOS

AI advises. KALOS analyzes. Risk Engine protects. No-Trade Engine blocks.
Execution Engine executes only if authorized.

## Security

Mandatory security requirements:

- API keys encrypted or stored in vault.
- Tokens masked in logs.
- No broker/API secret exposed to frontend.
- Inputs validated.
- Rate limiting enabled.
- Permissions by role.
- Security audit trail.
- CORS validation.
- Required environment variables.
- No hardcoded secret.
- Emergency Stop global.
- Persistent Kill Switch.
- LIVE disabled by default.
- Data Mode Control available only from Settings > Confidentialite & Securite.
- Data mode changes require 3-step confirmation and exact `JE COMPRENDS`
  phrase.
- Data mode changes are blocked during active analysis or trade workflow.
- Data mode changes are blocked while Emergency Stop is active.
- `REAL_DATA` and `DEMO_DATA` labels remain visible in the cockpit.

## Environment

`.env.example` must cover:

- application ports and URLs
- simulation and live flags
- security keys
- database
- storage paths
- MT5
- Deriv
- Forex API
- risk guardrails
- journal/audit
- backtesting

Critical defaults:

- `MODE_SIMULATION=true`
- `DATA_MODE=DEMO_DATA`
- `DEFAULT_DATA_MODE=DEMO_DATA`
- `ALLOW_REAL_DATA=false`
- `REQUIRE_DATA_MODE_CONFIRMATION=true`
- `ENABLE_LIVE_TRADING=false`
- `ALLOW_AUTO_EXECUTION=false`
- `ALLOW_MARTINGALE=false`
- `JOURNAL_ENABLED=true`

## Future Modules

Documented but not implemented yet:

- Economic Calendar Engine
- News/Event Shield
- Watchlist Market Radar
- Alert Engine
- Replay Engine
- Market Replay
- Kalos Overlay Engine
- Synthetic Indices Engine
- FrappeDollar Engine
- Kalos Market Brain
- Future Path Engine
- Chart Context Menu
- Strategy Preset Engine
- Market Data Observability implementation

These modules should be implemented before any serious LIVE workflow.

## Current Limitations

- `pnpm run build` and `pnpm check` pass in the current workspace.
- Dependency audit currently reports vulnerabilities requiring updates.
- Frontend has build validation but no dedicated test suite yet.
- LIVE trading is intentionally disabled.
- Production secret storage and encryption fallback policy need final hardening.
- Market Data Observability is documented as a contract only; no runtime data
  guard is implemented yet.

## Acceptance Criteria

RAZON can continue only when:

- backend and frontend build cleanly
- tests pass
- global TypeScript check passes
- dependency audit is remediated or formally accepted
- Risk Engine and No-Trade Engine remain mandatory
- Journal remains mandatory
- LIVE remains disabled by default
- MOCK/DEMO/LIVE remain visible
- no API key is exposed to frontend
