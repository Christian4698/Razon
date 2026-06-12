# Connector Architecture

Connectors isolate external platforms from RAZON core logic. They provide data
to the engines and prepare future execution boundaries without enabling real
trading by default.

## Supported Boundaries

- MetaTrader 5
- Deriv
- Forex data APIs
- TradingView
- Mock connector

## Deriv Connector

Deriv Connector is a backend-only connector boundary for DEMO and REAL market
data.

Modes:

- Deriv Demo: demo API token, WebSocket market data, read-only by default.
- Deriv Real: real API token, WebSocket market data, `REAL_DATA` read access
  only.

Rules:

- API token stays backend-only in environment variables or vault storage.
- `REAL_DATA` may read real Deriv ticks/candles when the backend token is
  configured.
- LIVE trading remains OFF.
- No real order is allowed.
- Deriv order placement always returns `LIVE_BLOCKED` in this phase.

## MT5 Bridge Connector

MT5 Bridge Connector is a backend-only connector boundary planned for a local
MQL5 Expert Advisor bridge.

Modes:

- MT5 Demo: local EA bridge for demo account data, read-only by default.
- MT5 Real: local EA bridge for real account data, `REAL_DATA` read access only.

Rules:

- MT5 login, password, server and bridge settings stay backend-only.
- The frontend never receives broker credentials.
- The bridge is designed to read candles, ticks, spread, account info and open
  positions.
- Order routes remain blocked and return `LIVE_BLOCKED`.
- LIVE trading remains OFF until separate production approval.

## Common Functions

Each connector should expose:

- `connect()`
- `disconnect()`
- `testConnection()`
- `getConnectionStatus()`
- `getCandles()`
- `getTick()`
- `getSpread()`
- `getAccountInfo()`
- `getOpenPositions()`
- `placeOrder()`
- `closeOrder()`
- `modifyOrder()`

Execution functions are prepared for integration, but must remain blocked until
the Execution Engine, Risk Engine, No-Trade Engine, Journal, security layer and
connector state all authorize the action.

## Runtime Modes

- `MOCK`: simulated fallback or unavailable credentials. Must be clearly shown.
- `DEMO`: demo or paper-like data source.
- `LIVE`: real source. Read-only can be prepared, but real execution remains
  disabled by default.

The UI and reports must display `LIVE`, `DEMO` or `MOCK` clearly.

Connector safety statuses:

- `DISCONNECTED`: no active connector session.
- `CONNECTED_DEMO`: demo or simulation data channel connected.
- `CONNECTED_REAL_READONLY`: real data channel connected for read-only
  analysis.
- `LIVE_BLOCKED`: any order placement, close or modify request is blocked.

## Environment Variables

MT5:

- `MT5_ENABLED`
- `MT5_MODE`
- `MT5_ACCOUNT_TYPE`
- `MT5_LOGIN`
- `MT5_PASSWORD`
- `MT5_SERVER`
- `MT5_PATH`
- `MT5_BRIDGE_HOST`
- `MT5_BRIDGE_PORT`
- `MT5_ALLOW_ORDER_PLACEMENT`

Deriv:

- `DERIV_ENABLED`
- `DERIV_APP_ID`
- `DERIV_API_TOKEN`
- `DERIV_ENDPOINT`
- `DERIV_ACCOUNT_TYPE`
- `DERIV_ALLOW_ORDER_PLACEMENT`

Forex API:

- `FOREX_API_ENABLED`
- `FOREX_API_PROVIDER`
- `FOREX_API_BASE_URL`
- `FOREX_API_KEY`
- `FOREX_API_SECRET`

## Security Rules

- Credentials stay server-side in `.env` or a secure vault.
- Broker credentials must never use public prefixes such as `VITE_`, `PUBLIC_`
  or `NEXT_PUBLIC_`.
- Health responses must expose masked values only.
- Logs must mask tokens, passwords and API keys.
- If no real source is configured, connector status must fall back to `MOCK`.
- MOCK data must never be used for execution.
- LIVE trading requires `ENABLE_LIVE_TRADING=true`, manual confirmation and all
  execution gates.
- `ENABLE_LIVE_TRADING=false` keeps real order execution unavailable even when
  `REAL_DATA` reads real market data.
- `MT5_ALLOW_ORDER_PLACEMENT=false` and `DERIV_ALLOW_ORDER_PLACEMENT=false`
  are required defaults.

## Testing Scope

Connector tests should cover:

- connection and disconnection state
- data reads
- health output
- token masking
- latency status
- reconnect behavior
- blocked execution functions
- `CONNECTED_DEMO`, `CONNECTED_REAL_READONLY` and `LIVE_BLOCKED` safety statuses
- backend-only secret masking for Deriv token and MT5 credentials

No connector test should place a real order.

## Current Limitations

- Connectors are safe platform boundaries, not complete production broker
  integrations.
- Real trading remains off by default.
- Broker credentials must be configured manually in secure backend environment
  variables or a vault.
- Execution routes need final production validation before any LIVE use.
