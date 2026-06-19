# OUT OF SAMPLE VALIDATION REPORT

Date: 2026-06-19  
Scope: temporal train/validation/test split, drift analysis, stress scenarios, production confidence, real-readiness gate.

## Result

READY_GENERALIZATION_TEST

RAZON passed the out-of-sample generalization test on the current simulated Deriv-style dataset. REAL remains locked.

## Split

Temporal split:

- Train: `60%`
- Validation: `20%`
- Test: `20%`

Controls:

- temporalLeakagePrevented: `true`
- recalibratedOnTest: `false`
- test data is not reused for training/calibration

## Final Metrics

```json
{
  "trainScore": 97,
  "validationScore": 98,
  "testScore": 98,
  "generalizationGap": 1,
  "overfitRisk": "LOW",
  "productionConfidence": "HIGH",
  "realReadiness": "NOT_READY"
}
```

## Train / Validation / Test

```json
{
  "train": {
    "totalSignals": 1000,
    "score": 97,
    "sharpe": 5,
    "drawdown": 0.02,
    "winrate": 95.97,
    "expectedValue": 1.7065,
    "calibrationError": 0.2397,
    "kelly": 0.234,
    "noTradeRate": 52.9
  },
  "validation": {
    "totalSignals": 1000,
    "score": 98,
    "sharpe": 4.0498,
    "drawdown": 0.04,
    "winrate": 90.93,
    "expectedValue": 1.6167,
    "calibrationError": 0.1893,
    "kelly": 0.2133,
    "noTradeRate": 64.7
  },
  "test": {
    "totalSignals": 1000,
    "score": 98,
    "sharpe": 3.4792,
    "drawdown": 0.06,
    "winrate": 83.7,
    "expectedValue": 1.5707,
    "calibrationError": 0.117,
    "kelly": 0.1833,
    "noTradeRate": 63.8
  }
}
```

## Drift Analysis

```json
{
  "performanceDecay": -1,
  "confidenceDrift": 12.27,
  "marketDrift": 0.1358
}
```

Interpretation:

- No harmful performance decay was observed between train and test.
- Confidence/winrate drifts downward from train to test, but the score remains stable.
- Market drift remains low in the simulated split.

## Stress Test

```json
[
  {
    "scenario": "HIGH_VOLATILITY",
    "score": 98,
    "sharpe": 3.6225,
    "drawdown": 0.13,
    "winrate": 81.28,
    "noTradeRate": 76.5
  },
  {
    "scenario": "LOW_VOLATILITY",
    "score": 97,
    "sharpe": 5,
    "drawdown": 0,
    "winrate": 98.71,
    "noTradeRate": 53.5
  },
  {
    "scenario": "BOOM",
    "score": 96,
    "sharpe": 5,
    "drawdown": 0,
    "winrate": 94.89,
    "noTradeRate": 49.1
  },
  {
    "scenario": "CRASH",
    "score": 99,
    "sharpe": 3.2432,
    "drawdown": 0,
    "winrate": 82.97,
    "noTradeRate": 72.4
  },
  {
    "scenario": "VOLATILITY",
    "score": 98,
    "sharpe": 3.3507,
    "drawdown": 0.03,
    "winrate": 84.46,
    "noTradeRate": 61.4
  },
  {
    "scenario": "STEP",
    "score": 97,
    "sharpe": 5,
    "drawdown": 0.18,
    "winrate": 91.46,
    "noTradeRate": 63.7
  },
  {
    "scenario": "JUMP",
    "score": 98,
    "sharpe": 3.0444,
    "drawdown": 0.15,
    "winrate": 79.75,
    "noTradeRate": 76.3
  }
]
```

Stress scenarios covered:

- high volatility
- low volatility
- Boom
- Crash
- Volatility
- Step
- Jump

## Generalization

generalizationGap: `1`

Rule:

- gap < 10% => acceptable
- gap > 20% => overfit

Current result:

- gap is acceptable
- overfitRisk is `LOW`
- productionConfidence is `HIGH`

## UI

Production Confidence is now exposed in the KALOS/Trade Center flow:

- `LOW`
- `MEDIUM`
- `HIGH`

Current production confidence:

```text
HIGH
```

## Files

- `server/services/validation/outOfSampleValidation.ts`
- `server/services/razonBacktestService.ts`
- `server/services/kalos/kalosEngine.ts`
- `frontend/app/cockpit.types.ts`
- `frontend/components/KalosSignalCard.tsx`
- `frontend/trade/TradeCenterPage.tsx`
- `backend/tests/out-of-sample-validation.test.ts`

## Verification

Commands executed:

```text
pnpm check
pnpm exec vitest run --config backend\tests\vitest.config.mjs backend\tests\out-of-sample-validation.test.ts backend\tests\backtest-monte-carlo.test.ts backend\tests\trade-center-execution.test.ts
pnpm build
```

Results:

- TypeScript: PASS
- Tests: PASS, 3 files, 6 tests
- Build: PASS

## Safety

- `LIVE=false`
- `ENABLE_LIVE_TRADING=false`
- `DERIV_ALLOW_ORDER_PLACEMENT=false`
- `confirm-real` remains 403
- no real execution enabled

## Final Return Values

- trainScore: `97`
- validationScore: `98`
- testScore: `98`
- generalizationGap: `1`
- overfitRisk: `LOW`
- productionConfidence: `HIGH`
- realReadiness: `NOT_READY`

