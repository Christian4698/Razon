# RAZON Auth Flow

## Objective

RAZON is gated as a SaaS cockpit:

Client -> login -> server session -> server license check -> cockpit.

Authentication is separate from the existing License Engine. The auth layer does not recreate licenses, devices or license sessions. It only verifies the current user session, asks the License Engine for the current license snapshot, and exposes a safe `/api/me` bootstrap payload.

LIVE remains OFF:

- `ENABLE_LIVE_TRADING=false`
- `ALLOW_AUTO_EXECUTION=false`
- `DERIV_ALLOW_ORDER_PLACEMENT=false`
- no order route is part of the auth flow

## Public Routes

Frontend:

- `/login`
- `/forgot-password`
- `/reset-password`
- `/frontend/auth/login`
- `/frontend/auth/forgot-password`
- `/frontend/auth/reset-password`

Backend:

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/cookie-policy`
- `GET /api/status`

There is no public register page. Accounts are provisioned by admin license creation or by an approved activation workflow.

## Protected Routes

Frontend:

- `/dashboard`
- `/kalos`
- `/chart`
- `/journal`
- `/connectors`
- `/settings`
- `/risk`
- `/profile`

Backend:

- `GET /api/me` requires a valid session or refresh cookie
- `/api/connectors/*`
- `/api/markets/*`
- `/api/signals/*`
- `/api/risk/*`
- `/api/backtest/*`
- `/api/journal/*`

Protected cockpit APIs use `requireLicense()`. `ACTIVE` and `EXPIRED` can pass, with `EXPIRED` treated as limited read-only. `PENDING`, `MISSING`, `SUSPENDED` and `REVOKED` are blocked at the server boundary.

## Session Model

Access token:

- short-lived JWT
- stored only in `razon_access`
- cookie is `httpOnly`
- cookie is `sameSite=lax`
- cookie is `secure` in production or HTTPS

Refresh token:

- random token
- stored only in `razon_refresh`
- server stores only a SHA-256 hash
- cookie is `httpOnly`
- supports normal logout and global logout

Frontend state:

- React keeps the safe session snapshot in memory
- no auth token is stored in `localStorage`
- no refresh token is stored in `localStorage`
- no connector secret is stored in `localStorage` or `sessionStorage`

## Auth Middleware

`requireAuth()` behavior:

- missing or invalid session -> `401 AUTH_REQUIRED`
- expired access token with valid refresh cookie -> access cookie is renewed
- disabled user -> session is rejected

`requireLicense()` behavior:

| License status | Result |
| --- | --- |
| `ACTIVE` | full cockpit access |
| `PENDING` | activation screen |
| `MISSING` | activation screen |
| `EXPIRED` | limited read-only access |
| `SUSPENDED` | access denied |
| `REVOKED` | access denied |

The frontend mirrors this flow for UX, but the license decision remains server-side.

## First User Access

Admin flow:

1. Admin creates a license from Settings > License.
2. Server creates or updates the target user.
3. Server returns the license key once.
4. Server returns the temporary password once.
5. User logs in with email/username and temporary password.
6. `mustChangePassword=true` forces password change.
7. User activates license if status is `PENDING` or `MISSING`.
8. Cockpit opens according to license state.

The temporary password is visible once in the admin response. It is never returned by `/api/me`.

## GET /api/me Contract

Example response:

```json
{
  "authenticated": true,
  "user": {
    "id": "client-demo",
    "username": "client-demo",
    "email": "client@example.com",
    "displayName": "Client Demo",
    "role": "USER",
    "status": "ACTIVE",
    "mustChangePassword": false
  },
  "license": {
    "userId": "client-demo",
    "plan": "PRO",
    "status": "ACTIVE",
    "expiryDate": "2026-07-12T00:00:00.000Z",
    "deviceLimit": 3,
    "activeDevices": 1,
    "sessionLimit": 2,
    "activeSessions": 1,
    "dashboardBlocked": false,
    "limitedReadOnly": false,
    "readOnly": true,
    "liveExecutionEnabled": false,
    "automaticTradingAllowed": false,
    "message": "License active.",
    "warnings": []
  },
  "plan": "PRO",
  "devices": [],
  "sessions": [],
  "permissions": {
    "dashboardAccess": "FULL",
    "canManageLicenses": false,
    "canManageUsers": false,
    "canManageConnectors": true,
    "canReadMarket": true,
    "canReadJournal": true,
    "liveExecutionEnabled": false,
    "automaticTradingAllowed": false
  },
  "session": {
    "id": "server-session-id",
    "expiresAt": "2026-06-12T12:15:00.000Z",
    "refreshExpiresAt": "2026-06-12T20:00:00.000Z",
    "mustRefreshAt": "2026-06-12T12:15:00.000Z"
  },
  "readOnly": true,
  "liveExecutionEnabled": false,
  "automaticTradingAllowed": false,
  "secretsExposed": false
}
```

Never returned:

- password hash
- raw password
- JWT
- refresh token
- raw `licenseKey`
- connector API tokens
- broker credentials

## Security Notes

- `JWT_SECRET` or `APP_SECRET_KEY` must be a long random value in production.
- `RAZON_ADMIN_PASSWORD` must be set in production. The local fallback is only for development.
- Password reset currently creates a server-side reset token but does not deliver email. Email delivery must be integrated before production password reset is enabled for end users.
- Current in-memory auth state is suitable for local/dev continuity with the existing in-memory license engine. Production should replace repositories with durable server storage before multi-instance deployment.
- License keys and temporary passwords are one-time admin outputs and must be handled as secrets by the operator.

