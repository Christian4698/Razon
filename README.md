# RAZON

RAZON is a professional trading analysis platform built around probabilistic
market reading, explainable decisions, capital protection, and controlled
execution.

RAZON is not a magic predictor and not a raw BUY/SELL generator. Its operating
sequence is:

```text
Observe -> Understand -> Filter -> Justify -> Validate Risk -> Journal -> Execute only if authorized
```

The best trade is not the one with the biggest promise. The best trade is the
one that deserves to exist.

## Current Status

The repository now contains the main RAZON foundations:

- domain contracts and strict core types
- KALOS probabilistic engine
- Risk Engine and No-Trade Engine
- Backtesting Engine
- Journal and Audit Engine
- controlled Execution Engine
- MT5, Deriv, Forex, TradingView and Mock connector boundaries
- cockpit dashboard with mobile-ready/PWA structure
- Explainable AI advisory module
- security and monitoring modules

Important: LIVE trading remains disabled by default. No real broker order should
be possible unless production safety gates are explicitly completed and
`ENABLE_LIVE_TRADING=true` is configured in a controlled environment.

## Architecture

```text
backend/src/core
  contracts, types, constants, errors

backend/src/modules
  kalos, risk, no-trade, backtesting, journal, execution,
  connectors, ai, security, monitoring

frontend
  cockpit pages, dashboard panels, mobile components

client
  current Vite/React shell that renders the RAZON cockpit

infrastructure
  security documentation, production checklist, incident response

storage
  logs, market data, journal exports, snapshots
```

The existing `server/`, `client/`, and `shared/` folders are still present. The
new RAZON backend modules live under `backend/src`.

## Modes

Trading control modes:

- `MANUAL`: the user decides and confirms actions.
- `SEMI_AUTO`: RAZON prepares and validates, the user confirms execution.
- `AUTO`: future controlled mode; must remain disabled until production gates are
  validated.

Market strategy modes:

- `SCALPING`: fast context, normally M1/M5/M15.
- `SHORT_TERM`: intraday/swing context, normally M15/M30/H1.
- `LONG_TERM`: broader context, normally H1/H4/D1.

Runtime data modes:

- `MOCK`: simulated data, execution forbidden.
- `DEMO`: broker/demo or paper-like source, execution still guarded.
- `LIVE`: real context, disabled by default.

## Core Modules

- KALOS analyzes market structure, liquidity, trend, momentum, volatility,
  entry score and no-trade context. Output is `BUY`, `SELL`, `WAIT` or
  `NO_TRADE`, with confidence capped at 95.
- Risk Engine validates position size, RR, SL/TP, drawdown, exposure, spread,
  slippage, journal availability and MOCK restrictions.
- No-Trade Engine turns weak or dangerous conditions into explicit refusals.
- Backtesting Engine replays historical or mock candles and reports simulated
  signals, trades, metrics and recommendations.
- Journal records BUY, SELL, WAIT, NO_TRADE, errors, backtests and audit trail.
- Execution Engine prepares and validates orders, but blocks LIVE by default and
  blocks MOCK execution.
- Connectors isolate MT5, Deriv, Forex, TradingView and Mock data sources.
- AI Engine analyzes history and suggests improvements only. It never executes,
  never weakens Risk Engine and never replaces KALOS.
- Security and Monitoring protect secrets, permissions, rate limits, incidents,
  fail-safe state and health status.

## Environment

Create a local `.env` from `.env.example`.

Required groups:

- application: `NODE_ENV`, `APP_PORT`, `API_PORT`, URLs
- runtime safety: `MODE_SIMULATION`, `ENABLE_LIVE_TRADING`,
  `ALLOW_AUTO_EXECUTION`
- security: `APP_SECRET_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY`, CORS/rate limits
- database: `DATABASE_URL`
- storage: `STORAGE_ROOT`, journal, market and snapshot paths
- connectors: `MT5_*`, `DERIV_*`, `FOREX_API_*`
- risk: max risk, drawdown, RR, kill switch, emergency stop
- journal/backtesting: audit and report paths

Never put broker credentials in frontend public variables such as `VITE_*`,
`PUBLIC_*` or `NEXT_PUBLIC_*`.

## Install

```bash
pnpm install
```

## Run Backend

The current backend shell is the existing server entrypoint:

```bash
pnpm dev
```

The RAZON module services under `backend/src/modules` are internal TypeScript
services and are currently validated by tests rather than exposed as a complete
HTTP API.

## Run Frontend

For the cockpit UI through Vite:

```bash
pnpm exec vite --host 0.0.0.0
```

The Vite build output is generated with:

```bash
pnpm exec vite build
```

## Tests And Validation

Run RAZON backend module tests:

```bash
pnpm exec vitest run --config backend/tests/vitest.config.mjs
```

Run the full application build:

```bash
pnpm run build
```

Run TypeScript validation:

```bash
pnpm check
```

Current QA note: `backend/src` and the frontend cockpit compile, but the global
`pnpm check` still reports legacy TypeScript issues in `server/services/*`.
Those must be corrected before production.

Run dependency audit:

```bash
pnpm audit --audit-level moderate
```

Current QA note: dependency vulnerabilities were detected during global QA and
must be fixed before production hardening is considered complete.

## Safety Rules

- NO_TRADE is a valid decision.
- Capital protection has priority over performance.
- Confidence is never certainty.
- KALOS confidence is capped at 95.
- Analysis and execution are separate responsibilities.
- Risk Engine and No-Trade Engine must validate before execution.
- Journal availability is mandatory before execution.
- MOCK data must never be used for execution.
- LIVE trading is disabled by default.
- Martingale and automatic risk increase after loss are forbidden.
- API keys and account credentials must never be exposed to frontend or logs.

## Current Limitations

- Full TypeScript check fails in legacy `server/services/*` files.
- Dependency audit currently reports vulnerabilities that need upgrades.
- Frontend has build validation but no dedicated frontend test suite yet.
- Live broker execution is intentionally not active.
- Economic Calendar, News/Event Shield, Watchlist Radar, Alert Engine, Replay
  Engine, Chart Overlay Engine and Strategy Preset Engine are documented future
  modules, not implemented modules.
- Production encryption must not rely on the local fallback path.

## Next Phases

Recommended next work:

- fix global TypeScript errors
- update vulnerable dependencies
- add frontend tests
- connect read-only backend endpoints for cockpit status
- implement Economic Calendar and News/Event Shield before any live workflow
- complete production-grade secret storage and deployment hardening
- only then evaluate controlled DEMO, then strictly gated LIVE readiness

## Documentation

Start here:

- `docs/RAZON_SKILL.md`
- `docs/RAZON_SPEC.md`
- `docs/RAZON_TASKS.md`
- `docs/architecture/`
- `infrastructure/security/PRODUCTION_CHECKLIST.md`
