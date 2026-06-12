# RAZON_SKILL.md

# RAZON — SYSTEM SKILL FILE

Version: 1.0
Mode: Production Architecture
Priority: CRITICAL

────────────────────────────────

## MISSION

Tu développes RAZON.

RAZON n’est PAS :

* un simple bot d’indicateurs
* un générateur de BUY/SELL
* un système de prédiction magique

RAZON est :

Un moteur professionnel d’analyse probabiliste, de gestion du risque, de décision explicable et d’exécution contrôlée.

Objectif :

Observer
→ Comprendre
→ Filtrer
→ Justifier
→ Exécuter

Jamais l’inverse.

────────────────────────────────

# PHILOSOPHIE FONDAMENTALE

Règle 1 :

Un mauvais trade refusé

>

qu’un trade perdant.

Règle 2 :

# NO TRADE

position valide.

Règle 3 :

Le capital est prioritaire.

Règle 4 :

Confiance ≠ certitude.

Règle 5 :

Analyse
≠
Exécution.

────────────────────────────────

# MODES SYSTÈME

RAZON doit supporter :

MODE_ANALYSIS

MODE_MANUAL

MODE_SEMI_AUTO

MODE_AUTO

MODE_SCALPING

MODE_SHORT_TERM

MODE_LONG_TERM

────────────────────────────────

# BOUTONS OBLIGATOIRES

Interface :

[KALOS]

[ANALYSE]

[AUTO]

[MANUEL]

[SCALPING]

[COURT TERME]

[LONG TERME]

[BUY]

[SELL]

[CLOSE]

[STOP BOT]

[EMERGENCY STOP]

[CONNECT]

────────────────────────────────

# TIMEFRAME POLICY

SCALPING :

M1

M5

M15

SHORT TERM :

M15

M30

H1

LONG TERM :

H1

H4

D1

Ne jamais mélanger sans validation.

────────────────────────────────

# MULTI TIMEFRAME LOGIC

D1
→ Contexte

H4
→ Direction

H1
→ Structure

M15
→ Setup

M5
→ Entrée

M1
→ Ajustement

────────────────────────────────

# MARKET ANALYSIS

Toujours détecter :

HH

HL

LH

LL

BOS

CHOCH

Range

Support

Résistance

Pullback

Trend

Momentum

Volatilité

Liquidité

Equal High

Equal Low

Sweep

FVG

Order Block

Spread

Slippage

────────────────────────────────

# INDICATEURS

CORE :

EMA21

EMA200

ATR

VWAP

RSI

Volume

SECONDARY :

MACD

Bollinger

Interdiction :

empiler indicateurs.

────────────────────────────────

# KALOS

Indicateur propriétaire principal.

Mission :

calculer une estimation probabiliste.

Sorties :

BUY

SELL

WAIT

NO TRADE

Confiance

SL

TP

Invalidation

Durée

Justification

Risques

────────────────────────────────

# CONFIDENCE ENGINE

<80

NO TRADE

80–94

Signal prudent

95–99

Signal premium

99

Jamais certitude.

────────────────────────────────

# KALOS OPPORTUNITIES

Le moteur peut retourner :

jusqu’à 10 opportunités.

Chaque opportunité :

Actif

Direction

Confiance

Entrée

SL

TP

RR

Durée

Score

Explication

Interdiction :

inventer des positions.

────────────────────────────────

# EA BOT

RAZON doit fonctionner comme :

Expert Advisor

Capacités :

ouvrir BUY

ouvrir SELL

fermer

SL

TP

trailing

break-even

journal

────────────────────────────────

# RISK ENGINE

Toujours actif.

Obligatoire :

lot automatique

RR minimum 1:2

ATR

drawdown

kill switch

stop journalier

anti martingale

────────────────────────────────

# NO TRADE ENGINE

Bloquer si :

score faible

spread élevé

slippage élevé

marché chaotique

drawdown atteint

données insuffisantes

────────────────────────────────

# CONNECTOR POLICY

Prévoir :

MetaTrader 5

Deriv

Forex

Generic APIs

Fonctions :

connect()

disconnect()

test()

fetch()

status()

────────────────────────────────

# BACKTEST POLICY

Pipeline :

Backtest

↓

Walk Forward

↓

Monte Carlo

↓

Démo

↓

Production

────────────────────────────────

# MEMORY ENGINE

Sauvegarder :

analyses

trades

refus

confiance

résultats

────────────────────────────────

# JOURNAL ENGINE

Enregistrer :

heure

actif

signal

raison

SL

TP

score

résultat

────────────────────────────────

# SÉCURITÉ

Interdictions :

martingale

promesses gains

surtrading

auto optimisation sauvage

clé API exposée

────────────────────────────────

# CODE RULES

Toujours :

modulaire

testable

typé

documenté

sécurisé

évolutif

────────────────────────────────

# RAZON FINAL PRINCIPLE

Le meilleur trade n’est pas celui qui rapporte le plus.

Le meilleur trade est celui qui mérite d’exister.
