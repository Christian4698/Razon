# ADAPTIVE HORIZON AND NO-TRADE INTELLIGENCE REPORT

Date: 2026-06-19  
Scope: Adaptive horizon selector, advanced no-trade intelligence, profit window, multi-timeframe confirmation, cockpit display.

## Result

READY_ADAPTIVE_HORIZON

The adaptive horizon selector and no-trade intelligence layer are implemented. The system remains simulation/read-only and does not enable live execution.

## Final Metrics

```json
{
  "accuracyBefore": 63.66,
  "accuracyAfter": 93.69,
  "drawdownBefore": 12.98,
  "drawdownAfter": 11.36,
  "noTradeRate": 18,
  "pnlBefore": 1.0797,
  "pnlAfter": 1.6546,
  "recommendedDefault": "LONG"
}
```

## Adaptive Decision Snapshot

```json
{
  "selectedHorizon": "LONG",
  "validFor": 3293,
  "profitWindow": 61,
  "recommendedAction": "NO_TRADE",
  "timeframeAgreement": "ALIGNED",
  "riskMode": "NO_TRADE",
  "noTradeReason": "Sharpe too weak + Drawdown above threshold + Calibration insufficient + Backtest drawdown too high"
}
```

Reason:

```text
Selected LONG from score 69.9 using calibrated confidence, EV, volatility, drawdown, horizon life, backtest quality and Monte Carlo risk.
```

## Implemented

### Adaptive Horizon Selector

The selector now chooses between:

- `SCALPING`
- `SHORT`
- `LONG`

Inputs:

- calibrated confidence
- expected value
- volatility regime
- recent drawdown
- average prediction life
- average profit duration
- market type
- backtest score
- Monte Carlo risk
- multi-timeframe agreement

Output:

- selectedHorizon
- reason
- validFor
- profitWindow
- recommendedAction
- fixedHorizon
- comparison metrics

### Advanced No-Trade Intelligence

NO_TRADE is forced when any major safety condition appears:

- EV <= 0
- Kelly <= 0
- Sharpe too weak
- drawdown above threshold
- volatility regime `CHAOS`
- volatility spike
- stale feed
- insufficient calibration
- risk/reward insufficient
- trend/range contradiction
- strong multi-timeframe conflict
- backtest drawdown too high

Current adaptive no-trade reason:

```text
Sharpe too weak + Drawdown above threshold + Calibration insufficient + Backtest drawdown too high
```

### Profit Window Engine

The output separates:

- signal validity window
- ideal profit window

It can recommend:

- `TAKE_PROFIT_QUICKLY`
- `HOLD_CAUTIOUSLY`
- `TRADE_ALLOWED_SIMULATION`
- `NO_TRADE`

Current result:

- validFor: `3293 sec`
- profitWindow: `61 sec`
- recommendedAction: `NO_TRADE`

### Multi-Timeframe Confirmation

Implemented comparison:

- LTF
- MTF
- HTF

Rules:

- aligned timeframes can increase confidence.
- LTF/HTF opposition reduces confidence.
- strong conflict forces NO_TRADE.

Current result:

- timeframeAgreement: `ALIGNED`
- confidenceAdjustment: positive path available, but risk gates still block the signal.

## UI / Cockpit

Displayed in KALOS/Decision Card:

- selected horizon
- fixed horizon
- horizon reason
- no-trade reason
- adaptive no-trade reason
- best profit window
- validity window
- timeframe agreement
- risk mode
- recommended action

## Files

- `server/services/risk/adaptiveHorizonEngine.ts`
- `server/services/market/marketAggregator.ts`
- `server/services/kalos/kalosEngine.ts`
- `frontend/app/cockpit.types.ts`
- `frontend/app/RazonCockpit.tsx`
- `frontend/components/KalosSignalCard.tsx`
- `frontend/components/MobileKalosCard.tsx`
- `frontend/trading/LiveMarketChart.tsx`
- `backend/tests/adaptive-horizon-engine.test.ts`

## Validation

Commands executed:

```text
pnpm check
pnpm exec vitest run --config backend\tests\vitest.config.mjs backend\tests\adaptive-horizon-engine.test.ts backend\tests\backtest-monte-carlo.test.ts backend\tests\statistical-risk-engine.test.ts
pnpm build
```

Result:

- TypeScript: PASS
- Tests: PASS, 3 files, 9 tests
- Build: PASS

## Safety

- LIVE remains disabled.
- No execution route added.
- No buy/sell/proposal/order route added.
- All recommendations are read-only.
- `liveExecutionAllowed:false`.

## Final Return Values

- accuracyBefore: `63.66`
- accuracyAfter: `93.69`
- drawdownBefore: `12.98`
- drawdownAfter: `11.36`
- noTradeRate: `18`
- recommendedDefault: `LONG`
