# Razon Demo Validation Report

Date de validation: 2026-06-05

## Statut global

READY_FOR_DEMO

Razon est valide pour une demonstration controlee en mode `MOCK` / `DEMO`, sans argent reel et sans activation LIVE.

## Portee validee

- Aucun nouveau module cree.
- Aucun connecteur reel active.
- Aucune execution reelle activee.
- Aucune nouvelle IA ajoutee.
- Aucun changement architecture effectue pour cette validation.

## Flags de securite

Valeurs verifiees dans `.env.example`:

- `DEMO_MODE=true`
- `MODE_SIMULATION=true`
- `SIMULATION_MODE=true`
- `ENABLE_LIVE_TRADING=false`
- `ALLOW_LIVE_TRADING=false`
- `ALLOW_AUTO_EXECUTION=false`

Resultat: OK

## Pages testees

| Page | Validation | Resultat |
| --- | --- | --- |
| Cockpit | Serveur local `http://127.0.0.1:5173` repond en HTTP 200 | OK |
| Dashboard | Rendu React de controle contient `Dashboard`, `DEMO_MODE`, `MOCK`, `DEMO`, `LIVE OFF` | OK |
| Journal | Branche `activePage === "journal"` cablee vers `JournalPage` avec lignes demo et backtests | OK |
| Trading chart | Branche `activePage === "market-chart"` cablee vers `MarketChartPage`; `Market Chart` rendu dans le cockpit | OK |

Note: le navigateur integre `iab` n'etait pas disponible dans cette session. La validation visuelle a donc ete remplacee par un controle HTTP local, un rendu React temporaire et une verification des branches de navigation.

## Labels visibles

Labels confirmes dans le cockpit ou les composants:

- `DEMO_MODE`
- `MOCK`
- `DEMO`
- `LIVE OFF`
- `LIVE DISABLED`
- `Simulation only`
- `NO REAL ORDER`

Resultat: OK

## Donnees simulees

Les donnees de demonstration sont declarees dans `frontend/app/cockpit-data.ts`:

- `DEMO_MODE` actif.
- Capital simule: `10000 USD`.
- Graphique alimente par bougies OHLC simulees.
- Scenarios demo: `XAUUSD BUY`, `EURUSD NO_TRADE`, `GBPUSD WAIT`, `USDJPY SELL`.
- Journal demo avec decisions `BUY`, `SELL`, `WAIT`, `NO_TRADE`.
- Backtests demo en lecture seule avec sources `MOCK` / `DEMO`.

Resultat: OK

## BUY / SELL reel impossible

Preuves verifiees:

- Interface: `ManualBuySellPanel` affiche `NO REAL ORDER`.
- Interface: bouton statut `LIVE OFF` desactive.
- Confirmation obligatoire via `confirmDanger`.
- Action manuelle enregistre uniquement un message de simulation.
- Backend: `order-validator.ts` bloque `LIVE_TRADING_DISABLED` si `ENABLE_LIVE_TRADING` n'est pas `true`.
- Backend: validation refuse les donnees `MOCK`, le journal indisponible, les refus No-Trade et Risk Engine.
- Tests backend: 47 tests passent.

Resultat: OK

## Secrets broker

Controle effectue:

- Aucun fichier `.env` local trouve.
- `.env.example` ne contient aucune valeur broker non vide pour:
  - `MT5_LOGIN`
  - `MT5_ACCOUNT_ID`
  - `MT5_PASSWORD`
  - `DERIV_API_TOKEN`
  - `FOREX_API_KEY`
  - `FOREX_API_SECRET`
- Le frontend affiche seulement les noms de variables de securite, pas leurs valeurs.

Resultat: OK

## Validations techniques

- `pnpm check`: OK
- `pnpm exec vitest run --config backend/tests/vitest.config.mjs`: OK, 8 fichiers, 47 tests
- `pnpm run build`: OK
- `pnpm audit --audit-level moderate`: OK, aucune vulnerabilite connue

Warning non bloquant:

- Vite affiche un avertissement de deprecation pour `optimizeDeps.rollupOptions`. Ce warning ne bloque pas la demo.

## Risques restants

- Validation navigateur limitee par indisponibilite de l'instance `iab`.
- Les backtests et signaux demo restent des exemples simules, pas une preuve de performance reelle.
- Les connecteurs reels restent prepares mais non actives.
- Le mode LIVE doit rester interdit avant validation production.

## Limitations

- Demo uniquement en `MOCK` / `DEMO`.
- Aucun ordre broker reel.
- Pas de promesse de gain.
- Pas de preuve de rentabilite.
- Pas d'activation Auto Trading.
- Pas d'utilisation de cles API reelles cote frontend.

## Checklist demo

- [x] Serveur local repond.
- [x] `DEMO_MODE` visible.
- [x] `MOCK` / `DEMO` visibles.
- [x] `LIVE OFF` visible.
- [x] Donnees simulees visibles.
- [x] Journal demo rempli.
- [x] Backtests demo visibles.
- [x] BUY/SELL reel bloque.
- [x] Aucun secret broker reel present.
- [x] Build et tests valides.

## Consignes pour ne pas activer LIVE

- Ne jamais modifier `ENABLE_LIVE_TRADING=false` pendant la demo.
- Ne jamais modifier `ALLOW_LIVE_TRADING=false` pendant la demo.
- Ne jamais modifier `ALLOW_AUTO_EXECUTION=false` pendant la demo.
- Ne jamais saisir de secret broker reel dans le frontend.
- Ne jamais utiliser une source `MOCK` comme preuve de performance reelle.
- Ne jamais contourner Risk Engine, No-Trade Engine ou Journal.
- Ne jamais presenter Razon comme capable de garantir un gain.

## Decision finale

READY_FOR_DEMO
