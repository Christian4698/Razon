# RAZON Supabase Setup

Status date: 2026-06-13

## Project

- Supabase project: `razon-production`
- Project ref: `pvoztowlhdirmruwanzl`
- Region: `eu-central-1`
- Database engine: PostgreSQL 17
- Deployment status: no deploy performed

## Applied Schema

The migration `infrastructure/supabase/migrations/001_saas_persistence.sql` has been applied to the Supabase project.

Validated tables:

- `users`
- `roles`
- `licenses`
- `subscriptions`
- `devices`
- `sessions`
- `connector_secrets`
- `audit_logs`

Validation result:

- All required tables exist.
- RLS is enabled on every required table.
- `anon` and `authenticated` have no table grants on the SaaS persistence tables.
- `roles` is seeded with `ADMIN` and `USER`.

## Runtime Configuration

Production must use backend-only environment secrets:

```env
SAAS_PERSISTENCE=postgres
SAAS_PERSISTENCE_PROVIDER=postgres
SUPABASE_PROJECT_REF=pvoztowlhdirmruwanzl
SUPABASE_URL=https://pvoztowlhdirmruwanzl.supabase.co
SUPABASE_DB_URL=postgresql://postgres.pvoztowlhdirmruwanzl:<database-password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
```

`DATABASE_URL` is optional and should only be set when the host requires that variable name. Do not set `DATABASE_URL=${SUPABASE_DB_URL}` unless the host explicitly supports environment variable expansion.

## Security Model

- No Supabase database password is committed.
- No service-role key is required by the frontend.
- Connector secrets stay backend-only and are stored encrypted.
- License keys are generated server-side and only the hash is persisted.
- Refresh tokens are hashed before persistence.
- Cookies remain httpOnly.
- LIVE remains OFF.
- Auto execution remains OFF.
- No route buy/sell/order/proposal is added.
- Public registration remains forbidden: accounts are created only by `SUPER_ADMIN` or `ADMIN`.

## Advisors

Security advisor:

- Remaining `INFO`: RLS enabled with no policy on backend-only tables.
- This is expected because the app uses direct backend Postgres access and has revoked `anon`/`authenticated` grants.

Performance advisor:

- Foreign-key indexes were added for `users.role_id`, `devices.user_id`, `sessions.device_id`, and `subscriptions.license_id`.
- Remaining `INFO`: unused indexes, expected on an empty/new database.

## Runtime Check Target

After setting the backend-only DB URL, `GET /api/status` must include:

```json
{
  "persistence": {
    "provider": "postgres",
    "enabled": true
  },
  "liveExecutionEnabled": false,
  "automaticTradingAllowed": false
}
```

If the database URL is missing or invalid, RAZON must report active provider `memory`, `enabled=false`, `configuredProvider=postgres`, and a `lastError`.

## Local Verification Performed

Commands run:

```bash
pnpm check
pnpm run build
pnpm exec vitest run --config backend/tests/vitest.config.mjs
```

Result:

- TypeScript check passed.
- Production build passed.
- Backend test suite passed: 17 test files, 81 tests.
- Production status smoke with `SAAS_PERSISTENCE=postgres` but no Supabase DB URL returned:

```json
{
  "liveExecutionEnabled": false,
  "automaticTradingAllowed": false,
  "persistenceProvider": "memory",
  "persistenceEnabled": false,
  "configuredProvider": "postgres",
  "hasLastError": true
}
```

This is the expected blocked state until the backend receives the real Supabase Postgres URL through a secret manager.

After providing the backend-only Supabase DB URL through the process environment, the production status smoke returned:

```json
{
  "liveExecutionEnabled": false,
  "automaticTradingAllowed": false,
  "persistenceProvider": "postgres",
  "persistenceEnabled": true,
  "configuredProvider": "postgres",
  "initialized": true,
  "hasLastError": false
}
```

Auth/admin smoke result:

- Admin login passed.
- `/api/me` returned `ADMIN`.
- Admin create user passed.
- Admin create license passed.
- Expired license returned `EXPIRED` and read-only access.
- Temporary QA rows were deleted after validation.
