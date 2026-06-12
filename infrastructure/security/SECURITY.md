# RAZON Security

RAZON is built with a fail-safe posture: analysis is allowed by default, real execution is not. LIVE trading must remain disabled unless production approval, runtime configuration, journal availability, Risk Engine, No-Trade Engine and manual confirmation all pass together.

## Principles

- No API key is stored or rendered in the frontend.
- Secrets must come from environment variables or a secure vault.
- Secrets written to logs must be masked.
- LIVE trading defaults to disabled with `ENABLE_LIVE_TRADING=false`.
- Risk Engine and No-Trade Engine are mandatory gates.
- Emergency Stop and persistent Kill Switch override every workflow.
- MOCK data can be used for UI, tests and simulation, never for LIVE execution.

## Secret Handling

Required secret classes:

- `APP_SECRET_KEY`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- broker/API secrets such as `MT5_PASSWORD`, `DERIV_API_TOKEN`, `FOREX_API_KEY`, `FOREX_API_SECRET`

Production requirements:

- Store secrets as sensitive environment variables or in a managed vault.
- Rotate connector API keys after incidents or team changes.
- Never use public prefixes such as `VITE_`, `PUBLIC_` or `NEXT_PUBLIC_` for broker credentials.
- Audit environment variables by environment before release.

## Web Protections

- Enforce CORS allowlists.
- Reject oversized payloads and obvious XSS/destructive inputs.
- Apply baseline CSP and security headers.
- Use rate limiting on API routes.
- Require authenticated principals for protected operations.
- Require role-based permissions for secret rotation, settings changes and LIVE mode requests.

## Trading Safety

Execution must be blocked when any of these are true:

- LIVE is disabled or not confirmed.
- Emergency Stop is active.
- Kill Switch is active.
- data source is `MOCK`.
- market data is incoherent.
- spread or slippage is dangerous.
- drawdown limit is reached.
- journal is unavailable.
- Risk Engine refuses.
- No-Trade Engine blocks.

## Audit Trail

Security audit records must include:

- timestamp
- actor
- event
- severity
- sanitized details
- decision outcome

Audit logs must never include raw tokens, passwords or API keys.
