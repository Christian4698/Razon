# RAZON_CHARTING_AND_CONNECTORS_SPEC.md

Version: v2.0
Status: APPROVED
Mode: DEMO ONLY
Execution: OFF
Source Of Truth: ENABLED

---

# 1. OBJECTIVE

Define one authoritative architecture for:

* Charting
* Drawing Tools
* Indicators
* Connectors
* Themes
* Localization
* Dashboard UX
* Zoom & Navigation
* Performance

Goals:

* avoid duplicated logic
* avoid conflicting prompts
* avoid divergent implementations
* preserve deterministic UX

LIVE execution MUST remain disabled.

---

# 2. ARCHITECTURE PRIORITY

Order of authority:

1. SPEC FILE
2. USER SETTINGS
3. RUNTIME CONFIG
4. UI STATE

Conflict Resolution:

SPEC > Settings > Runtime > UI

---

# 3. EXECUTION POLICY

Global:

ENABLE_LIVE_TRADING=false

ALLOW_AUTO_EXECUTION=false

MODE_SIMULATION=true

READ_ONLY=true

Forbidden:

* buy
* sell
* modify
* close
* order placement
* stop loss update

Allowed:

* analysis
* visualization
* indicators
* connectors
* replay

---

# 4. LOCALIZATION

Official languages:

Primary:
English

Secondary:
Français

Structure:

i18n/

├── en/

└── fr/

Rules:

* full UI translatable
* indicators keep native names
* fallback → English
* no runtime reload

Persistence:

localStorage

---

# 5. THEMES

Modes:

AUTO_SYSTEM

LIGHT

DARK

OBSCURE

Descriptions:

LIGHT
Professional

DARK
Comfort

OBSCURE
Deep black

AUTO_SYSTEM
Sync OS

Persistence:

localStorage

Transition:

180ms

No flicker

---

# 6. CHART ENGINE

Engine:

lightweight-charts

Rendering:

Canvas

Layers:

Price Layer

Indicator Layer

Drawing Layer

Overlay Layer

Workers:

Indicator Calculations

Data Aggregation

Virtualization:

Enabled

---

# 7. CHART INTERACTION

Cursor:

normal:
crosshair

drawing:
precision

pan:
grab

disabled:
not-allowed

Hover:

Display:

Price

Open

High

Low

Close

Volume

Variation %

Trend

Momentum

Timestamp

Source

Spread

Crosshair:

Horizontal

Vertical

Tooltip:

follow cursor

anti overflow

refresh <16ms

---

# 8. CHART NAVIGATION

Goal:

Ultra fluid navigation.

## Zoom

Mouse Wheel
→ horizontal zoom

CTRL + Wheel
→ vertical zoom

Double Click
→ reset

Pinch
→ native

Buttons:

Fit Screen

Reset Zoom

Limits:

MIN:
20 candles

MAX:
10000 candles

Auto Clamp:
ON

Zoom Lock:
optional

---

## Pan

Middle Mouse

SPACE + Drag

Historical Scroll

Inertia:
OFF

---

## Inspection

ALT + Hover

Display:

RSI

MACD

ROC

Momentum

Volatility

KALOS Signal

---

## Synchronization

Always sync:

Price

Indicators

Cursor

Drawings

---

## UX Rules

No:

API reload

indicator reset

flickering

layout reset

Cache:
required

---

# 9. SMART TIMEFRAME ZOOM

Status:
APPROVED

Default:

SMART_ZOOM_MODE=HYBRID

Modes:

AUTO

MANUAL

HYBRID

---

HYBRID:

Zoom #1
visual only

Zoom #2
visual + adaptive

Zoom #3
timeframe switch

Example:

2H

↓

15M

↓

5M

↓

1M

Reverse:

1M

↓

5M

↓

15M

↓

1H

↓

4H

↓

1D

Switch Rules:

visibleCandles > 450

→ timeframe up

visibleCandles 60–450

→ keep

visibleCandles < 60

→ candidate switch

Apply only if:

zoomIntentDuration > 300ms

Transition:

180ms

Overlay:

15M → 5M

Duration:
700ms

Preserve:

cursor

drawings

indicators

position

No reset

Preload:

1M

5M

15M

1H

Cache:

5000 candles

---

# 10. CHART TYPES

Supported:

AREA

CANDLE

HOLLOW

OHLC

Default:

CANDLE

---

# 11. DRAWING TOOLS

Supported:

Horizontal

Vertical

Trendline

Ray

Segment

Rectangle

Measure

Text

Context Actions:

Edit

Duplicate

Delete

Lock

Shortcuts:

H

V

T

M

ESC

---

# 12. INDICATORS

Max Active:

5

Calculation:

Workers

Lazy Loaded

---

Momentum:

RSI

MACD

ROC

Stochastic

Stochastic Momentum

Williams %R

Awesome

Detrended Price Oscillator

---

Trend:

Aroon

ADX

CCI

Ichimoku

Parabolic SAR

ZigZag

---

Volatility:

Bollinger

Donchian

---

Moving Average:

SMA

EMA

WMA

Envelope

Rainbow

Alligator

Fractal Chaos

---

Availability:

1M

RSI

MACD

ROC

5M

All standard

15M+

All indicators

---

# 13. CONTEXT MENU

Sections:

Chart

Indicators

Draw

Connectors

Theme

Language

Account

Export

Layout:

General

Indicators

Connections

Settings

Requirements:

Keyboard accessible

Search enabled

Persistent

---

# 14. CONNECTORS

Supported:

Deriv

MT5

Forex

Future Providers

Connection Flow:

DISCONNECTED

CONNECTING

CONNECTED

CONNECTED_DEMO

DEGRADED

ERROR

---

Credentials:

API TOKEN

Rules:

NOT CONNECTED

→ editable

CONNECTED

→ locked

Display:

••••••••••

Actions:

Reveal (temporary)

Copy

Reconnect

Disconnect

Security:

backend only

encrypted at rest

rotation supported

never export

never expose frontend

---

# 15. SESSION RECOVERY

Restore:

layout

theme

language

zoom

indicators

drawings

timeframe

Recovery:

automatic

---

# 16. PERFORMANCE

Target:

60 FPS

Frame Drop:

<3%

Render:

<16ms

Techniques:

memoization

virtual candles

throttle mouse

worker indicators

lazy connectors

No:

blocking UI

---

# 17. RELEASE GATES

Phase 1

Chart Engine

Phase 2

Drawing Tools

Phase 3

Indicators

Phase 4

Connectors

Phase 5

Dashboard

Phase 6

Optimization

---

# 18. FUTURE EXTENSIONS

Replay

AI Analysis

Templates

Saved Layout

Strategy Builder

Backtesting

END SPEC
