# TRADE CENTER ARCHITECTURE REPORT

Date: 2026-06-19  
Scope: Trade Center UI, read-only execution preparation APIs, proposal journaling, DEMO/REAL guardrails.

## Result

READY_TRADE_CENTER_ARCHITECTURE

The Trade Center architecture is implemented as a preparation and preview surface only. No real execution is enabled.

## UI

Added cockpit navigation entry:

- `Trade Center / Centre de Trading`

Route:

- `/trade-center`

Sections implemented:

1. Deriv Account Panel
   - DEMO account status
   - REAL account locked status
   - demo balance display
   - real balance locked
   - currency
   - OAuth status
   - last sync
   - source `PERSONAL_DERIV_DEMO_OAUTH`

2. Trading Mode Panel
   - Analysis only
   - Manual
   - Semi-auto
   - Auto locked

3. Capital & Risk Panel
   - available capital
   - minimum recommended capital
   - recommended stake
   - max risk per trade
   - max daily loss
   - current drawdown
   - stop loss
   - take profit
   - riskReward
   - Kelly fraction
   - expected value

4. RAZON Trade Proposal Card
   - market
   - direction UP/DOWN
   - standard action BUY/SELL
   - confidence
   - calibrated confidence
   - recommended stake
   - expected gain
   - max accepted loss
   - ideal profit window
   - validity window
   - TP
   - SL
   - invalidation
   - expiry
   - noTradeReason
   - `Would execute: UP/DOWN` preview only

5. User Confirmation Guard
   - warns when user stake or risk exceeds recommendation
   - warns when ideal profit window is too short
   - warns when daily drawdown is elevated

6. DEMO / REAL Toggle
   - DEMO visible for preview
   - REAL visible but locked
   - REAL checklist displayed:
     - 1000 trades demo
     - Sharpe > 1.5
     - drawdown < 8%
     - no MOCK
     - journal complet
     - kill switch tested

## API

Added read-only preparation endpoints:

- `POST /api/execution/preview`
- `POST /api/execution/confirm-demo`
- `POST /api/execution/confirm-real`

Behavior:

- `/api/execution/preview` builds a proposal from the current KALOS/statistical/adaptive signal and journals it.
- `/api/execution/confirm-demo` records a simulated DEMO confirmation only.
- `/api/execution/confirm-real` always returns HTTP 403 with `REAL_EXECUTION_LOCKED`.

No buy/sell/proposal/order route was added.

## Journal

Each preview/confirmation records a trade proposal entry with:

- signal
- market
- capital
- recommendedStake
- userStake
- TP
- SL
- expectedValue
- riskReward
- result simulated
- user override yes/no

Journal API now also returns:

- `tradeProposals`

## Files

- `frontend/trade/TradeCenterPage.tsx`
- `frontend/app/cockpit.types.ts`
- `frontend/app/RazonCockpit.tsx`
- `frontend/pages/page-registry.ts`
- `frontend/components/MobileBottomNav.tsx`
- `client/src/auth/AuthRouter.tsx`
- `server/services/execution/executionPreviewService.ts`
- `server/controllers/executionController.ts`
- `server/routes/executionRoutes.ts`
- `server/routes/index.ts`
- `server/services/razonJournalService.ts`
- `server/controllers/journalController.ts`
- `backend/tests/trade-center-execution.test.ts`

## Validation

Commands executed:

```text
pnpm check
pnpm exec vitest run --config backend\tests\vitest.config.mjs backend\tests\trade-center-execution.test.ts backend\tests\adaptive-horizon-engine.test.ts backend\tests\backtest-monte-carlo.test.ts backend\tests\statistical-risk-engine.test.ts
pnpm build
```

Results:

- TypeScript: PASS
- Tests: PASS, 4 files, 10 tests
- Build: PASS
- route scan for buy/sell/order/proposal: PASS, none found

## Security

Kept:

- `LIVE=false`
- `ENABLE_LIVE_TRADING=false`
- `DERIV_ALLOW_ORDER_PLACEMENT=false`
- `AUTO_EXECUTION=false`

Enforced:

- no buy route
- no sell route
- no proposal route
- no order route
- no REAL execution
- `confirm-real` returns 403
- preview and confirm-demo are simulation/read-only only

## Final Status

READY_TRADE_CENTER_ARCHITECTURE

