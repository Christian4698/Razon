# Razon Demo Guide

Ce guide prepare une demonstration controlee de Razon sans argent reel, sans ordre broker et sans activation LIVE.

## Statut de demo

- Mode actif: `DEMO_MODE=true`
- Source affichee: `MOCK` ou `DEMO`
- Trading reel: desactive
- Variable obligatoire: `ENABLE_LIVE_TRADING=false`
- Execution automatique: desactivee par defaut
- Capital affiche: simulation uniquement

## Configuration locale

1. Installer les dependances:

```bash
pnpm install --frozen-lockfile
```

2. Copier l'environnement:

```bash
cp .env.example .env
```

3. Verifier les valeurs de securite demo:

```env
MODE_SIMULATION=true
SIMULATION_MODE=true
DEMO_MODE=true
DEMO_DATA_SOURCE=simulation
DEMO_ACCOUNT_BALANCE=10000
DEMO_CHART_TICK_MS=2400
ALLOW_LIVE_TRADING=false
ENABLE_LIVE_TRADING=false
ALLOW_AUTO_EXECUTION=false
```

4. Lancer le cockpit:

```bash
pnpm exec vite --host 0.0.0.0
```

Le frontend est ensuite disponible sur l'URL affichee par Vite, generalement `http://localhost:5173`.

## Parcours conseille

1. Dashboard principal
   Montrer `DEMO_MODE`, `LIVE OFF`, le capital simule et les statuts `MOCK` / `DEMO`.

2. Graphique marche
   Montrer les bougies OHLC simulees, le prix dynamique, le spread, les zones TP/SL et le signal courant.

3. KALOS Panel
   Expliquer que Razon produit `BUY`, `SELL`, `WAIT` ou `NO_TRADE` avec confidence, raisons, invalidation et volatilite. Ne jamais presenter un signal comme certain.

4. Risk Status
   Montrer que le Risk Engine reste obligatoire: RR, drawdown, SL, TP, spread et journal doivent etre valides.

5. Journal
   Montrer que les decisions `BUY`, `SELL`, `WAIT` et `NO_TRADE` sont journalisees comme evenements valides.

6. Backtests demo
   Montrer les exemples de backtests en lecture seule: total trades, win rate, profit factor, drawdown et recommandations.

7. Connecteurs
   Montrer que les connecteurs sont visibles, mais que les cles API restent cote backend ou environnement.

8. Emergency Stop
   Montrer que l'arret d'urgence est toujours visible et ramene le cockpit en analyse seule.

## Donnees de demonstration

Le cockpit alterne des scenarios simules:

- `XAUUSD` en `BUY`
- `EURUSD` en `NO_TRADE`
- `GBPUSD` en `WAIT`
- `USDJPY` en `SELL`

Ces scenarios servent uniquement a presenter le comportement de Razon. Ils ne constituent pas des recommandations de trading.

## Ce qu'il est interdit de faire en demo

- Activer `ENABLE_LIVE_TRADING=true`
- Saisir des cles API reelles dans le frontend
- Envoyer un ordre broker
- Presenter un gain comme garanti
- Contourner Risk Engine, No-Trade Engine ou Journal
- Utiliser une source `MOCK` comme preuve de performance reelle

## Checklist avant presentation

- `pnpm check` passe
- `pnpm exec vitest run --config backend/tests/vitest.config.mjs` passe
- `pnpm run build` passe
- `.env` contient `ENABLE_LIVE_TRADING=false`
- Le dashboard affiche `DEMO_MODE`
- Le graphique bouge avec donnees simulees
- Le journal contient des decisions d'exemple
- Les exemples de backtests sont visibles
- Aucun secret n'est visible cote frontend

## Message de cadrage

Razon MVP v1 est une demo controlee d'analyse, de risk gating, de journalisation et de cockpit. La demo ne prouve pas une rentabilite reelle et ne doit pas etre utilisee pour executer des trades LIVE.
