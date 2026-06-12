# RAZON - Execution Roadmap

Version: Final Documentation
Status: Active
Priority: Execution Discipline

## Roadmap Rule

Never build several critical layers at the same time.

```text
Foundation -> Validation -> Extension
```

If a phase fails, stop, fix it, then continue. Do not build on an unstable
foundation.

## Global Success Conditions

Before production:

- reliable data
- stable analysis
- Risk Engine validated
- No-Trade Engine validated
- Journal active
- Backtesting complete
- DEMO mode validated
- no critical bugs
- no critical/high dependency risk
- LIVE disabled until explicit approval

## Completed Foundations

### Phase 0 - Structure

- Repository structure created.
- Documentation folders created.
- `.env.example` created.
- Architecture and ADR documentation created.

### Phase 2 - Contracts And Domain Model

- Core contracts created.
- Market, trade, signal, timeframe, connector and risk types created.
- Constants and errors created.
- Synthetic Indices and FrappeDollar contracts prepared as analysis-only
  module types.

### Connectors

- MT5 boundary.
- Deriv boundary.
- Forex boundary.
- TradingView boundary.
- Mock connector.
- Common connector service and health service.
- Execution functions prepared but blocked.

### Market Data Observability Design

- Market Data Health Model documented.
- Data Quality Rules documented.
- KALOS Data Guard contract documented.
- Dashboard market data metrics specified.
- Typed contracts documented in `docs/architecture/market-observability.md`.
- No Deriv or MT5 connector implementation added by this phase.
- LIVE remains OFF and execution remains unavailable.

### KALOS Engine

- Feature modules created:
  - market_structure
  - market_brain
  - future_path_engine
  - market_replay
  - liquidity
  - trend
  - momentum
  - volatility
  - entry_score
  - no_trade
  - explanations
- Outputs: BUY, SELL, WAIT, NO_TRADE.
- Confidence cap: 95.
- Historical calibration added.
- HTF / MTF / LTF analysis included.
- `kalos-market-brain` interpretation contract added for context, intention,
  liquidity and scenario generation.
- `future-path-engine` visual timeline contract added for green, blue and grey
  probable path display.
- Market Replay contract added for Prediction / Actual Result / Difference and
  simulation metrics.
- No real execution.

### Backtesting Engine

- Backtest service, runner, metrics, report and repository created.
- Historical/mock candle replay.
- KALOS signal evaluation.
- Simulated trades and NO_TRADE records.
- JSON reports with required metrics.

### Journal And Audit

- Journal service and repository created.
- Audit service created.
- BUY, SELL, WAIT, NO_TRADE, errors and backtests logged.
- NO_TRADE stored as a valid decision.

### Risk Engine And No-Trade Engine

- Position size calculation.
- ATR stop calculation.
- Drawdown validation.
- Risk validation.
- No-Trade blocking and explanations.
- Martingale forbidden.
- Execution without SL/TP forbidden.
- MOCK execution forbidden.

### Execution Engine

- Order preparation.
- Order validation.
- BUY/SELL/close/update/trailing/cancel functions prepared.
- LIVE disabled by default.
- Journal, Risk, No-Trade and connector gates required.

### Dashboard / Cockpit

- Main dashboard.
- KALOS panel.
- Market chart.
- Kalos Overlay Engine mock labels prepared on chart.
- Chart Context Menu mock actions prepared without execution.
- Connectors page.
- Journal page.
- Risk status.
- Settings.
- Required cockpit components.

### Mobile / PWA

- Responsive cockpit.
- Mobile bottom navigation.
- Mobile trading/risk/KALOS/connector/emergency components.
- Manifest, icons and offline fallback.

### Explainable AI

- AI advisory service.
- Pattern discovery.
- Confidence learning.
- Improvement reports.
- AI audit.
- No autonomous execution.

### Security / Monitoring

- Security service.
- Encryption service.
- API key vault.
- Auth and permissions guards.
- Rate limiting.
- Security audit.
- Data Mode Control module prepared for protected REAL_DATA / DEMO_DATA changes.
- Data-mode audit module prepared for applied and blocked control changes.
- Settings > Confidentialite & Securite contains the protected data mode surface.
- Dashboard remains read-only for data-mode visibility and has no DEMO/REAL
  switch.
- Health, system status, incident and fail-safe services.
- Production checklist and incident response docs.

## Current QA Status

OK:

- Backend RAZON module tests passed.
- `backend/src` compiles in targeted strict validation.
- Frontend cockpit compiles in targeted validation.
- Vite build passes.
- Full application build passes.
- Global `pnpm check` passes.
- Expected RAZON files are present.
- KALOS confidence is capped at 95.
- LIVE is disabled by default.
- Risk Engine, No-Trade Engine and Journal are integrated into execution
  validation.
- Market Data Observability design contracts are documented for DEMO readiness.

Critical items to fix:

- Dependency audit reports vulnerabilities.

Warnings:

- No dedicated frontend test suite yet.
- Production encryption must not rely on local fallback.
- Public frontend env variables must be reviewed to avoid sensitive API keys.
- `.env.example` flags must not imply that Risk Engine can be disabled in
  production.

## Gates Before New Feature Work

Do not open a new functional phase until:

- `pnpm check` passes globally.
- `pnpm run build` passes.
- `pnpm exec vitest run --config backend/tests/vitest.config.mjs` passes.
- Dependency audit critical/high items are fixed or formally accepted.
- `.env.example` keeps LIVE off by default.
- `.env.example` keeps DATA_MODE and DEFAULT_DATA_MODE on DEMO_DATA by default.
- Secrets remain backend-only.
- MOCK / DEMO / LIVE labels remain visible.
- REAL_DATA / DEMO_DATA labels remain visible.
- DEMO/REAL switching remains available only from Settings > Confidentialite &
  Securite.
- Data Mode Control blocks changes during active analysis, active trade workflow
  or Emergency Stop.
- Risk Engine and No-Trade Engine remain mandatory.
- Journal remains mandatory.

## Priority Corrections

1. Fix `server/services/market/marketProvider.ts` Deriv union narrowing if it
   reappears in provider-backed QA.
2. Fix nullable numeric inputs in `server/services/razonMarketDataService.ts`
   if live provider responses expose gaps.
3. Upgrade vulnerable dependencies.
4. Add frontend tests for cockpit, mobile states, Kalos overlays and context
   menu mock behavior.
5. Disable or remove weak encryption fallback in production.
6. Review all `VITE_*` variables for sensitive data exposure.
7. Add frontend tests for the 3-step Data Mode Control confirmation and blocked
   mode-change states.
8. Implement Market Data Observability contracts before connecting Deriv DEMO
   or MT5 DEMO feeds.

## Future Modules

These modules are documented and should be implemented after QA gates:

### Market Data Observability

Priority: P0

Role: evaluate provider-backed market data before KALOS trusts it.

Structure:

- `backend/src/modules/market-observability/`

Reference:

- `docs/architecture/market-observability.md`

Health model:

- latencyMs
- freshnessSeconds
- missingCandles
- spreadQuality
- tickRate
- sourceStatus
- syncStatus

Quality states:

- HEALTHY
- DEGRADED
- STALE
- INVALID
- DISCONNECTED

KALOS Data Guard:

- old data forces NO_TRADE.
- abnormal spread forces WAIT.
- candle gaps display DATA_LOW.
- unknown source sets INVALID.

Dashboard metrics:

- Data Source
- Data Quality
- Last Candle
- Last Tick
- Latence
- Freshness

Dependencies:

- Connectors provide read-only market snapshots in MOCK or DEMO.
- Market Aggregator attaches observability to normalized ticker/candle data.
- KALOS consumes data guard output before directional analysis.
- Journal records quality guard reasons.
- Dashboard displays metrics without exposing secrets.

Rules:

- No connector implementation in the design phase.
- No LIVE activation.
- No order creation.
- `ENABLE_LIVE_TRADING=false`, `ALLOW_AUTO_EXECUTION=false` and
  `MODE_SIMULATION=true` remain required defaults.

Recommended phase: immediately before Deriv DEMO read-only implementation and
before MT5 DEMO bridge work.

### Economic Calendar Engine

Priority: P0

Role: detect macroeconomic event windows that affect volatility, spread and
setup validity.

Dependencies:

- KALOS consumes event context to reduce confidence or force WAIT/NO_TRADE.
- Risk Engine uses event windows to tighten or refuse risk.

Recommended phase: before production execution and before serious LIVE testing.

### News/Event Shield

Priority: P0

Role: protect against unscheduled news and fundamental shocks.

Dependencies:

- KALOS includes shield status in reasons.
- Risk Engine refuses or reduces risk when shield is critical.

Recommended phase: immediately after Economic Calendar.

### Watchlist Market Radar

Priority: P1

Role: scan markets and rank candidates without generating BUY/SELL.

Dependencies:

- KALOS receives candidates.
- Risk Engine filters by spread, volatility, exposure and drawdown.

Recommended phase: before advanced backtesting expansion.

### Alert Engine

Priority: P1

Role: notify users without executing.

Dependencies:

- KALOS provides signal context.
- Risk Engine can downgrade or block alerts.

Recommended phase: after cockpit stabilization.

### Replay Engine

Priority: P1

Role: replay historical or mock market sequences for inspection and audit.
Market Replay shows what KALOS saw at a precise instant.

Controls:

- replay market
- rewind
- fast-forward
- pause

Interface:

- Prediction
- Actual Result
- Difference

Metrics:

- win simulation
- loss simulation
- drawdown
- precision

Dependencies:

- KALOS reconstructs decisions.
- Risk Engine validates what would have been blocked.
- Replay remains simulation-only and cannot execute real orders.

Recommended phase: before advanced backtesting and education workflows.

### Kalos Overlay Engine

Priority: P2

Role: display BOS, CHoCH, Liquidity Sweep, Strong High, Weak Low, Entry Zone,
TP, SL, Invalidation, Trend Projection, Buy/Sell Arrow and Signal Ball on
charts.

Dependencies:

- KALOS supplies analysis overlays.
- Risk Engine supplies risk overlays and blocked states.
- Journal stores visible overlay context for accepted, refused and WAIT
  decisions.

Recommended phase: after cockpit and chart stabilization.

### Kalos Market Brain

Priority: P1

Role: interpret market context after KALOS detection. It reads candles, swings,
volatility, impulse and trend; builds HH/HL/LH/LL/BOS/CHoCH structure; detects
accumulation, distribution, manipulation, expansion or consolidation; verifies
BSL, SSL, sweep, grab and fake breakout; then generates a scenario.

Structure:

- `backend/src/modules/kalos/market-brain/`

Output:

- `signal`
- `confidence`
- `scenario`: CONTINUE, REVERSE, WAIT or CANCEL.
- `explanation`
- `invalidation`
- `expectedPath`
- `timingScore`
- `riskScore`

UI:

- `KALOS THINKING…`
- Structure BULLISH / BEARISH.
- Confidence XX%.
- Scenario CONTINUE / REVERSE / WAIT.
- Reason text using probability, hypothesis and confidence language.

Rules:

- No guaranteed outcome language.
- No 100% certainty.
- Confidence below 80 keeps direction in WAIT.
- Missing SL or TP blocks directional interpretation.
- Chaotic market or stale data cancels the scenario.
- LIVE remains OFF and no order can be executed.

Recommended phase: before advanced overlay, replay and synthetic-index
validation, because it turns detections into explanations.

### Future Path Engine

Priority: P1

Role: draw several probable future paths from the KALOS decision and Market
Brain scenario.

Structure:

- `backend/src/modules/kalos/future-path-engine/`

Visual paths:

- Green path: main scenario.
- Blue path: alternative scenario.
- Grey path: cancelled scenario.

Each path displays:

- probability
- estimated time
- objective
- invalidation level

Example:

- Path A: 72%.
- Path B: 21%.
- Path C: 7%.

Rules:

- Confidence below 70 displays WAIT.
- Scenario conflict displays INCERTAIN.
- Weak data displays DATA LOW.
- Never display 100%.
- No LIVE activation, no real account connection and no real order execution.

Recommended phase: with KALOS visual intelligence and before replay polish,
because it turns scenarios into readable visual timelines.

### Synthetic Indices Engine

Priority: P1

Role: prepare analysis support for Boom 500, Boom 1000, Crash 500, Crash 1000
and Volatility 10/25/50/75/100.

Structure:

- `backend/src/modules/synthetic-indices/`

Dependencies:

- Connectors provide read-only synthetic index candles/ticks in MOCK or DEMO.
- KALOS receives synthetic index context without assuming forex behavior.
- Risk Engine validates volatility-specific spread, slippage, SL and exposure
  rules.
- Deriv symbols are typed but no real account is connected by this phase.

Recommended phase: after connector QA and before any synthetic-index DEMO
validation. No real account connection is allowed in this phase.

### FrappeDollar Engine

Priority: P1

Role: volatile-market strategy for Deriv synthetic indices that detects strong
impulse, candle acceleration, BOS break, CHoCH confirmation, liquidity sweep,
probable continuation, SL/TP distance and false-signal risk.

Structure:

- `backend/src/modules/frappe-dollar/`

Output:

- `signalType`: BOOM, CRASH or VOLATILITY_MOVE.
- `direction`: BUY, SELL or WAIT.
- `confidence`, `entryZone`, `stopLoss`, `takeProfit`, `invalidation`,
  `reason`, `visualMarker`.

Dependencies:

- KALOS provides structure and momentum context.
- Kalos Overlay Engine renders the visual signal without executing.
- Risk Engine refuses any setup without SL or with unsafe volatility exposure.
- No-Trade Engine can force WAIT/NO_TRADE during chaotic movement.
- Journal stores every FrappeDollar signal, including WAIT and rejected states.
- LIVE auto-execution remains forbidden.

Recommended phase: after Kalos Overlay Engine and Synthetic Indices Engine mock
validation.

### Chart Context Menu

Priority: P2

Role: right-click chart menu for refresh data, recalculate signal, show/hide
Kalos, show/hide overlays, change timeframe and manual/semi-auto/auto mode.

Dependencies:

- Frontend maintains mock/local menu state.
- Backend exposes read-only refresh/recalculate endpoints only after QA.
- Execution Engine remains unreachable from context menu actions.
- LIVE stays disabled until explicit owner approval.

Recommended phase: after chart stabilization and before advanced cockpit
workflow polish.

### Strategy Preset Engine

Priority: P1

Role: version controlled presets for SCALPING, SHORT_TERM and LONG_TERM without
unsafe auto-optimization.

Dependencies:

- KALOS consumes thresholds and timeframe policy.
- Risk Engine validates preset safety.

Recommended phase: before user-configurable strategies.

## Production Path

1. Fix QA Critical items.
2. Add frontend tests.
3. Complete dependency remediation.
4. Add read-only backend endpoints for cockpit status.
5. Implement Market Data Observability and KALOS Data Guard.
6. Add Economic Calendar and News/Event Shield.
7. Validate expanded backtesting and replay.
8. Validate DEMO mode.
9. Complete production security checklist.
10. Keep LIVE disabled until explicit owner approval.

## Final Rule

RAZON should survive before it optimizes.

No new feature is worth weakening Risk Engine, No-Trade Engine, Journal,
Emergency Stop or secret handling.
