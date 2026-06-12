# KALOS Architecture

KALOS is RAZON's visual market intelligence engine. It is the definitive
analysis-only module for advanced visual market context.

KALOS must never connect a real account, activate LIVE, execute an order or
promise profit.

## Structure

Required structure:

- `backend/src/modules/kalos/`
- `frontend/kalos/`
- `docs/architecture/kalos.md`

## Role

KALOS analyzes market context and prepares visual overlays for the chart. It can
produce BUY, SELL, WAIT or NO_TRADE decisions, but execution remains outside
KALOS and blocked by Risk Engine, No-Trade Engine, Journal, connector state and
runtime safety flags.

## Kalos Market Brain

`kalos-market-brain` is the KALOS interpretation engine. It does not only
detect objects; it reads the context and builds a probabilistic market scenario.

Pipeline:

1. Read market:
   - candles
   - swings
   - volatility
   - impulse
   - trend
2. Build structure:
   - HH
   - HL
   - LH
   - LL
   - BOS
   - CHoCH
3. Detect intention:
   - accumulation
   - distribution
   - manipulation
   - expansion
   - consolidation
4. Verify liquidity:
   - BSL
   - SSL
   - sweep
   - grab
   - fake breakout
5. Generate scenario:
   - Scenario A: continuity
   - Scenario B: reversal
   - Scenario C: wait
   - Scenario D: cancellation

Output:

- `signal`
- `confidence`
- `scenario`
- `explanation`
- `invalidation`
- `expectedPath`
- `timingScore`
- `riskScore`

Scenario values:

- `CONTINUE`
- `REVERSE`
- `WAIT`
- `CANCEL`

`kalos-market-brain` must use probability, hypothesis and confidence language.
It must never present certainty as fixed outcome, never display 100% certainty,
never activate LIVE and never execute an order.

## Future Path Engine

`future-path-engine` is the KALOS visual timeline engine. It reads the KALOS
decision and Market Brain scenario, then draws several probable future paths.

Visual paths:

- Green path: main scenario.
- Blue path: alternative scenario.
- Grey path: cancelled scenario.

Each path displays:

- probability
- estimated time
- objective
- invalidation level

Example visual split:

- Path A: 72%
- Path B: 21%
- Path C: 7%

Display rules:

- if confidence is below 70, display `WAIT`
- if scenarios conflict, display `INCERTAIN`
- if data is weak, display `DATA LOW`
- never display `100%`

`future-path-engine` is visual-only. It cannot activate LIVE, connect a real
account or execute an order.

## Market Replay

Market Replay is the KALOS replay mode. It replays historical or mock candle
steps and shows what KALOS saw at one precise instant.

Replay controls:

- play market replay
- rewind
- fast-forward
- pause

Replay interface:

- `Prediction`
- `Actual Result`
- `Difference`

Replay metrics:

- win simulation
- loss simulation
- drawdown
- precision

Market Replay is simulation-only. It must never connect a real account,
activate LIVE or execute a real order.

## Market Structure Detection

KALOS prepares detection for:

- HH
- HL
- LH
- LL
- BOS
- CHoCH
- Breakout
- Retest
- Support
- Resistance

These detections are journalable analysis signals. They are not trade commands.

## Smart Money Detection

KALOS prepares detection for:

- Liquidity Sweep
- Buy Side Liquidity
- Sell Side Liquidity
- Order Block
- Fair Value Gap
- Strong High
- Weak Low
- Supply Zone
- Demand Zone

Smart Money objects can be converted into chart overlays and reasons, but they
must not bypass risk validation.

## Synthetic Indices Context

KALOS supports a Deriv synthetic indices context through
`backend/src/modules/synthetic-indices/`.

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

Synthetic market context must be interpreted differently from forex, metals or
classic indices. It carries a family classification:

- `BOOM`
- `CRASH`
- `VOLATILITY`

Synthetic analysis remains MOCK/DEMO-first and cannot connect a real Deriv
account by default.

## FrappeDollar Strategy Context

FrappeDollar is a volatile synthetic-market strategy context under
`backend/src/modules/frappe-dollar/`. It consumes KALOS structure, Smart Money
and volatility context to detect:

- strong impulse
- candle acceleration
- BOS break
- CHoCH confirmation
- liquidity sweep
- probable continuation
- SL/TP distance
- false-signal risk

FrappeDollar output:

- `signalType`: `BOOM`, `CRASH`, `VOLATILITY_MOVE`
- `direction`: `BUY`, `SELL`, `WAIT`
- `confidence`
- `entryZone`
- `stopLoss`
- `takeProfit`
- `invalidation`
- `reason`
- `visualMarker`

FrappeDollar must not execute. It must journal every signal and preserve WAIT
or rejected states when the market is unreadable.

## Chart Overlay Objects

KALOS overlay output supports:

- labels BOS / CHoCH
- BUY / SELL arrows
- KALOS signal ball
- TP / SL zones
- invalidation zone
- probable projection
- liquidity zones
- accepted/refused coloring

Overlay objects are visual-only and must be safe to render in MOCK or DEMO mode.

## Modes

Market strategy modes:

- SCALPING
- SHORT_TERM
- LONG_TERM

Control modes:

- MANUAL
- SEMI_AUTO
- AUTO

AUTO remains a planned control mode only. LIVE stays OFF unless explicit future
owner approval and production gates are present.

## Output Contract

KALOS output must include:

- `decision`: BUY / SELL / WAIT / NO_TRADE
- `confidence`
- `reasons`
- `rejectedReasons`
- `sl`
- `tp`
- `invalidation`
- `trend`
- `volatility`
- `riskScore`
- `overlayObjects`
- `marketBrain`
- `futurePath`
- `marketReplay`

Compatibility aliases can remain while older modules migrate:

- `signal` mirrors `decision`
- `risk_score` mirrors `riskScore`

## Blocking Rules

KALOS blocks executable directional signals when:

- confidence is below 80
- SL is absent
- TP is absent
- market state is too chaotic
- data is not fresh enough

Confidence is capped at 95. KALOS must never display 100% certainty.

## Safety Invariants

- No gain promise.
- No guaranteed outcome.
- No real account connection from KALOS.
- No LIVE activation from KALOS.
- No real order execution from KALOS.
- No future-path display at 100%.
- No future-path LIVE activation or execution.
- No Market Replay execution; replay is simulation-only.
- No FrappeDollar trade context without SL.
- No FrappeDollar trade context without TP.
- No synthetic-index signal when the market is unreadable.
- No LIVE auto-execution for synthetic indices or FrappeDollar.
- Every FrappeDollar signal is journalable.
- Risk Engine and No-Trade Engine remain mandatory.
- Journal records accepted, refused, WAIT and NO_TRADE decisions.

## Frontend Boundary

`frontend/kalos/` owns mock KALOS visual intelligence panels and display helpers:

- feature lists for market structure and Smart Money
- `KALOS THINKING…` / market-brain scenario panel
- `future-path-engine` visual timeline panel
- Market Replay controls and Prediction / Actual Result / Difference panel
- output field summary
- mode summary
- overlay object preview
- safety-rule preview

These components are cockpit UI only. They do not call broker APIs or trigger
execution.

## Backend Boundary

`backend/src/modules/kalos/` owns typed analysis outputs:

- market structure detections
- Smart Money detections
- synthetic-index market specs
- FrappeDollar signal contracts
- market-brain scenario interpretation
- future-path visual timeline
- market replay frames and simulation metrics
- trend and volatility context
- rejection reasons
- overlay objects
- final decision and confidence cap

The backend module exposes analysis data to other safe modules such as
Backtesting, Journal, Risk and cockpit read-only endpoints.
