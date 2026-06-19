# DEMO_OBSERVATION_GATE_REPORT

## Status

READY_DEMO_OBSERVATION_GATE

## Scope

The 14-Day Demo Observation Gate tracks Shadow Trading performance day by day before any real-trading preparation.
REAL remains blocked regardless of intermediate metrics until all gate conditions pass.

## Minimum Conditions

- daysObserved >= 14
- minimumSignals >= 3000
- realisticSharpe >= 1.5
- realisticDrawdown <= 8
- signalLeakage = 0
- simulationBias <= 25
- confidenceDrift <= 10
- feedUptime >= 95%

## Daily Metrics

Each daily record stores:

- signalsCount
- virtualPnL
- realisticPnL
- realisticSharpe
- realisticDrawdown
- winrate
- noTradeRate
- simulationBias
- confidenceDrift
- bestMarket
- worstMarket
- disabledMarkets
- feedUptime
- incidentCount

## Incident Detection

The gate reports:

- feed interruption
- latency spike
- shadow PnL anomaly
- drawdown spike
- confidence drift
- missing ticks/candles

## Current Result

- daysObserved: 1
- minimumSignals: 3000
- observedSignals: 500
- daysRemaining: 13
- gateStatus: REAL_PREP_LOCKED
- readinessScore: 55
- realReadiness: NOT_READY

Current blockers:

- daysObserved below 14
- minimumSignals below 3000
- simulationBias above 25
- REAL_PREP_LOCKED

The current blockers are expected because the observation window has only one day, the signal count is below 3000, and simulationBias remains above the allowed threshold.

## Security

- LIVE=false
- ENABLE_LIVE_TRADING=false
- DERIV_ALLOW_ORDER_PLACEMENT=false
- AUTO=false
- confirm-real remains 403
- no buy/sell/proposal/order routes
- no automatic execution
