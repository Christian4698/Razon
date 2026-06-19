import type { CockpitPage } from "../app/cockpit.types";

export interface CockpitPageDefinition {
  readonly id: CockpitPage;
  readonly label: string;
  readonly title: string;
  readonly description: string;
}

export const cockpitPages: readonly CockpitPageDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    title: "Dashboard principal",
    description: "Controle central Razon en lecture et simulation.",
  },
  {
    id: "kalos",
    label: "KALOS",
    title: "KALOS Panel",
    description: "Signal, confidence, raisons, invalidation et analyse HTF/MTF/LTF.",
  },
  {
    id: "market-chart",
    label: "Market Chart",
    title: "Market Chart",
    description: "Bougies OHLC, timeframe, prix, spread, volume, SL/TP et zones.",
  },
  {
    id: "trade-center",
    label: "Trade Center",
    title: "Centre de Trading",
    description: "Preparation DEMO/REAL en lecture seule, sans execution reelle.",
  },
  {
    id: "connectors",
    label: "Connectors",
    title: "Connectors",
    description: "MT5, Deriv, Forex, TradingView et Mock en lecture securisee.",
  },
  {
    id: "journal",
    label: "Journal",
    title: "Journal",
    description: "Decisions BUY, SELL, WAIT, NO_TRADE et audit trail.",
  },
  {
    id: "risk",
    label: "Risk Status",
    title: "Risk Status",
    description: "Validation risque, drawdown, SL/TP, RR et blocages.",
  },
  {
    id: "settings",
    label: "Settings",
    title: "Settings",
    description: "Modes, flags de securite et statut des secrets backend.",
  },
];
