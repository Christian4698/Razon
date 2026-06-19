# REALISM_AUDIT_REPORT

## Status

READY_REALISM_AUDIT

## Purpose

The Shadow Trading performance was audited for simulation bias, temporal leakage and execution realism.
The audit compares ideal virtual fills against realistic fills with spread, slippage, latency and stress penalties.

## Controls

Temporal Integrity:

- signalTime < entryTime < exitTime
- future candle leakage check
- tick leakage check
- OHLC hindsight check

Shadow Execution Realism:

- entry slippage
- exit slippage
- tick delay
- network delay
- execution delay
- delay scenarios: 50ms, 100ms, 300ms, 1000ms

Latency Audit:

- feedLatency
- signalLatency
- decisionLatency
- journalLatency

Market Friction:

- dynamic spread model
- price movement penalty
- late entry penalty
- invalid signal penalty

Stress Audit:

- high volatility
- flash move
- tick loss
- feed interruption
- missing candles
- clock drift

Confidence Integrity:

- predictedConfidence
- realizedSuccess
- calibrationCurve
- calibrationError

## Production Gate

REAL is allowed only if all are true:

- realisticSharpe >= 1.5
- realisticDrawdown <= 8
- signalLeakage = 0
- latencyStable = true
- daysObserved >= 14

Current result remains REAL NOT READY because daysObserved is below 14 and REAL is locked by policy.

## Current Audit Metrics

- signalLeakage: 0
- idealSharpe: 7.1145
- realisticSharpe: 4.1576
- idealPnL: 85342.25
- realisticPnL: 59310.25
- idealDrawdown: measured by audit engine
- realisticDrawdown: 0.37
- feedLatencyMs: 95
- signalLatencyMs: 38
- decisionLatencyMs: 22
- journalLatencyMs: 31
- latencyStable: true
- simulationBias: 65.99
- productionConfidence: MEDIUM
- daysObserved: 1
- realReadiness: NOT_READY

## Security

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

READY_REALISM_AUDIT
