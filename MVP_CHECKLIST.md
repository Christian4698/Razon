# RAZON MVP v1 Checklist

Overall status: READY for controlled MVP demo

## Build And Tests

- [x] Backend RAZON modules compile with targeted strict TypeScript validation.
- [x] Frontend cockpit compiles with targeted TypeScript validation.
- [x] Vite frontend build passes.
- [x] Full app build passes.
- [x] Backend module tests pass.
- [x] Global `pnpm check` passes.
- [x] Dependency audit has no unresolved critical/high vulnerabilities.
- [ ] Dedicated frontend tests exist and pass.

## KALOS

- [x] KALOS runs in analysis mode.
- [x] KALOS returns BUY / SELL / WAIT / NO_TRADE.
- [x] KALOS includes reasons, confidence, TP, SL, invalidation, volatility and risk score.
- [x] Confidence is capped at 95.
- [x] Historical calibration cannot bypass the confidence cap.
- [x] KALOS does not execute orders.

## Backtesting

- [x] Backtesting runs with KALOS strategy.
- [x] Mock data fallback is available when real historical data is absent.
- [x] Reports include metrics and simulated signals.
- [x] NO_TRADE decisions are included.
- [x] Insufficient data can refuse a backtest.
- [x] Simulated data is labeled.

## Journal And Audit

- [x] Journal logs BUY, SELL, WAIT and NO_TRADE.
- [x] Journal logs errors.
- [x] Journal logs backtests.
- [x] NO_TRADE is treated as a valid decision.
- [x] Audit trail explains accepted and refused decisions.
- [ ] Durable production journal storage is configured and backed up.

## Risk Engine

- [x] Risk Engine validates RR, SL, TP, drawdown, spread, slippage and exposure.
- [x] Risk Engine blocks MOCK execution intent.
- [x] Risk Engine blocks missing journal.
- [x] Martingale is forbidden.
- [x] Automatic risk increase after loss is forbidden.
- [ ] Production thresholds are reviewed for target accounts and brokers.

## No-Trade Engine

- [x] No-Trade Engine blocks low confidence.
- [x] No-Trade Engine blocks RR below 1:2.
- [x] No-Trade Engine blocks dangerous spread and slippage.
- [x] No-Trade Engine blocks abnormal volatility and insufficient data.
- [x] No-Trade Engine returns reason code, explanation, severity and recommended action.
- [x] No-Trade Engine respects Risk Engine refusal.

## Execution Safety

- [x] LIVE trading disabled by default.
- [x] `ENABLE_LIVE_TRADING=false` in `.env.example`.
- [x] MOCK execution is blocked.
- [x] Orders without SL are blocked.
- [x] Orders without TP are blocked.
- [x] Risk Engine and No-Trade Engine are required before execution.
- [x] Journal readiness is required before execution.
- [x] Emergency Stop and Kill Switch are represented in safety logic.
- [ ] LIVE mode confirmation flow is validated in a controlled DEMO environment.

## Connectors

- [x] MT5 connector boundary exists.
- [x] Deriv connector boundary exists.
- [x] Forex connector boundary exists.
- [x] TradingView connector boundary exists.
- [x] Mock connector exists.
- [x] Connector health and runtime modes are tested.
- [x] Tokens are masked in connector health tests.
- [ ] Real broker credentials are configured in a secure backend-only environment.
- [ ] Real connector read-only latency/reconnection tests are completed.

## Frontend / Cockpit

- [x] Dashboard exists.
- [x] KALOS panel exists.
- [x] Market chart exists.
- [x] Connectors page exists.
- [x] Journal page exists.
- [x] Risk status page exists.
- [x] Settings page exists.
- [x] MOCK / DEMO / LIVE status is visible.
- [x] Emergency Stop is visible.
- [ ] Frontend automated tests exist.
- [ ] Browser/mobile visual QA is repeated after blocker fixes.

## Security

- [x] Broker secrets are represented as backend environment variables.
- [x] API key vault rejects public frontend secret prefixes.
- [x] Security audit masks sensitive payload fields.
- [x] `.env.example` avoids real secrets.
- [ ] Dependency audit critical/high findings are remediated.
- [ ] Frontend `VITE_*` usages are reviewed and confirmed non-sensitive.
- [ ] Production encryption fallback policy is hardened.
- [ ] Production CORS/CSP/headers are configured.

## Demo Gate

The MVP v1 demo can be approved only when all mandatory blockers below are
closed:

- [x] `pnpm check` passes globally.
- [x] Critical/high dependency vulnerabilities are fixed.
- [x] Frontend `VITE_*` key exposure was reviewed for the known Forge key usage.
- [x] Demo is restricted to MOCK/DEMO data.
- [x] LIVE remains disabled.
- [x] No broker order can be placed.
