# BETA TESTER ACCOUNTS

Date: 2026-06-13  
Environment: Supabase/Postgres production `razon-production`  
Backend: https://razon-api.onrender.com  
Status: **BLOCKED**

## Summary

The two permanent beta tester accounts were created directly in Supabase/Postgres with hashed passwords only.

Database validation passed:

- both users exist
- both users have `mustChangePassword=true`
- both users have `firstLoginCompleted=false`
- both users have `LIFETIME ACTIVE` licenses
- no raw password was stored in Supabase

Runtime validation is currently blocked:

- `POST /api/auth/login` for both beta accounts returns `401 INVALID_CREDENTIALS`.
- Root cause: Render backend keeps SaaS auth/license state in memory after startup. Direct Supabase inserts are persistent, but the currently running Render process has not rehydrated/restarted.
- Additional backend signal: `/api/status.persistence.lastError` is currently `null value in column "role_id" of relation "users" violates not-null constraint`, indicating persistence flush is not fully clean.
- Local code fix prepared: `backend/src/modules/users/users.service.ts` now ignores `undefined` fields in partial updates so `role` cannot be erased during a flush.

## One-Shot Temporary Passwords

These passwords are shown once here for project handoff. They must be changed at first login.

| Nom | Username | Email | Role | Plan | Statut licence | Mot de passe temporaire | Instruction |
|---|---|---|---|---|---|---|---|
| Zeus | `zeus` | `zeus@razon.local` | `USER` | `LIFETIME` | `ACTIVE` | `Rzn-2vg4NQUv-2026` | à changer au premier login |
| Joseph | `joseph` | `joseph@razon.local` | `USER` | `LIFETIME` | `ACTIVE` | `Rzn-i6anmRhK-2026` | à changer au premier login |

## Supabase Validation

Validated rows:

| Username | Email | Role | User status | mustChangePassword | firstLoginCompleted | Plan | License status |
|---|---|---|---|---:|---:|---|---|
| `zeus` | `zeus@razon.local` | `USER` | `ACTIVE` | true | false | `LIFETIME` | `ACTIVE` |
| `joseph` | `joseph@razon.local` | `USER` | `ACTIVE` | true | false | `LIFETIME` | `ACTIVE` |

## Security Notes

- Passwords were generated uniquely per user.
- Supabase stores only PBKDF2-SHA256 password hashes, salts, and iteration count.
- License keys were generated and stored as hashes/previews only.
- No public registration route was added.
- LIVE remains OFF.
- AUTO EXECUTION remains OFF.
- No buy/sell/order/proposal route was created.

## Required Next Step

Deploy the local `UsersService.update()` fix, then restart or reload the Render backend so it rehydrates from Supabase/Postgres.

After restart, re-run:

1. login `zeus` with the one-shot temporary password
2. confirm redirect to `/change-password`
3. change password
4. confirm `/api/me` returns `zeus`, `USER`, `LIFETIME ACTIVE`
5. confirm cockpit access
6. repeat for `joseph`

## Final Result

**BLOCKED**

Cause exacte: comptes persistés en Supabase, mais le backend Render courant ne les a pas chargés en mémoire et retourne `401 INVALID_CREDENTIALS`.
