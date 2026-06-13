# HOSTINGER PRODUCTION VERIFICATION

Date: 2026-06-13  
Domain: https://razon.generaltechconsult.com  
Backend API: https://razon-api.onrender.com  
Status: **HOSTINGER_BLOCKED**

## Executive Summary

Hostinger now serves the current RAZON frontend build, including the personal Deriv DEMO connector UI. SPA routing works for the required routes.

The Hostinger deployment cannot be marked fully ready because the authenticated functional flow is blocked by backend auth/runtime state:

- admin login with available local credentials returns `401 INVALID_CREDENTIALS`
- newly created beta accounts exist in Supabase but are not visible to the currently running Render process until restart/reload
- `/api/status.persistence.lastError` currently reports a Postgres flush error: `null value in column "role_id" of relation "users" violates not-null constraint`
- Local code fix prepared: `backend/src/modules/users/users.service.ts` now ignores `undefined` partial-update fields, preventing accidental `role` erasure before Postgres flush.

## Domain and SSL

| Check | Result | Evidence |
|---|---:|---|
| `https://razon.generaltechconsult.com/` | PASS | HTTP 200, `text/html` |
| SSL/HTTPS | PASS | HTTPS requests succeed |
| No 403/404 on main app | PASS | `/`, `/login`, `/cockpit`, `/settings`, `/kalos` return 200 |

## Published Build

| Check | Result | Evidence |
|---|---:|---|
| `index.html` references current JS | PASS | `/assets/index-DfNOw71b.js` |
| CSS asset | PASS | `/assets/index-CzFsvVVM.css` |
| Current local build match | PASS | local `dist/public/index.html` references `/assets/index-DfNOw71b.js` |
| Old bad API URL absent | PASS | no `razon.generaltechconsult.com/api` in prod bundle |
| Render API URL present | PASS | `razon-api.onrender.com` present in prod bundle |
| Deriv personal connector UI present | PASS | `PERSONAL_DERIV_DEMO` / `Connecter mon compte Deriv DEMO` found |

Note: legacy request `/assets/index-x-QtwwJ_.js` returns HTML fallback, not the old JavaScript bundle. The active `index.html` no longer references it.

## Public File Checks

| Path | Result | Evidence |
|---|---:|---|
| `/manifest.json` | PASS | HTTP 200 `application/json` |
| `/sw.js` | PASS | HTTP 200 JavaScript |
| `/favicon.svg` | PASS | referenced by `index.html` |
| `/.env` | PASS SAFE | returns SPA HTML, no env file content exposed |
| `/favicon.ico` | WARNING | returns SPA HTML; app references `favicon.svg` instead |

Direct file-manager verification of `public_html/razon/` could not be completed because the Hostinger MCP calls returned `401 AUTH_REQUIRED`.

## SPA Routing

| Route | Result | Evidence |
|---|---:|---|
| `/` | PASS | HTTP 200, app HTML |
| `/login` | PASS | HTTP 200, app HTML |
| `/cockpit` | PASS | HTTP 200, app HTML |
| `/settings` | PASS | HTTP 200, app HTML |
| `/kalos` | PASS | HTTP 200, app HTML |

## Frontend to Backend

| Check | Result | Evidence |
|---|---:|---|
| API base points to Render | PASS | production bundle contains `razon-api.onrender.com` |
| Bad same-domain API absent | PASS | production bundle does not contain `razon.generaltechconsult.com/api` |
| Backend status | PASS/WARNING | `/api/status` HTTP 200, but persistence `lastError` is non-null |
| CORS Hostinger origin | PASS | preflight returns 204 with `Access-Control-Allow-Credentials: true` |

Backend status observed:

- `liveExecutionEnabled=false`
- `automaticTradingAllowed=false`
- `persistence.provider=postgres`
- `persistence.configuredProvider=postgres`
- `persistence.initialized=true`
- `persistence.lastError="null value in column \"role_id\" of relation \"users\" violates not-null constraint"`

## Functional Auth Flow

| Check | Result | Cause |
|---|---:|---|
| login admin | BLOCKED | available local admin credentials return `401 INVALID_CREDENTIALS` |
| création user | BLOCKED | admin auth unavailable |
| création licence | BLOCKED | admin auth unavailable |
| first login | BLOCKED | new beta accounts not loaded by current Render memory |
| changement mot de passe | BLOCKED | login unavailable |
| logout | BLOCKED | login unavailable |
| reconnect | BLOCKED | login unavailable |

## Connectors UI

| UI/content check | Result |
|---|---:|
| `Connecter mon compte Deriv DEMO` | PASS |
| `PERSONAL_DERIV_DEMO` | PASS |
| `Save token` | PASS |
| test connection path present | PASS |

End-to-end save/test could not be completed because authenticated login is blocked.

## Security

| Check | Result |
|---|---:|
| No `.env` exposed | PASS |
| No raw frontend secret found in local `dist/public` | PASS |
| LIVE OFF | PASS |
| AUTO EXECUTION OFF | PASS |
| No buy/sell/order/proposal backend routes found | PASS |
| CORS strict for production frontend | PASS |

## Required Fixes

1. Restore/confirm a valid production OWNER/ADMIN login.
2. Deploy the local `UsersService.update()` fix.
3. Restart/reload Render backend after Supabase beta-account creation so in-memory SaaS auth state rehydrates.
4. Confirm `/api/status.persistence.lastError=null`.
5. Re-run authenticated production smoke:
   - admin login
   - create user/license
   - first login
   - change password
   - cockpit/settings/kalos authenticated
   - Deriv DEMO save/test
   - logout/reconnect

## Final Result

**HOSTINGER_BLOCKED**

Hostinger static deployment itself is current, but full production readiness is blocked by backend authentication/runtime persistence state.
