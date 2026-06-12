# RAZON MVP v1 - Next Steps

## Global Decision

Current status: READY for controlled MVP demo

RAZON can be demonstrated in a controlled MOCK/DEMO context. Production and
LIVE trading remain forbidden.

## Completed Stabilization Actions

1. Global TypeScript errors were fixed.

   Files:

   - `server/services/kalos/indicators.ts`
   - `server/services/market/marketProvider.ts`
   - `server/services/razonMarketDataService.ts`

   Validation:

   ```bash
   pnpm check
   ```

2. Dependency audit issues were remediated.

   Validation:

   ```bash
   pnpm audit --audit-level moderate
   ```

   Result:

   - no known vulnerabilities

3. Frontend environment variables were reviewed for the known Forge key issue.

   Confirm that no sensitive API key is exposed through:

   - `VITE_*`
   - `PUBLIC_*`
   - `NEXT_PUBLIC_*`

## Remaining Warnings Before Wider Demo

1. Add frontend MVP tests.

   Minimum coverage:

   - cockpit renders
   - LIVE OFF is visible
   - MOCK / DEMO / LIVE labels are visible
   - Emergency Stop is visible
   - dangerous buttons require confirmation

2. Harden production security policy.

   - keep weak local encryption fallback disabled in production
   - configure CORS allowlist
   - configure CSP/security headers
   - validate rate limiting
   - validate incident response

3. Repeat release verification before every demo.

   Required commands:

   ```bash
   pnpm check
   pnpm run build
   pnpm exec vitest run --config backend/tests/vitest.config.mjs
   pnpm audit --audit-level moderate
   ```

## Allowed Controlled MVP Demo Scope

A controlled MVP demo may show:

- dashboard/cockpit
- KALOS analysis
- confidence capped at 95
- WAIT and NO_TRADE decisions
- backtesting report with mock or historical data
- journal and audit trail
- Risk Engine refusal
- No-Trade Engine refusal
- connector health with MOCK/DEMO/LIVE labels
- LIVE disabled

The demo must use MOCK or DEMO context only.

## Forbidden Before Validation

- enabling LIVE trading
- connecting real broker credentials in the frontend
- placing real orders
- enabling AUTO execution
- removing Risk Engine validation
- removing No-Trade Engine validation
- disabling journal requirements
- presenting backtest results as guaranteed future performance
- claiming production readiness

## Recommended Feature Phases After MVP Demo

1. Economic Calendar Engine
2. News/Event Shield
3. Watchlist Market Radar
4. Alert Engine
5. Replay Engine
6. Chart Overlay Engine
7. Strategy Preset Engine
8. Read-only backend endpoints for cockpit data
9. Durable database-backed journal and backtest storage
10. DEMO connector validation

## Keep READY Status Criteria

Keep controlled-demo READY status only while:

- all mandatory actions are closed
- `pnpm check` passes
- tests pass
- build passes
- audit is clean enough for demo approval
- LIVE remains disabled
- MOCK/DEMO/LIVE labels are visible
- Risk Engine, No-Trade Engine and Journal gates remain active
