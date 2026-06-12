# RAZON Production Checklist

Production is not allowed until every critical item is completed and reviewed.
LIVE trading must remain disabled by default.

## Repository Quality

- [ ] `pnpm install` completes from a clean checkout.
- [ ] `pnpm check` passes globally.
- [ ] `pnpm run build` passes.
- [ ] `pnpm exec vitest run --config backend/tests/vitest.config.mjs` passes.
- [ ] Frontend tests exist and pass.
- [ ] `pnpm audit --audit-level moderate` has no unresolved critical/high risk.
- [ ] Legacy TypeScript errors in `server/services/*` are resolved.
- [ ] No generated build artifacts are required for source review.

## Environment

- [ ] `.env.example` is complete and documented.
- [ ] Real `.env` is not committed.
- [ ] `ENABLE_LIVE_TRADING=false` by default.
- [ ] `MODE_SIMULATION=true` until production approval.
- [ ] `ALLOW_AUTO_EXECUTION=false` until production approval.
- [ ] `APP_SECRET_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY` use strong non-placeholder values.
- [ ] `DATABASE_URL` points to an approved production database.
- [ ] Storage paths are backed up or mapped to durable storage.

## Security

- [ ] Broker/API keys are stored only backend-side or in a managed vault.
- [ ] No broker credential uses `VITE_`, `PUBLIC_` or `NEXT_PUBLIC_`.
- [ ] Tokens, passwords and API keys are masked in logs, health responses and
  audit records.
- [ ] Encryption uses production-grade crypto only; local fallback encryption is
  disabled or removed for production.
- [ ] CORS allowlist is restricted to approved origins.
- [ ] CSRF/XSS protections are reviewed for applicable routes.
- [ ] CSP and security headers are enabled.
- [ ] Rate limiting is enabled for API routes.
- [ ] Role permissions are reviewed: ADMIN, OPERATOR, AUDITOR, VIEWER, SERVICE.
- [ ] Security audit trail is enabled and retained.
- [ ] Incident response procedure is tested.

## Data

- [ ] LIVE / DEMO / MOCK source labels are visible in backend outputs and UI.
- [ ] MOCK source blocks execution.
- [ ] Data coherence checks are enabled.
- [ ] Delayed data is labeled.
- [ ] Spread and slippage thresholds are configured.
- [ ] Connector latency is monitored.
- [ ] Data gaps produce WAIT or NO_TRADE, not forced signals.

## KALOS

- [ ] Confidence is capped at 95.
- [ ] KALOS never promises certainty or guaranteed performance.
- [ ] BUY, SELL, WAIT and NO_TRADE are all journalable.
- [ ] HTF / MTF / LTF context is validated.
- [ ] Historical calibration cannot bypass the confidence cap.
- [ ] KALOS output cannot bypass Risk Engine or No-Trade Engine.

## Backtesting

- [ ] KALOS strategy is tested against historical or clearly labeled mock data.
- [ ] Reports include total trades, win rate, loss rate, profit factor,
  expectancy, max drawdown, average RR, streaks, net profit, average win and
  average loss.
- [ ] NO_TRADE decisions are present in reports.
- [ ] Insufficient data refuses the backtest.
- [ ] Simulated data is clearly labeled.
- [ ] No backtest result is presented as guaranteed future performance.

## Journal

- [ ] Journal service is available before execution.
- [ ] BUY, SELL, WAIT and NO_TRADE decisions are recorded.
- [ ] Errors and refusals are logged.
- [ ] Backtests are logged.
- [ ] Audit trail explains why a trade was accepted or refused.
- [ ] Journal storage path or database is backed up.
- [ ] Execution is blocked when journal is unavailable.

## Risk And No-Trade

- [ ] Risk Engine validates every signal and execution intent.
- [ ] No-Trade Engine validates every signal and execution intent.
- [ ] RR minimum is 1:2.
- [ ] Drawdown limits are configured and tested.
- [ ] Martingale is forbidden.
- [ ] Automatic risk increase after loss is forbidden.
- [ ] SL and TP are mandatory.
- [ ] Spread and slippage dangerous states block execution.
- [ ] Emergency Stop and Kill Switch block execution.
- [ ] News/Event Shield integration is planned before LIVE.

## Connectors

- [ ] MT5 / Deriv / Forex credentials are configured only server-side.
- [ ] Connector health checks pass.
- [ ] Reconnection behavior is tested.
- [ ] Tokens are masked in health and logs.
- [ ] LIVE / DEMO / MOCK status is visible.
- [ ] Order functions are blocked unless Execution Engine authorizes them.

## Execution

- [ ] LIVE mode requires manual confirmation.
- [ ] `ENABLE_LIVE_TRADING=true` is required for LIVE and is absent by default.
- [ ] AUTO mode requires explicit production approval.
- [ ] Emergency Stop is always accessible.
- [ ] Persistent Kill Switch is tested.
- [ ] Duplicate order prevention is tested.
- [ ] Execution is blocked on MOCK data.
- [ ] Execution is blocked when journal is unavailable.
- [ ] Execution is blocked when Risk Engine refuses.
- [ ] Execution is blocked when No-Trade Engine refuses.

## Monitoring

- [ ] Backend health check is enabled.
- [ ] Connector status is monitored.
- [ ] API error counts are monitored.
- [ ] KALOS status is monitored.
- [ ] Risk Engine status is monitored.
- [ ] No-Trade Engine status is monitored.
- [ ] Execution Engine status is monitored.
- [ ] Runtime mode LIVE / DEMO / MOCK is visible.
- [ ] Fail-safe state is visible: SAFE, WARNING, DANGER, STOPPED.
- [ ] Incident logs are reviewed.

## Rollback

- [ ] Last stable build is identified.
- [ ] Database/journal backup is verified.
- [ ] Secrets rollback plan is documented.
- [ ] Kill Switch procedure is documented.
- [ ] Emergency contact path is documented.
- [ ] Rollback has been rehearsed in DEMO.

## Final Release Gate

- [ ] Global QA report has no Critical item.
- [ ] Security review has no unresolved Critical or High item.
- [ ] DEMO mode has been validated before LIVE.
- [ ] Production owner signs off.
- [ ] LIVE remains disabled until the exact release window and operator approval.
