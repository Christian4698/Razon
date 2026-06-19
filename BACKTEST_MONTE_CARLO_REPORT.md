# BACKTEST AND MONTE CARLO VALIDATION REPORT

Date: 2026-06-19  
Scope: RAZON simulated Deriv DEMO historical validation, horizon comparison, Monte Carlo stress testing, real-readiness gate.

## Result

READY_BACKTEST_MONTE_CARLO

The backtest and Monte Carlo validation layer is implemented. It remains simulation-only and does not enable live trading or execution.

## Final Readiness

realReadiness: `NOT_READY`

Reasons:

- Sharpe below 1.5.
- Max drawdown above 8%.

RAZON remains suitable for analysis and controlled simulation only. It is not cleared for real execution.

## Final Metrics

```json
{
  "totalSignals": 1000,
  "winrate": 53.1,
  "sharpe": 1.159,
  "maxDrawdown": 23.69,
  "probabilityOfRuin": 0,
  "robustnessScore": 69,
  "realReadiness": "NOT_READY"
}
```

Additional metrics:

```json
{
  "chanceDrawdown5": 0,
  "chanceDrawdown8": 0,
  "chanceDrawdown15": 0,
  "expectedEquityAfterNTrades": 20651.4107,
  "recommendedHorizon": "LONG",
  "recommendedMode": "ANALYSIS_ONLY",
  "calibrationError": 0.189,
  "expectedValue": 0.9977,
  "noTradeRate": 0,
  "monteCarloScore": 100
}
```

## Backtest Engine

Implemented fields per simulated signal:

- market
- timeframe
- generatedAt
- entry
- TP
- SL
- invalidation
- expiry
- result: `WIN`, `LOSS`, `EXPIRED`, `INVALIDATED`
- pnlSimulated
- duration
- drawdownDuringTrade
- maxFavorableExcursion
- maxAdverseExcursion

The backtest engine is deterministic and uses simulated Deriv DEMO historical candles when no production historical export is supplied.

## Horizon Validation

```json
{
  "SCALPING": {
    "totalSignals": 334,
    "winrate": 2.1,
    "averagePnl": 0.2611,
    "medianPnl": 0.2447,
    "avgDrawdown": 59.33,
    "maxDrawdown": 5.11,
    "profitDurationSeconds": 180,
    "predictionLifeSeconds": 180,
    "signalQuality": 23
  },
  "SHORT": {
    "totalSignals": 333,
    "winrate": 63.66,
    "averagePnl": 1.0797,
    "medianPnl": 1.6,
    "avgDrawdown": 51.14,
    "maxDrawdown": 12.98,
    "profitDurationSeconds": 862,
    "predictionLifeSeconds": 855,
    "signalQuality": 48
  },
  "LONG": {
    "totalSignals": 333,
    "winrate": 93.69,
    "averagePnl": 1.6546,
    "medianPnl": 1.8333,
    "avgDrawdown": 43.74,
    "maxDrawdown": 11.36,
    "profitDurationSeconds": 1528,
    "predictionLifeSeconds": 1479,
    "signalQuality": 74
  }
}
```

Recommended horizon: `LONG`

## Monte Carlo

Implemented:

- 1000 simulations
- randomized trade sequence sampling
- stress drawdown checks
- probability of ruin
- worst-case path
- best-case path
- average equity curve

Risk of ruin:

```json
{
  "probabilityOfRuin": 0,
  "chanceDrawdown5": 0,
  "chanceDrawdown8": 0,
  "chanceDrawdown15": 0,
  "expectedEquityAfterNTrades": 20651.4107
}
```

## Robustness Score

robustnessScore: `69 / 100`

Score inputs:

- Sharpe
- drawdown
- expected value
- calibration
- Monte Carlo risk
- no-trade discipline

The raw score is capped when any real-readiness validation rule fails. This prevents a positive simulation from masking unacceptable real-mode risk.

## UI / Cockpit

KALOS decision surfaces now expose:

- backtest score
- Monte Carlo score
- risk of ruin
- recommended mode
- recommended horizon
- `REAL NOT READY` when validation thresholds are not met

## Validation Rules

Applied:

- Sharpe < 1.5 => `REAL NOT READY`
- maxDrawdown > 8% => `REAL NOT READY`
- probabilityOfRuin > 5% => `REAL NOT READY`
- elevated calibrationError => `REAL NOT READY`
- fewer than 1000 signals/trades tested => `REAL NOT READY`

Current result:

- Sharpe = `1.159`, below 1.5.
- maxDrawdown = `23.69%`, above 8%.
- probabilityOfRuin = `0%`.
- totalSignals = `1000`.

## Files

- `server/services/backtest/backtestMonteCarloEngine.ts`
- `server/services/razonBacktestService.ts`
- `server/services/market/marketAggregator.ts`
- `server/services/kalos/kalosEngine.ts`
- `server/types/razon.ts`
- `frontend/app/cockpit.types.ts`
- `frontend/app/RazonCockpit.tsx`
- `frontend/components/KalosSignalCard.tsx`
- `frontend/trading/LiveMarketChart.tsx`
- `backend/tests/backtest-monte-carlo.test.ts`

## Verification

Commands executed:

```text
pnpm check
pnpm exec vitest run --config backend\tests\vitest.config.mjs backend\tests\backtest-monte-carlo.test.ts backend\tests\statistical-risk-engine.test.ts
pnpm build
```

Result:

- TypeScript: PASS
- Tests: PASS, 2 files, 7 tests
- Build: PASS

## Safety

- No live trading enabled.
- No execution route added.
- No buy/sell/proposal/order route added.
- All outputs are simulated and read-only.
- `liveExecutionAllowed:false`.

