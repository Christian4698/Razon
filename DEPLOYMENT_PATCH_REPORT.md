# RAZON Deployment Patch Report

Date: 2026-06-13

## Status

Patch status: READY_FOR_BETA artifact prepared.

Production publication status: pending Hostinger authentication. The Hostinger connector returned `AUTH_REQUIRED`, so the live domain still serves the previous deployment at the time of verification.

## Scope Guard

No changes were made to:

- Supabase
- Admin bootstrap
- LIVE execution
- Trading execution
- Backend Render
- Auth security model
- Order/buy/sell routes

## Root Cause

The production frontend was resolving API calls against the Hostinger origin:

```text
https://razon.generaltechconsult.com/api/*
```

The real backend is:

```text
https://razon-api.onrender.com
```

## URL Change

Old production API target:

```text
https://razon.generaltechconsult.com/api/*
```

New production API target:

```text
https://razon-api.onrender.com/api/*
```

Development API target:

```text
http://localhost:10000/api/*
```

## Files Modified

| File | Change |
| --- | --- |
| `.env.production` | Defines `VITE_API_BASE_URL=https://razon-api.onrender.com` and `API_BASE_URL=https://razon-api.onrender.com`. Removed unsupported `NODE_ENV=production` from Vite env. |
| `.env.local` | Defines `VITE_API_BASE_URL=http://localhost:10000` and `API_BASE_URL=http://localhost:10000` for development. |
| `.htaccess` | SPA fallback for Hostinger root deployment. |
| `client/public/.htaccess` | Added SPA fallback so Vite copies it into `dist/public/.htaccess`. |
| `client/src/lib/api.ts` | Exports `API_BASE_URL` from Vite env and prefixes `razonApi()` requests. |
| `client/src/auth/AuthProvider.tsx` | Prefixes auth calls including `/api/me`, `/api/auth/login`, logout, password reset/change. |
| `frontend/app/RazonCockpit.tsx` | Prefixes cockpit backend calls for connectors, license, market snapshot, and KALOS. |
| `frontend/settings/LicenseSettingsPanel.tsx` | Prefixes admin/license API calls. |
| `frontend/connectors/ConnectorSettingsPanel.tsx` | Prefixes connector action API calls. |

## Request Examples

Before:

```ts
fetch("/api/status")
fetch("/api/me")
fetch("/api/auth/login")
```

After:

```ts
fetch(`${API_BASE_URL}/api/status`)
fetch(`${API_BASE_URL}/api/me`)
fetch(`${API_BASE_URL}/api/auth/login`)
```

## SPA Hostinger Fallback

Configured fallback:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

Verified generated artifact:

```text
dist/public/.htaccess present
```

## Tests Performed

### Static Search

Passed:

- No remaining `fetch('/api...')` calls in application code.
- No remaining `fetch("/api...")` calls in application code.
- No `razon.generaltechconsult.com/api` references in the built frontend artifact.
- `https://razon-api.onrender.com` is present in the generated JS bundle.

Known non-app matches:

- `vite.config.ts` contains an unrelated Manus storage proxy.
- `client/src/components/Map.tsx` contains an unrelated maps proxy constant.
- Backend provider config contains unrelated `FOREX_API_BASE_URL`.

### Build

Command:

```text
pnpm run build
```

Result:

```text
PASS
```

Notes:

- Vite build completed.
- Server bundle completed.
- Non-blocking warnings remain for chunk size and a Vite plugin deprecation.
- The previous `NODE_ENV=production` env warning was removed.

### Remote Verification

Render backend:

```text
GET https://razon-api.onrender.com/api/status -> 200
```

Hostinger live domain before successful publication:

```text
GET https://razon.generaltechconsult.com/ -> 200
GET https://razon.generaltechconsult.com/login -> 404
GET https://razon.generaltechconsult.com/cockpit -> 404
GET https://razon.generaltechconsult.com/settings -> 404
GET https://razon.generaltechconsult.com/kalos -> 404
```

Hostinger deployment attempt:

```text
hosting_deployStaticWebsite -> AUTH_REQUIRED
```

## Final Assessment

Local deployment artifact is READY_FOR_BETA and should raise the patch score to >= 90/100 once published to Hostinger.

Live production is not yet fully READY_FOR_BETA because Hostinger rejected the deployment request with `AUTH_REQUIRED`; the public domain still needs the freshly built `dist/public` contents uploaded with authenticated Hostinger access.
