# SHADOW_TRADING_REPORT

## Status

READY_SHADOW_VALIDATION

## Scope

Shadow Trading Mode has been added under Trade Center / Validation / Shadow Trading.
It simulates the full validation pipeline:

Market Feed -> Signal -> Decision -> Virtual Entry -> Virtual TP/SL -> Journal -> Performance.

No live execution is enabled.

## Metrics Exposed

- today pnl
- weekly pnl
- virtual balance
- winrate
- avg duration
- drawdown
- sharpe
- noTrade
- profit factor
- rollingSharpe
- rollingDrawdown
- signalDecay
- confidenceStability
- marketStability
- regimeChanges

## Journal Fields

Each virtual signal records:

- timestamp
- market
- direction
- confidence
- entry
- virtualExit
- TP
- SL
- expiry
- expectedValue
- riskReward
- signalHorizon
- capitalModel
- pnlSimulated
- result
- lifecycle

## Lifecycle

- CREATED
- ACTIVE
- EXPIRED
- CLOSED
- INVALIDATED

## Validation Rules

- rollingSharpe >= 1.5
- rollingDrawdown <= 8
- signalDecay <= 15%
- confidence drift <= 10%

REAL remains NOT_READY by policy during Shadow Trading, even if simulated metrics pass.

## Safety

- LIVE=false
- ENABLE_LIVE_TRADING=false
- DERIV_ALLOW_ORDER_PLACEMENT=false
- AUTO=false
- buy forbidden
- sell forbidden
- proposal forbidden
- order forbidden
- confirm-real remains 403

## Result

READY_SHADOW_VALIDATION
