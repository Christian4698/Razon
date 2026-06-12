# RAZON - Fix Report

Phase: Stabilisation / correction uniquement
Status: BUILD GREEN
Date: 2026-06-05

No new module, connector, page, strategy, product behavior, AI capability or
button was added.

## Corrige

### 1. Global TypeScript check failed

PROBLEME

`pnpm check` failed on legacy server files.

CAUSE

- `server/services/kalos/indicators.ts` returned widened `string` values for
  BOS/CHOCH.
- `server/services/market/marketProvider.ts` used a union type that did not
  safely expose `tick`, `error` and `candles`.
- `server/services/razonMarketDataService.ts` used nullable market inputs as
  numbers.

CORRECTION

- Added explicit BOS/CHOCH return typing.
- Replaced the unsafe Deriv message union with a single optional-property type.
- Added numeric fallback normalization before rounding and candle simulation.

RISQUE

Low. The corrections are type and safety guards only. They do not change the
intended product behavior.

VALIDATION

- `pnpm check` passes.
- `pnpm run build` passes.

Impact: global compilation blocker removed.

Decision: fixed.

### 2. Dependency audit reported critical/high vulnerabilities

PROBLEME

`pnpm audit --audit-level moderate` reported 76 vulnerabilities, including
critical and high findings.

CAUSE

Vulnerable direct and transitive dependency versions were present in the
installed graph, including paths through Vite/Vitest, pnpm, tar, Rollup, Axios,
qs, Mermaid, DOMPurify and uuid.

CORRECTION

- Ran `pnpm audit --fix --audit-level high`.
- Applied the lockfile with `pnpm install`.
- Aligned `esbuild` with the updated Vite peer requirement.
- Updated `pnpm-lock.yaml` and package security overrides.

RISQUE

Medium. Dependency updates can introduce compatibility issues. This was
mitigated by rerunning TypeScript, tests, build and audit.

VALIDATION

- `pnpm audit --audit-level moderate` reports no known vulnerabilities.
- `pnpm check` passes.
- Backend tests pass.
- `pnpm run build` passes.

Impact: release security blocker removed.

Decision: fixed.

### 3. Production encryption fallback was too weak

PROBLEME

The encryption service could fall back to local XOR-style encryption when
WebCrypto/AES-GCM was unavailable.

CAUSE

The fallback existed for local compatibility but was not appropriate for
production hardening.

CORRECTION

- Production runtime now requires AES-GCM encryption/decryption.
- Production runtime now requires secure random generation.
- Local fallback remains available only outside production.

RISQUE

Low to medium. Old runtimes without WebCrypto will now fail closed in
production, which is the intended safety behavior.

VALIDATION

- `pnpm check` passes.
- Backend tests pass.
- `pnpm run build` passes.

Impact: production secret handling is safer.

Decision: fixed.

### 4. Frontend public API key query usage

PROBLEME

`client/src/components/Map.tsx` referenced `VITE_FRONTEND_FORGE_API_KEY` and
placed it in a script URL query parameter.

CAUSE

The legacy map component used a frontend public environment key for a proxy
request.

CORRECTION

- Removed `VITE_FRONTEND_FORGE_API_KEY` usage from `Map.tsx`.
- The script now calls the proxy URL without exposing a frontend key query.

RISQUE

Low. This is a security cleanup in a legacy component. If the external proxy
requires a key query, it must be handled server-side, not through frontend
public variables.

VALIDATION

- `pnpm check` passes.
- `pnpm run build` passes.
- Search no longer finds `VITE_FRONTEND_FORGE_API_KEY` in `Map.tsx`.

Impact: reduced frontend secret exposure risk.

Decision: fixed.

## Non Corrige

### 1. Vite 8 deprecation warning from merged plugin config

PROBLEME

Build logs show:

`optimizeDeps.rollupOptions` / `ssr.optimizeDeps.rollupOptions` is deprecated.

CAUSE

The warning is produced during Vite config merging. No local
`optimizeDeps.rollupOptions` entry was found in `vite.config.ts`; the source is
likely one of the Vite plugins or its generated configuration.

CORRECTION

No source correction applied in this phase because removing or replacing a
plugin would be broader than stabilization-only scope.

RISQUE

Low. The build succeeds. This is a deprecation warning, not a runtime failure.

VALIDATION

- `pnpm run build` passes.
- `VITE_DEPRECATION_TRACE=1 pnpm run build` confirms the warning occurs during
  config merge.

Impact: non-blocking warning.

Decision: report v2 / monitor plugin updates.

### 2. Frontend dedicated tests remain missing

PROBLEME

QA identified no dedicated frontend test suite.

CAUSE

Current tests focus on backend RAZON modules.

CORRECTION

Not added in this phase to avoid expanding test infrastructure beyond the
critical stabilization blockers.

RISQUE

Medium for future UI changes. Low for current build stability because frontend
TypeScript and production build pass.

VALIDATION

- Targeted frontend TypeScript validation previously passed.
- `pnpm run build` passes.

Impact: UI regression coverage is still limited.

Decision: report v2 / add after MVP build stability is locked.

### 3. Install warning for ignored esbuild build scripts

PROBLEME

`pnpm install --frozen-lockfile` warns that esbuild build scripts are ignored.

CAUSE

The local pnpm environment blocks dependency build scripts unless approved.

CORRECTION

No repository change applied because the production build works and approving
build scripts is an environment policy decision.

RISQUE

Low in the current workspace because `pnpm run build` passes.

VALIDATION

- `pnpm install --frozen-lockfile` passes.
- `pnpm run build` passes.

Impact: environment warning only.

Decision: report v2 / document environment policy.

## Reporte V2

- Add frontend automated tests for cockpit and mobile states.
- Track/update Vite plugin deprecation warning.
- Define pnpm build-script approval policy for clean CI environments.
- Continue production security hardening beyond MVP demo.
- Implement future safety modules only after MVP stabilization remains green.

## Validation Finale

Commands executed:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm exec vitest run --config backend/tests/vitest.config.mjs
pnpm run build
pnpm audit --audit-level moderate
```

Results:

- `pnpm install --frozen-lockfile`: pass, with esbuild build-script warning.
- `pnpm check`: pass.
- Backend tests: pass, 8 files, 47 tests.
- `pnpm run build`: pass, with non-blocking Vite deprecation/plugin timing warnings.
- `pnpm audit --audit-level moderate`: pass, no known vulnerabilities.

## Build Status

GREEN

