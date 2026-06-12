# RAZON MVP v1 - Known Limitations

## Global Status

Status: READY for controlled MVP demo with restrictions.

The RAZON modules are in place and tested for a controlled MVP demo. Production
readiness is still out of scope.

## Resolved Stabilization Blockers

### Global TypeScript Check Fails

`pnpm check` previously failed in legacy `server/services/*` files:

- `server/services/kalos/indicators.ts`
- `server/services/market/marketProvider.ts`
- `server/services/razonMarketDataService.ts`

Status:

- Fixed.
- `pnpm check` now passes globally.

### Dependency Vulnerabilities

`pnpm audit --audit-level moderate` previously reported critical/high issues.

Status:

- Fixed for MVP stabilization.
- Audit now reports no known vulnerabilities.

## Security Limitations

- Broker secrets are server-side by design.
- The known `VITE_FRONTEND_FORGE_API_KEY` query usage was removed from
  `client/src/components/Map.tsx`.
- Production encryption must not depend on a local weak fallback path.
- Production CORS, CSP and headers are not fully validated in a deployed
  environment.

## Product Limitations

- LIVE trading is intentionally disabled.
- AUTO execution is not approved.
- Execution functions are preparation/validation paths, not live-trading
  authorization.
- Connectors are safe boundaries and mocks/read-only preparation, not validated
  production broker integrations.
- Backtests can use mock data and must not be presented as future performance
  proof.
- No dedicated frontend test suite exists yet.
- Persistent production database/journal storage is not finalized.

## Future Modules Not Implemented Yet

- Economic Calendar Engine
- News/Event Shield
- Watchlist Market Radar
- Alert Engine
- Replay Engine
- Chart Overlay Engine
- Strategy Preset Engine

These modules are recommended before any serious LIVE workflow.

## Demo Restrictions

For MVP v1, only the following are acceptable:

- internal controlled demo
- MOCK data inspection
- backend test execution
- code walkthrough
- documentation review

The following remain not acceptable:

- public demo
- client-facing demo
- real broker credentials
- order placement
- LIVE trading
- AUTO trading
- performance claims
