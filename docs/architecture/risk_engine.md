# Risk Engine Architecture

The Risk Engine is RAZON's capital protection layer. It must validate every
future execution intent and every simulated trade path before an order can be
accepted.

## Responsibilities

Risk Engine calculates and validates:

- position size
- risk per trade
- open risk
- risk/reward ratio
- stop-loss validity
- take-profit validity
- daily drawdown
- weekly drawdown
- total drawdown
- symbol exposure
- total exposure
- spread acceptability
- slippage acceptability
- journal availability
- MOCK execution block

## Public Functions

- `validateRisk()`
- `calculatePositionSize()`
- `calculateATRStop()`
- `validateDrawdown()`

## Risk Rules

Minimum safety requirements:

- confidence must be high enough for execution paths
- RR must be at least 1:2
- SL is mandatory
- TP is mandatory
- martingale is forbidden
- automatic risk increase after loss is forbidden
- journal must be available
- MOCK data cannot execute
- spread and slippage must be inside configured limits
- drawdown limits must not be reached

## No-Trade Engine Relationship

The No-Trade Engine consumes Risk Engine output and can block a setup even when
KALOS is directional. A refusal returns:

- `blocked: true`
- `reason_code`
- `explanation`
- `severity`
- `recommended_action`

Typical block reasons:

- `CONFIDENCE_TOO_LOW`
- `RR_TOO_LOW`
- `SPREAD_TOO_HIGH`
- `SLIPPAGE_TOO_HIGH`
- `ABNORMAL_VOLATILITY`
- `INSUFFICIENT_DATA`
- `DRAWDOWN_LIMIT_REACHED`
- `TOO_MANY_OPEN_POSITIONS`
- `CHAOTIC_MARKET`
- `AUTO_MODE_DISABLED`
- `RISK_ENGINE_REFUSED`
- `MISSING_JOURNAL`
- `MOCK_EXECUTION_FORBIDDEN`

## Execution Relationship

Execution Engine must call Risk Engine and No-Trade Engine before sending,
closing or modifying any order. If risk data is missing, stale, contradictory or
unsafe, the decision becomes NO_TRADE or REFUSED.

## Backtesting Relationship

Backtesting must use risk validation to reject simulated trades that would not
be allowed in real conditions. This keeps performance reports aligned with
capital protection rules.

## Journal Relationship

Every acceptance and refusal must be journaled. A trade without journal
readiness is invalid.

## Current Limitations

- Risk Engine is implemented as internal TypeScript services, not a public HTTP
  API.
- Production thresholds must be reviewed against broker/account constraints.
- Full production readiness still depends on resolving global TypeScript and
  dependency audit issues.
