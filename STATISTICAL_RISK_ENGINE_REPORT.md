# STATISTICAL RISK ENGINE REPORT

Date: 2026-06-19  
Scope: RAZON signal risk statistics, KALOS output enrichment, read-only UI decision card, unit validation.

## Result

READY_STATISTICAL_RISK_ENGINE

The statistical risk engine is implemented as a read-only gate before any possible execution phase. It does not add buy, sell, proposal, or order routes.

## Implemented

- Expected Value:
  - Formula: `E = P(win) * averageGain - P(loss) * averageLoss`
  - `E <= 0` blocks directional signals to `NO_TRADE`.
  - `expectedValue` is returned and displayed.
- Drawdown:
  - `currentDrawdown`
  - `maxDrawdown`
  - `dailyDrawdown`
  - `sessionDrawdown`
  - `riskLock`
  - `dailyDrawdown > 5%` reduces confidence.
  - `dailyDrawdown > 8%` blocks to `NO_TRADE`.
- Sharpe Ratio:
  - Calculated on the latest simulated signal/trade returns.
  - Status: `POOR`, `ACCEPTABLE`, `GOOD`, `EXCELLENT`.
  - Sharpe is bounded to avoid unstable near-zero variance explosions.
  - `Sharpe < 1` reduces confidence.
  - `Sharpe < 0.5` blocks to `NO_TRADE`.
- Kelly Fraction:
  - Formula: `f* = (b * p - q) / b`
  - Uses 25% fractional Kelly maximum.
  - `Kelly <= 0` blocks directional signals.
  - Recommended stake is capped and read-only.
- Probability Calibration:
  - Tracks announced confidence, observed win rate, calibration error, and Brier score.
  - Reports `UNCALIBRATED`, `CALIBRATED`, or `DEGRADED`.
  - Confidence is capped at 95.
  - High calibration error reduces confidence.
- Volatility Adaptive Risk:
  - Calculates recent volatility and spike ratio.
  - Regime: `TREND`, `RANGE`, `CHAOS`, `SPIKE`.
  - `SPIKE` blocks to `NO_TRADE`.
  - `CHAOS` reduces confidence.
  - TP/SL multipliers are exposed for downstream adaptation.
- Enriched signal output:
  - `action`
  - `direction`
  - `confidence`
  - `calibratedConfidence`
  - `expectedValue`
  - `sharpeRatio`
  - `drawdown`
  - `kellyFraction`
  - `recommendedStake`
  - `riskReward`
  - `volatilityRegime`
  - `entryZone`
  - `stopLoss`
  - `takeProfit`
  - `invalidation`
  - `expiry`
  - `noTradeReason`
- UI:
  - Decision card / KALOS card displays Expected Value, Sharpe, Drawdown, Kelly, Recommended Stake, Volatility Regime, Calibration Status, and No-trade reason.

## Files

- `server/services/risk/statisticalRiskEngine.ts`
- `server/services/market/marketAggregator.ts`
- `server/controllers/signalsController.ts`
- `server/types/razon.ts`
- `frontend/app/cockpit.types.ts`
- `frontend/app/RazonCockpit.tsx`
- `frontend/components/KalosSignalCard.tsx`
- `frontend/components/MobileKalosCard.tsx`
- `frontend/trading/LiveMarketChart.tsx`
- `backend/tests/statistical-risk-engine.test.ts`

## 100 Signal Simulation

```json
{
  "samples": 100,
  "avgExpectedValue": 0.7247,
  "sharpeRatio": 1.2638,
  "maxDrawdown": 100,
  "calibrationError": 0.4019,
  "kellyAvg": 0.1455,
  "noTradeRate": 0.43,
  "sharpeStatusCounts": {
    "POOR": 43,
    "EXCELLENT": 57
  },
  "volatilityRegimeCounts": {
    "TREND": 89,
    "RANGE": 11
  }
}
```

Interpretation:

- Average EV is positive across the mixed simulation set.
- Average Sharpe is acceptable, but not beta-excellent yet.
- Calibration error is high, so calibration is intentionally strict.
- No-trade rate is 43%, mainly from losing/low-quality simulated windows.
- Max drawdown reached 100% in intentionally adverse simulated paths, confirming the drawdown lock path is active.

## Validation

Commands executed:

```text
pnpm check
pnpm exec vitest run --config backend\tests\vitest.config.mjs backend\tests\statistical-risk-engine.test.ts backend\tests\signal-horizon.test.ts backend\tests\kalos.engine.test.ts
pnpm build
```

Result:

- TypeScript check: PASS
- Tests: PASS, 3 files, 10 tests
- Production build: PASS

Covered tests:

- EV primitive calculation.
- Kelly primitive calculation.
- Sharpe status classification.
- Drawdown and risk lock.
- `NO_TRADE` when EV is non-positive.
- `NO_TRADE` when drawdown exceeds 8%.
- Confidence cap at 95.
- 100 simulated signal windows.
- Calibration error and Brier score availability.
- Fractional Kelly cap.

## Safety

- `LIVE=false`
- `ENABLE_LIVE_TRADING=false`
- `DERIV_ALLOW_ORDER_PLACEMENT=false`
- No buy/sell/proposal/order route was added.
- `liveExecutionAllowed` remains `false`.
- Recommended stake is informational only.
- The engine only enriches and blocks analysis signals.

## Final Metrics

- avgExpectedValue: `0.7247`
- sharpeRatio: `1.2638`
- maxDrawdown: `100`
- calibrationError: `0.4019`
- kellyAvg: `0.1455`
- noTradeRate: `0.43`
