# RAZON Pre-Production Checklist Final

## Verdict

`BLOCKED_FOR_DEPLOYMENT`

The application code passes the beta safety and auth gates, but deployment remains blocked until durable Supabase/PostgreSQL persistence is configured and verified on the target environment.

Local production smoke test was intentionally run with `SAAS_PERSISTENCE=memory`; a controlled beta must run with `SAAS_PERSISTENCE=postgres` and a migrated Supabase/Postgres database.

## Auth Policy

- Public registration: `PASS`
- Public Sign Up / Register / Create Account UI: `PASS`
- Public self-onboarding: `PASS`
- Public license activation button: `PASS`
- User account creation path: `ADMIN_ONLY`
- License assignment path: `ADMIN_ONLY`
- Standard user self license activation: `BLOCKED`

Required flow:

1. Admin creates user.
2. Admin assigns role.
3. Admin creates or assigns license.
4. Admin sends temporary password/access.
5. User logs in.
6. User changes password.
7. User accesses cockpit only if license is active.

Allowed public/user auth flows:

- Login
- Logout
- Forgot password
- Reset password
- Edit profile

Validated behavior:

- `/dashboard` unauthenticated redirects to `/login`.
- Login page visible buttons: `Toggle password visibility`, `Forgot password`, `Sign In`.
- No visible `Create Account`, `Register`, `Sign Up`, or `Activate License`.
- `/api/admin/users` requires `ADMIN`.
- `/api/licenses/create` requires `ADMIN`.
- `/api/licenses/activate` returns `403 SELF_LICENSE_ACTIVATION_DISABLED` for standard users.

## Runtime Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Auth required before dashboard | `PASS` | Browser smoke test redirects `/dashboard` to `/login`. |
| License required before cockpit | `PASS` | Protected APIs behind auth/license gate; missing/non-active license blocks cockpit. |
| Sessions work | `PASS` | Login returns valid session and `/api/me` returns `200`. |
| Logout works | `PASS` | After logout, `/api/me` returns `401`. |
| Deriv DEMO connected | `PASS` | `deriv-demo` reports `CONNECTED_DEMO`, `CONNECTED`, `DEMO`. |
| Secrets not exposed | `PASS` | Health/snapshot responses do not expose `pat_`, token fields, or `DERIV_API_TOKEN`. |
| Cookies httpOnly | `PASS` | Production login cookie includes `HttpOnly`. |
| Cookies secure | `PASS` | Production login cookie includes `Secure`. |
| Cookies sameSite | `PASS` | Production login cookie includes `SameSite=Lax`. |
| CORS exact GTC subdomain | `PASS` | `https://app.gtc.example` returns `204` and matching allow-origin. |
| CORS wildcard GTC subdomain | `PASS` | `https://beta.gtc.example` returns `204` and matching allow-origin. |
| LIVE OFF | `PASS` | `/api/status liveExecutionEnabled=false`. |
| AUTO EXECUTION OFF | `PASS` | `/api/status automaticTradingAllowed=false`. |
| No order routes | `PASS` | Route scan finds no buy/sell/order/proposal route. |
| Production build | `PASS` | `pnpm run build` completed. |
| Production start | `PASS` | `node dist/index.js` started and served `/api/status`. |
| Production variables listed | `PASS` | `.env.production.example` exists. |
| Durable storage configured | `BLOCKER` | Current smoke runtime used memory; Supabase/Postgres target not verified. |

## Deriv DEMO Smoke

Authenticated production smoke result:

- Connector: `deriv-demo`
- Connector status: `CONNECTED_DEMO`
- Source status: `CONNECTED`
- Runtime mode: `DEMO`
- Read-only: `true`
- Live blocked: `true`
- Order placement allowed: `false`
- Snapshot symbol: `Boom 500`
- Snapshot source label: `Deriv DEMO Read-Only`
- Snapshot data quality: `HEALTHY`

## Required Production Variables

Use `.env.production.example` as the deployment template.

Mandatory for beta:

- `NODE_ENV=production`
- `APP_BASE_URL=https://app.gtc.example`
- `CORS_ORIGIN=https://app.gtc.example,https://*.gtc.example`
- `TRUST_PROXY=true`
- `SAAS_PERSISTENCE=postgres`
- `SAAS_PERSISTENCE_PROVIDER=postgres`
- `SUPABASE_DB_URL=postgresql://...`
- `DATABASE_SSL=true`
- `JWT_SECRET`
- `APP_SECRET_KEY`
- `ENCRYPTION_KEY`
- `RAZON_ADMIN_PASSWORD`
- `ENABLE_LIVE_TRADING=false`
- `ALLOW_AUTO_EXECUTION=false`
- `DERIV_ALLOW_ORDER_PLACEMENT=false`
- `MT5_ALLOW_ORDER_PLACEMENT=false`

## Supabase/Postgres Gate

Before beta deployment:

1. Create the production Supabase/Postgres project.
2. Apply `infrastructure/supabase/migrations/001_saas_persistence.sql`.
3. Confirm tables exist:
   - `users`
   - `roles`
   - `licenses`
   - `subscriptions`
   - `devices`
   - `sessions`
   - `connector_secrets`
   - `audit_logs`
4. Confirm RLS is enabled on every table.
5. Confirm `anon` and `authenticated` have no direct table access.
6. Confirm backend uses direct Postgres connection only.
7. Confirm no service-role or database secret is exposed to frontend.
8. Run Supabase security advisors when a project id is available.
9. Confirm `/api/status.persistence.provider=postgres`.
10. Confirm `/api/status.persistence.enabled=true`.

## Validation Commands

Completed locally:

```bash
pnpm check
pnpm run build
pnpm exec vitest -c backend/tests/vitest.config.mjs
```

Results:

- TypeScript: `PASS`
- Production build: `PASS`
- Backend tests: `16 files / 80 tests PASS`
- Production smoke start: `PASS`

Known non-blocking build warning:

- Vite reports large client chunks above 500 kB.

## Security Notes

- Full `$codex-security:deep-security-scan` was not completed in this edit phase because that workflow requires a separate no-edit, multi-worker repository scan.
- A targeted pre-production security validation was completed for auth policy, cookies, CORS, secret exposure, LIVE/AUTO guards, and order-route absence.
- Hostinger was not used for deployment. Hostinger remains documentation-only until Supabase persistence is verified.

## Deployment Decision

`BLOCKED_FOR_DEPLOYMENT`

Only blocker: durable production persistence is not yet connected and verified.

Once Supabase/Postgres is configured, migrated, advisor-checked, and `/api/status` reports `provider=postgres` with `enabled=true`, RAZON can move to controlled beta as `READY_FOR_BETA`.
