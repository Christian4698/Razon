# RAZON Security Architecture

Status: Active
Scope: cockpit safety, data-mode control, audit and execution separation

## Security Principles

- LIVE trading is disabled by default.
- Analysis and execution are separate control planes.
- No broker/API secret is exposed to the frontend.
- Emergency Stop has priority over every mode or workflow change.
- Every sensitive control change must be auditable.
- A visible data label must never mislead the user.

## Data Mode Control

Data Mode Control manages the difference between real broker/API data and demo
or mock data.

Modes:

- `REAL_DATA`: broker/API data can be used for analysis. If LIVE is OFF,
  execution remains disabled.
- `DEMO_DATA`: simulated data only. The UI must show `DEMO_MODE`, `MOCK` and
  `NO REAL IMPACT`.

Access:

- The DEMO/REAL switch is not available from the dashboard.
- Access is limited to Settings > Confidentialite & Securite.
- The control requires 3 confirmations before any change is applied.
- The user must type exactly `JE COMPRENDS`.
- The UI must show a clear warning before applying the change.

Blocking rules:

- Block when Emergency Stop is active.
- Block when an analysis is in progress.
- Block when a trade workflow is in progress.
- Block when any confirmation step is missing.
- Block when the typed phrase is not exactly `JE COMPRENDS`.

Audit:

- Log every requested change.
- Log every blocked change with reason.
- Log every applied change with previous mode, target mode and timestamp.
- Keep the audit record separate from execution and connector actions.

## Modules

- `backend/src/modules/data-mode/`: validates data-mode requests and keeps
  execution disabled when LIVE is OFF.
- `backend/src/modules/audit/`: records control-plane audit events.
- `frontend/settings/DataModeControl.tsx`: protected 3-step confirmation UI.
- `frontend/settings/PrivacySafetyPanel.tsx`: Settings-only safety entry point.

## Execution Separation

Switching to `REAL_DATA` must never:

- connect a real account automatically
- activate LIVE
- place an order
- close an order
- bypass Risk Engine
- bypass No-Trade Engine
- bypass Journal

`REAL_DATA` only changes the data source context for analysis. Execution remains
blocked unless a future production approval explicitly enables LIVE and all
risk, journal and connector gates pass.

## Visibility

The cockpit must show the active data mode on global surfaces:

- `REAL_DATA` for broker/API analysis context
- `DEMO_DATA` for simulated data context
- `DEMO_MODE`, `MOCK` and `NO REAL IMPACT` when simulated data is active

No mode may hide, soften or rename the real/simulated nature of the data.
