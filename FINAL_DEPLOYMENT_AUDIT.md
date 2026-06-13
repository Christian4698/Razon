# FINAL DEPLOYMENT AUDIT - RAZON

Date: 2026-06-13

## Statut global

**BLOCKED**

**Score global: 74 / 100**

Decision finale: RAZON ne doit pas etre valide en beta/production tant que le frontend Hostinger n'appelle pas l'API Render et tant que les routes SPA directes ne sont pas servies correctement. Le backend Render et Supabase/Postgres sont globalement prets, mais le parcours utilisateur public est bloque.

## Scores

| Domaine | Score |
| --- | ---: |
| Backend | 18 / 20 |
| Frontend | 7 / 20 |
| Auth & Licenses | 16 / 20 |
| Database | 15 / 15 |
| Security | 14 / 15 |
| UX | 4 / 10 |

## Backend Render

Endpoint: `https://razon-api.onrender.com`

Points valides:

- `GET /api/status`: HTTP 200.
- Persistence: `provider=postgres`, `enabled=true`, `configuredProvider=postgres`, `initialized=true`, `lastError=null`.
- `liveExecutionEnabled=false`.
- `automaticTradingAllowed=false`.
- `GET /api/me` sans session: HTTP 401 `AUTH_REQUIRED`.
- `POST /api/auth/login` OWNER: HTTP 200, role `OWNER`, plan `LIFETIME`, licence `ACTIVE`.
- `GET /api/me` apres login: HTTP 200, `dashboardAccess=FULL`.
- `POST /api/auth/logout`: HTTP 200, puis `/api/me` retourne 401.
- Cookies auth: `HttpOnly`, `Secure`, `SameSite=Lax`.
- CORS autorise `https://razon.generaltechconsult.com` avec credentials.
- CORS refuse une origine non autorisee.
- Routes interdites testees: `/api/order`, `/api/orders`, `/api/buy`, `/api/sell`, `/api/proposal` retournent 404.
- Rate limit login actif: 429 obtenu apres tentatives invalides repetees.

Point a surveiller:

- Pendant le cleanup de comptes d'audit, un flush a temporairement produit `role_id null`; l'etat final est revenu a `lastError=null` apres correction des comptes test via `PATCH /api/admin/users/:id`. A renforcer apres beta par un flush explicite ou une verification transactionnelle apres actions admin.

## Frontend Hostinger

Endpoint: `https://razon.generaltechconsult.com`

Points valides:

- La racine `/` charge l'application.
- Assets principaux charges: JS, CSS, manifest, favicon, icones.
- Login visible depuis `/` apres redirection client vers `/login?next=%2F`.
- Vue mobile racine/login sans overflow horizontal detecte.
- Aucun secret reel detecte dans le bundle frontend deploye.

Points bloquants:

- `https://razon.generaltechconsult.com/login` retourne HTTP 404 Hostinger `This Page Does Not Exist`.
- Routes directes testees `/cockpit`, `/settings`, `/kalos`, `/chart` retournent aussi HTTP 404 Hostinger.
- Le bundle deploye ne contient pas `https://razon-api.onrender.com`.
- Le bundle deploye contient des appels relatifs `/api/...`.
- Tentative login depuis le frontend public:
  - `GET https://razon.generaltechconsult.com/api/me` -> 404.
  - `POST https://razon.generaltechconsult.com/api/auth/login` -> 404.
- Donc le login Hostinger appelle Hostinger `/api/*`, pas Render.
- Redirection cockpit et logout frontend live non validables tant que le login frontend est bloque.

Screenshots d'audit:

- `output/playwright/final-audit-root-desktop.png`
- `output/playwright/final-audit-root-after-login-desktop.png`
- `output/playwright/final-audit-root-mobile.png`
- `output/playwright/final-audit-login-desktop.png`
- `output/playwright/final-audit-login-mobile.png`

## Supabase / Postgres

Projet: `pvoztowlhdirmruwanzl`

Points valides:

- Connexion Postgres OK: PostgreSQL 17.6.
- Tables requises presentes: `users`, `roles`, `licenses`, `subscriptions`, `sessions`, `audit_logs`, `devices`, `connector_secrets`.
- Roles presents: `OWNER`, `ADMIN`, `USER`.
- `OWNER` existe avec permissions owner/admin.
- Un seul OWNER actif.
- Une licence `LIFETIME ACTIVE` pour l'OWNER.
- Comptes d'audit crees pendant le test: `DISABLED`.
- Licences d'audit: `REVOKED`.
- RLS actif sur toutes les tables requises.
- Aucun grant public dangereux pour `anon`, `authenticated`, `PUBLIC`.
- `service_role` conserve les grants backend necessaires.
- Passwords hashes: presents avec salt et iterations >= 120000.
- Refresh tokens hashes: presents, longueur 64, aucun token brut detecte.
- License keys: hash stocke, preview uniquement.
- `connector_secrets`: 0 ligne au moment de l'audit; pas de secret expose.
- `supabase db advisors --db-url ... --type all --level warn`: No issues found.

## Securite

Points valides:

- LIVE OFF partout dans les reponses testees.
- AUTO EXECUTION OFF partout dans les reponses testees.
- Aucune route d'ordre exposee.
- Connectors health declare `orderRoutesExposed=false`, `buySellRoutesExposed=false`, `proposalRoutesExposed=false`.
- Deriv Demo affiche un statut propre cote API: `DISCONNECTED` / read-only / order placement false.
- Secrets backend-only: aucun `SUPABASE_DB_URL`, `postgresql://`, `service_role`, `DERIV_API_TOKEN`, `MT5_PASSWORD`, `RAZON_ADMIN_PASSWORD`, `JWT_SECRET`, `APP_SECRET_KEY`, `ENCRYPTION_KEY` dans le frontend public.
- `.env` public: `https://razon.generaltechconsult.com/.env` retourne 404.
- CORS strict cote Render.
- Cookies securises cote Render.

Points a ameliorer:

- Retirer le debug collector Manus du build public si inutile en beta.
- Supprimer les chemins sources absolus du bundle production si possible.
- Ajouter une verification post-action admin qui confirme que Supabase a bien persiste l'etat attendu.

## Admin / Licences

Points valides cote API Render:

- Login OWNER OK.
- `mustChangePassword=true` expose correctement.
- Admin users/licenses accessibles apres login OWNER.
- Creation utilisateur test OK.
- Creation licence test OK.
- Suspension licence test OK.
- Licence expiree testee: `LIMITED_READ_ONLY`, `dashboardBlocked=true`.
- Cleanup final: utilisateurs test `DISABLED`, licences test `REVOKED`.

Point non valide cote frontend:

- `Settings > License` non validable en live Hostinger car le frontend ne peut pas se connecter a Render.

## KALOS / Marche

Points valides cote API Render avec session:

- `/api/markets/snapshot`: HTTP 200.
- `/api/kalos`: HTTP 200.
- `/api/markets/hub`: HTTP 200.
- `/api/markets/scanner`: HTTP 200.
- `/api/connectors/health`: HTTP 200.
- Deriv Demo status affiche proprement cote API.
- Pas d'ordre reel.
- Pas de LIVE.

Point non valide cote frontend:

- Dashboard/KALOS/market chart/watchlist non validables via Hostinger apres login, car le login appelle Hostinger `/api/auth/login` et echoue en 404.

## Verification locale

Commandes passees:

- `pnpm check`: PASS.
- `pnpm exec vitest run --config backend/tests/vitest.config.mjs`: PASS, 17 fichiers, 81 tests.
- `pnpm run build`: PASS.

Warnings non bloquants:

- Vite signale un gros chunk > 500 kB.
- `optimizeDeps.rollupOptions` est deprecie.
- Supabase CLI installee: 2.98.2; nouvelle version disponible 2.106.0.

## Points bloquants

1. Le frontend deploye sur Hostinger utilise des appels relatifs `/api/*` au lieu de `https://razon-api.onrender.com`.
2. Hostinger ne proxy pas `/api/*` vers Render: `/api/status`, `/api/me`, `/api/auth/login` retournent 404 cote Hostinger.
3. Hostinger ne sert pas `index.html` pour les routes SPA directes: `/login`, `/cockpit`, `/settings`, `/kalos`, `/chart` retournent 404.
4. Le login, la redirection cockpit, Settings > License, logout et KALOS frontend ne sont pas validables en conditions beta publiques.

## Actions requises avant beta

1. Configurer le frontend pour appeler explicitement Render:
   - soit via une constante `API_BASE_URL=https://razon-api.onrender.com`,
   - soit via un helper `apiFetch()` qui prefixe toutes les routes `/api`.
2. Remplacer les `fetch('/api/...')` du frontend par le helper API.
3. Redeployer le frontend Hostinger.
4. Configurer Hostinger pour fallback SPA: toutes les routes non-fichier doivent servir `index.html`.
5. Refaire le smoke test navigateur:
   - `/login` charge l'app.
   - login appelle Render.
   - cockpit charge.
   - Settings > License accessible OWNER.
   - logout OK.
   - mobile OK.

## Decision finale

**BLOCKED avec score 74 / 100.**

RAZON est solide cote backend, Supabase et securite d'execution, mais la beta publique est bloquee par le frontend deploye. Validation beta possible apres correction du routage API frontend et du fallback SPA Hostinger, puis re-audit rapide du parcours login -> cockpit -> settings -> logout.
