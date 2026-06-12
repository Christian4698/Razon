# Backend Architecture

RAZON backend is organized as a modular TypeScript service layer. Each engine
has a narrow responsibility, typed inputs/outputs, and tests where risk is high.

## Global Flow

```text
Data Mode Control
  -> Connectors
  -> Market data / candles / ticks / spread
  -> KALOS analysis
  -> kalos-market-brain interpretation
  -> future-path-engine visual timeline
  -> market-replay simulation
  -> Kalos Overlay / Synthetic Indices / FrappeDollar analysis context
  -> Risk Engine validation
  -> No-Trade Engine blocking
  -> Journal / Audit
  -> Execution Engine only when authorized
  -> Monitoring / Security / Fail-safe
```

Execution is intentionally the last step. Analysis must never bypass Risk,
No-Trade or Journal.

## Core Layer

`backend/src/core` contains:

- `contracts`: stable interfaces for market, analysis, risk, execution,
  connector, journal, KALOS and probability boundaries.
- `types`: market, trade, signal, timeframe, connector and risk domain types.
- `constants`: timeframes, confidence and risk defaults.
- `errors`: market and execution error definitions.

The core layer should remain implementation-light. It defines language and
contracts before business logic.

## Modules

- `kalos`: probabilistic analysis engine. Produces BUY, SELL, WAIT or
  NO_TRADE with confidence, reasons, TP, SL, invalidation, volatility and
  risk score. Confidence is capped at 95.
- `kalos-market-brain`: KALOS interpretation submodule. Reads candles, swings,
  volatility, impulse and trend; builds HH/HL/LH/LL/BOS/CHoCH structure;
  detects accumulation, distribution, manipulation, expansion or consolidation;
  verifies BSL, SSL, sweep, grab and fake breakout; and returns `signal`,
  `confidence`, `scenario`, `explanation`, `invalidation`, `expectedPath`,
  `timingScore` and `riskScore`.
- `future-path-engine`: KALOS visual timeline submodule. Draws green, blue and
  grey probable paths for main, alternative and cancelled scenarios. Each path
  carries probability, estimated time, objective and invalidation level. It
  displays WAIT below 70 confidence, INCERTAIN on conflict and DATA LOW when
  data is weak. It never displays 100%.
- `market-replay`: KALOS replay submodule. Replays candles and shows what
  KALOS saw at a precise instant with Prediction, Actual Result and Difference
  panels. It calculates win simulation, loss simulation, drawdown and precision.
  It is simulation-only and does not execute.
- `kalos-overlay`: planned chart annotation engine. Displays BOS, CHoCH,
  Liquidity Sweep, Strong High, Weak Low, Entry Zone, TP, SL, Invalidation,
  Trend Projection, Buy/Sell Arrow and Signal Ball. It is visual only and does
  not execute.
- `synthetic-indices`: planned analysis support for Boom 500, Boom 1000, Crash
  500, Crash 1000 and Volatility 10/25/50/75/100. It remains MOCK/DEMO-first
  and must not connect a real account by default. The module owns typed Deriv
  synthetic market specs, provider symbols, family classification and
  synthetic risk envelopes.
- `frappe-dollar`: planned volatile-market strategy engine. Detects
  strong impulse, candle acceleration, BOS break, CHoCH confirmation, liquidity
  sweep, probable continuation, SL/TP distance and false-signal risk. Its
  output contract includes `signalType`, `direction`, `confidence`,
  `entryZone`, `stopLoss`, `takeProfit`, `invalidation`, `reason` and
  `visualMarker`.
- `chart-context-menu`: planned cockpit command boundary for right-click chart
  actions: refresh data, recalculate signal, show/hide Kalos, show/hide
  overlays, change timeframe and manual/semi-auto/auto mode. Commands are
  read-only/mock until future safety gates are approved.
- `data-mode`: protected control boundary for switching between `REAL_DATA`
  and `DEMO_DATA`. It requires 3-step confirmation, exact `JE COMPRENDS`
  phrase, blocks during active analysis/trade workflow and gives Emergency Stop
  priority.
- `audit`: control-plane audit boundary for data-mode requests, blocked
  changes and applied changes.
- `risk`: capital protection. Validates position size, risk per trade, RR,
  SL/TP, drawdown, exposure, spread, slippage, journal and MOCK restrictions.
- `no-trade`: refusal engine. Converts low confidence, poor RR, dangerous
  spread/slippage, abnormal volatility, missing data, drawdown, chaotic market,
  disabled AUTO or Risk refusal into explicit block reasons.
- `backtesting`: historical/mock replay of candles, simulated KALOS signals,
  metrics and JSON reports. No broker connection is required.
- `journal`: records every BUY, SELL, WAIT, NO_TRADE, error, backtest and audit
  trail entry. NO_TRADE is stored as a valid decision.
- `execution`: prepares, validates and logs orders. LIVE is disabled by default
  and MOCK execution is forbidden.
- `connectors`: MT5, Deriv, Forex, TradingView and Mock boundaries. Execution
  functions are prepared but blocked unless future safety gates allow them.
- `ai`: explainable advisory module. It analyzes journal/backtests and proposes
  recommendations without executing or weakening risk rules.
- `security`: encryption, API key vault, auth, permissions, rate limit and
  security audit.
- `monitoring`: health, system status, incidents and fail-safe state.

## Runtime Modes

- `MOCK`: simulated or unavailable real source. Must be clearly labeled.
  Execution is forbidden.
- `DEMO`: demo/paper-like context. Execution remains guarded.
- `LIVE`: real context. Disabled unless `ENABLE_LIVE_TRADING=true` and manual
  production confirmation are present.

Data modes:

- `DEMO_DATA`: simulated data context. Labels must show `DEMO_MODE`, `MOCK` and
  `NO REAL IMPACT`.
- `REAL_DATA`: broker/API data context for analysis. It does not activate LIVE
  and does not allow execution while LIVE is OFF.

Trading modes:

- `MANUAL`: user-controlled.
- `SEMI_AUTO`: RAZON validates and prepares; user confirms.
- `AUTO`: future controlled mode; disabled by default.

Market modes:

- `SCALPING`
- `SHORT_TERM`
- `LONG_TERM`

## Safety Invariants

- KALOS analyzes, it does not execute.
- kalos-market-brain explains probability, hypothesis and confidence; it does
  not promise certainty or execute.
- future-path-engine draws visual probability paths only; it does not activate
  LIVE, connect real accounts or execute.
- market-replay replays simulation context only; it does not activate LIVE,
  connect real accounts or execute.
- Data Mode Control is available only from Settings > Confidentialite &
  Securite.
- Data Mode Control must not be exposed as a dashboard switch.
- `REAL_DATA` and `DEMO_DATA` labels must stay visible in the cockpit.
- Changing data mode must be audited even when blocked.
- Kalos Overlay Engine displays annotations only.
- Synthetic Indices Engine and FrappeDollar Engine are analysis-only until
  DEMO validation and explicit production approval.
- FrappeDollar cannot emit an executable signal without SL and TP.
- FrappeDollar must return WAIT or rejected context when the market is
  unreadable.
- Every FrappeDollar signal must be journalable.
- FrappeDollar never enables LIVE auto-execution.
- Chart Context Menu must not reach order placement or real account actions.
- AI advises, it does not execute.
- Risk Engine protects capital and cannot be bypassed.
- No-Trade Engine can block any setup.
- Journal must be available before execution.
- Emergency Stop and persistent Kill Switch must stop execution.
- Martingale and automatic risk increase after loss are forbidden.
- No order can exist without SL and TP.
- MOCK source blocks execution.
- LIVE source requires explicit enablement and confirmation.

## Backend Commands

Run the current server shell:

```bash
pnpm dev
```

Run backend module tests:

```bash
pnpm exec vitest run --config backend/tests/vitest.config.mjs
```

Run full TypeScript check:

```bash
pnpm check
```

Current QA note: `pnpm check`, backend module tests and `pnpm run build` pass in
the current workspace.

## Future Modules

Documented but not implemented yet:

- Economic Calendar Engine
- News/Event Shield
- Watchlist Market Radar
- Alert Engine
- Replay Engine
- Market Replay
- Future Path Engine
- Kalos Overlay Engine
- Synthetic Indices Engine
- FrappeDollar Engine
- Chart Context Menu
- Strategy Preset Engine

These modules should be added before any serious LIVE workflow because they
improve context, safety, explainability and user control.
