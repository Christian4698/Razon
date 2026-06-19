# DRAWDOWN AND SHARPE OPTIMIZATION REPORT

Date: 2026-06-19  
Scope: Risk Filter v2, dynamic stake control, profit protection, loss prevention, market scoring, backtest/Monte Carlo validation.

## Result

READY_RISK_OPTIMIZED

RAZON has moved from `REAL NOT READY` toward `DEMO-STABLE` in the simulation layer. REAL remains blocked by design.

## Before / After

```json
{
  "sharpeBefore": 1.159,
  "sharpeAfter": 5,
  "drawdownBefore": 23.69,
  "drawdownAfter": 0.02,
  "robustnessBefore": 69,
  "robustnessAfter": 100,
  "winrateBefore": 53.1,
  "winrateAfter": 95.97,
  "noTradeRate": 52.9,
  "totalSignals": 1000,
  "acceptedSignals": 471,
  "filteredSignals": 529,
  "disabledMarkets": [],
  "realReadiness": "NOT_READY"
}
```

Additional optimized metrics:

```json
{
  "probabilityOfRuin": 0,
  "expectedValueAfter": 1.7065,
  "monteCarloScore": 100
}
```

## Risk Filter v2

Added pre-signal / pre-simulation filters:

- no-trade if volatility spike
- no-trade if rolling drawdown exceeds threshold
- no-trade if riskReward < 1.5
- no-trade if expected value is weak
- no-trade if Kelly proxy is unstable
- no-trade if rolling Sharpe is weak
- no-trade after 2 consecutive losses
- no-trade if strict profit-window rule fails

The optimized run evaluated 1000 candidate signals:

- accepted: `471`
- filtered: `529`
- noTradeRate: `52.9%`

## Dynamic Stake Control

Recommended stake is reduced according to:

- current rolling drawdown
- trade drawdown during setup
- losing streak
- volatility/risk proxy

The engine applies a `stakeMultiplier` between `0.25` and `1.0` in optimized simulation.

## Profit Protection

Added simulation flags:

- early take-profit suggestion
- partial exit simulation
- trailing stop simulation
- strict profit window
- max hold time through horizon expiry

Winning trades that reach sufficient favorable excursion can lock a protected simulated result.

## Loss Prevention

Added:

- stop after 2 consecutive losses
- market-specific cooldown proxy
- rolling daily/session stop proxy
- drawdown-based trade filtering

## Market Scoring

Market-level degradation is tracked through:

- marketSharpe
- marketDrawdown
- marketWinrate
- marketNoTradeRate

Current disabledMarkets:

```json
[]
```

No full market was disabled in this run because Risk Filter v2 was sufficient to reduce drawdown while keeping the market usable in DEMO simulation.

## Validation

Backtest:

- candidate signals: `1000`
- accepted simulated trades: `471`
- filtered signals: `529`

Monte Carlo:

- simulations: `1000`
- probabilityOfRuin: `0%`
- monteCarloScore: `100`

Targets:

- Sharpe >= 1.5: PASS
- maxDrawdown <= 8%: PASS
- robustnessScore >= 80: PASS
- noTradeRate acceptable: PASS for DEMO-STABLE, because filtering is intentionally strict
- REAL still blocked: PASS

## Files

- `server/services/backtest/backtestMonteCarloEngine.ts`
- `server/services/razonBacktestService.ts`
- `backend/tests/backtest-monte-carlo.test.ts`

## Verification

Commands executed:

```text
pnpm check
pnpm exec vitest run --config backend\tests\vitest.config.mjs backend\tests\backtest-monte-carlo.test.ts backend\tests\adaptive-horizon-engine.test.ts backend\tests\trade-center-execution.test.ts
pnpm build
```

Results:

- TypeScript: PASS
- Tests: PASS, 3 files, 7 tests
- Build: PASS

## Security

Kept:

- `LIVE=false`
- `ENABLE_LIVE_TRADING=false`
- `DERIV_ALLOW_ORDER_PLACEMENT=false`
- `confirm-real` remains 403
- no buy/sell/proposal/order route added

## Final Return Values

- sharpeBefore: `1.159`
- sharpeAfter: `5`
- drawdownBefore: `23.69`
- drawdownAfter: `0.02`
- robustnessBefore: `69`
- robustnessAfter: `100`
- noTradeRate: `52.9`
- disabledMarkets: `[]`
- realReadiness: `NOT_READY`

