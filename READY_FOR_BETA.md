# RAZON Beta Readiness

Status date: 2026-06-12

## Verdict

`READY_FOR_BETA`

## Ready

- Supabase project `razon-production` is active and healthy.
- SaaS persistence schema has been applied.
- Required tables exist: `users`, `roles`, `licenses`, `subscriptions`, `devices`, `sessions`, `connector_secrets`, `audit_logs`.
- RLS is enabled on all SaaS persistence tables.
- Public table grants for `anon` and `authenticated` are absent.
- Foreign-key indexes are present for the required SaaS relationships.
- Production env example points to the Supabase project without exposing a real password.
- Runtime persistence status now reports active provider truthfully: Postgres is `enabled=true` only after a successful DB connection.
- Supabase direct Postgres runtime has been validated with the backend using a temporary environment secret.
- LIVE is still OFF.
- Auto execution is still OFF.
- No deploy was performed.

## Validation Run

- `pnpm check`: passed.
- `pnpm run build`: passed.
- `pnpm exec vitest run --config backend/tests/vitest.config.mjs`: passed, 17 files / 81 tests.
- Production status smoke without Supabase DB URL: correctly blocked with active provider `memory`, configured provider `postgres`, `enabled=false`, `lastError` present.
- Production status smoke with backend-only Supabase DB URL: passed with active provider `postgres`, `enabled=true`, `lastError=false`.
- Auth/admin smoke with Supabase persistence: login passed, `/api/me` passed, admin create user passed, admin create license passed, expired license returned `EXPIRED` with read-only access.
- QA users/licenses/sessions created during smoke were deleted after validation.
- Route scan: no API route buy/sell/order/proposal was added.

## Beta Conditions

1. Store the real Supabase Postgres URL only in the backend/runtime secret manager.
2. Do not commit the real DB URL to the repository.
3. Keep `SAAS_PERSISTENCE=postgres` and `DATABASE_SSL=true` in beta runtime.
4. Keep `ENABLE_LIVE_TRADING=false`, `ALLOW_AUTO_EXECUTION=false`, and broker order placement disabled.
5. Create real customer accounts only through `SUPER_ADMIN` or `ADMIN`; public registration remains forbidden.

## Required Runtime Secrets

Set these server-only secrets in the deployment/runtime environment:

```env
SAAS_PERSISTENCE=postgres
SAAS_PERSISTENCE_PROVIDER=postgres
SUPABASE_DB_URL=<backend-only-supabase-postgres-url>
DATABASE_SSL=true
```

Then run:

```bash
pnpm check
pnpm run build
pnpm exec vitest run --config backend/tests/vitest.config.mjs
pnpm start
```

Required runtime confirmations:

- `GET /api/status` returns `liveExecutionEnabled=false`.
- `GET /api/status` returns `automaticTradingAllowed=false`.
- `GET /api/status` returns `persistence.provider=postgres`.
- `GET /api/status` returns `persistence.enabled=true`.
- Login works for an admin-created account.
- Expired license returns limited/read-only state.
- Admin can create user.
- Admin can create license.
- No public register/sign-up/create-account UI is visible.
- No buy/sell/order/proposal route exists.
- No secret appears in frontend responses, localStorage, or sessionStorage.
