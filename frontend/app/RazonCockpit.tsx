import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Cable,
  Eye,
  LineChart,
  LogOut,
  Settings,
  Shield,
  UserCircle,
} from "lucide-react";
import {
  DEMO_MODE,
  alerts,
  backtestExamples,
  connectors,
  createSyntheticIndexSnapshot,
  dataModeLabels,
  journalRows,
  syntheticIndexProviderSymbols,
} from "./cockpit-data";
import type {
  ActionDisplayMode,
  CockpitPage,
  CockpitState,
  ConnectorLicenseSnapshot,
  ConnectorStatus,
  ConnectorUserScope,
  DataMode,
  JournalRow,
  KalosSignal,
  LicenseStatusSnapshot,
  MarketStatus,
  OhlcCandle,
  SignalDecision,
  StrategyMode,
  SyntheticIndexSymbol,
  TradingMode,
  WatchlistItem,
} from "./cockpit.types";
import { cockpitPages } from "../pages/page-registry";
import { DashboardPage } from "../dashboard/DashboardPage";
import { KalosPanelPage } from "../kalos/KalosPanelPage";
import { MarketChartPage } from "../dashboard/MarketChartPage";
import { ConnectorsPage } from "../connectors/ConnectorsPage";
import { JournalPage } from "../journal/JournalPage";
import { RiskStatusPage } from "../trading/RiskStatusPage";
import { SettingsPage } from "../settings/SettingsPage";
import { EmergencyStopButton } from "../components/EmergencyStopButton";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { MobileConnectorStatus } from "../components/MobileConnectorStatus";
import { MobileEmergencyStop } from "../components/MobileEmergencyStop";
import { MobileKalosCard } from "../components/MobileKalosCard";
import { MobileRiskStatus } from "../components/MobileRiskStatus";
import { MobileTradingPanel } from "../components/MobileTradingPanel";
import { StatusPill, confirmDanger } from "../components/CockpitPrimitives";
import "./razon-cockpit.css";
import { useLanguage } from "@/i18n/useLanguage";
import { API_BASE_URL } from "@/lib/api";

const navIcons: Record<CockpitPage, ReactElement> = {
  dashboard: <BarChart3 size={17} />,
  "kalos": <Eye size={17} />,
  "market-chart": <LineChart size={17} />,
  connectors: <Cable size={17} />,
  journal: <BookOpen size={17} />,
  risk: <Shield size={17} />,
  settings: <Settings size={17} />,
};

const ACTION_DISPLAY_MODE_STORAGE_KEY = "razon-action-display-mode";

function readInitialActionDisplayMode(): ActionDisplayMode {
  if (typeof window === "undefined") return "standard";
  return window.localStorage.getItem(ACTION_DISPLAY_MODE_STORAGE_KEY) === "deriv" ? "deriv" : "standard";
}

interface BackendMarketSnapshot {
  readonly symbol: string;
  readonly timeframe: "1m" | "5m" | "15m" | "1h" | "1d";
  readonly ticker: {
    readonly price: number | null;
    readonly source: string;
    readonly status: string;
    readonly updatedAt: string;
    readonly providerMessage?: string;
  };
  readonly candles: readonly {
    readonly timestamp: string;
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly volume: number | null;
  }[];
  readonly volume: { readonly volume: number | null };
  readonly observability: {
    readonly source: "MOCK" | "DEMO" | "REAL_DATA";
    readonly sourceLabel: string;
    readonly sourceStatus: "CONNECTED" | "DELAYED" | "MOCK" | "DISCONNECTED" | "UNKNOWN";
    readonly latencyMs: number | null;
    readonly freshnessSeconds: number | null;
    readonly missingCandles: number;
    readonly spreadQuality: "NORMAL" | "WIDE" | "ABNORMAL" | "UNKNOWN";
    readonly syncStatus: "IN_SYNC" | "LAGGING" | "OUT_OF_SYNC" | "UNKNOWN";
    readonly dataQuality: "HEALTHY" | "DEGRADED" | "STALE" | "INVALID" | "DISCONNECTED";
    readonly lastTickAt: string | null;
    readonly lastCandleAt: string | null;
  };
  readonly dataGuard: {
    readonly action: "ALLOW_ANALYSIS" | "WAIT" | "NO_TRADE" | "DATA_LOW" | "INVALID";
    readonly reasons: readonly string[];
    readonly rejectedReasons: readonly string[];
  };
  readonly fallback: "NONE" | "MOCK_DATA";
}

interface BackendKalosOutput {
  readonly symbol: string;
  readonly decision: SignalDecision;
  readonly confidence: number;
  readonly explanation: string;
  readonly whyBuy: readonly string[];
  readonly whySell: readonly string[];
  readonly whyWait: readonly string[];
  readonly technicalReasons: readonly string[];
  readonly tp: number | null;
  readonly sl: number | null;
  readonly invalidationLevel: number | null;
  readonly indicators: {
    readonly trend: "bullish" | "bearish" | "sideways" | "unavailable";
    readonly volatility: "low" | "normal" | "high" | "unavailable";
  };
  readonly risk: "low" | "medium" | "high";
  readonly source?: string;
  readonly dataSource?: "MOCK" | "DEMO" | "REAL_DATA";
  readonly sourceStatus?: "CONNECTED" | "DELAYED" | "MOCK" | "DISCONNECTED" | "UNKNOWN";
  readonly syncStatus?: "IN_SYNC" | "LAGGING" | "OUT_OF_SYNC" | "UNKNOWN";
  readonly freshnessSeconds?: number | null;
  readonly latencyMs?: number | null;
  readonly dataQuality?: "HEALTHY" | "DEGRADED" | "STALE" | "INVALID" | "DISCONNECTED";
  readonly lastTickAt?: string | null;
  readonly lastCandleAt?: string | null;
}

interface BackendConnectorsHealth {
  readonly user: ConnectorUserScope;
  readonly license: ConnectorLicenseSnapshot;
  readonly connectors: readonly ConnectorStatus[];
}

interface RazonCockpitAuthUser {
  readonly displayName: string;
  readonly email: string;
}

interface RazonCockpitProps {
  readonly authUser?: RazonCockpitAuthUser;
  readonly initialPage?: CockpitPage;
  readonly licensePlan?: string;
  readonly licenseStatus?: string;
  readonly onLogout?: () => void;
  readonly onNavigateProfile?: () => void;
  readonly onPageChange?: (page: CockpitPage) => void;
}

function pageText(page: CockpitPage, t: (key: string) => string) {
  const labels: Record<CockpitPage, { label: string; title: string; description: string }> = {
    dashboard: {
      label: t("nav.dashboard"),
      title: t("page.dashboard.title"),
      description: t("page.dashboard.description"),
    },
    kalos: {
      label: t("nav.kalos"),
      title: t("page.kalos.title"),
      description: t("page.kalos.description"),
    },
    "market-chart": {
      label: t("nav.marketChart"),
      title: t("page.marketChart.title"),
      description: t("page.marketChart.description"),
    },
    connectors: {
      label: t("nav.connectors"),
      title: t("page.connectors.title"),
      description: t("page.connectors.description"),
    },
    journal: {
      label: t("nav.journal"),
      title: t("page.journal.title"),
      description: t("page.journal.description"),
    },
    risk: {
      label: t("nav.risk"),
      title: t("page.risk.title"),
      description: t("page.risk.description"),
    },
    settings: {
      label: t("nav.settings"),
      title: t("page.settings.title"),
      description: t("page.settings.description"),
    },
  };

  return labels[page];
}

function displayTimeframe(timeframe: BackendMarketSnapshot["timeframe"]) {
  const labels: Record<BackendMarketSnapshot["timeframe"], string> = {
    "1m": "M1",
    "5m": "M5",
    "15m": "M15",
    "1h": "H1",
    "1d": "D1",
  };

  return labels[timeframe];
}

function displayTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function mapTrend(trend: BackendKalosOutput["indicators"]["trend"]) {
  if (trend === "bullish") return "BULLISH" as const;
  if (trend === "bearish") return "BEARISH" as const;
  return "NEUTRAL" as const;
}

function mapVolatility(volatility: BackendKalosOutput["indicators"]["volatility"]) {
  if (volatility === "low") return "LOW" as const;
  if (volatility === "high") return "HIGH" as const;
  return "NORMAL" as const;
}

function riskScoreFromBackend(risk: BackendKalosOutput["risk"]) {
  if (risk === "high") return 74;
  if (risk === "medium") return 46;
  return 28;
}

function normalizeDecision(decision: string): SignalDecision {
  if (decision === "BUY" || decision === "SELL" || decision === "WAIT" || decision === "NO_TRADE" || decision === "DATA_LOW" || decision === "INVALID") {
    return decision;
  }

  return "WAIT";
}

function sourceFromObservability(source: BackendMarketSnapshot["observability"]["source"]): MarketStatus["source"] {
  if (source === "REAL_DATA") return "LIVE";
  return source;
}

function marketFromBackend(snapshot: BackendMarketSnapshot, fallback: MarketStatus): MarketStatus {
  const source = sourceFromObservability(snapshot.observability.source);
  const volume = snapshot.volume.volume ?? snapshot.candles.at(-1)?.volume ?? fallback.volume;

  return {
    ...fallback,
    symbol: snapshot.symbol,
    timeframe: displayTimeframe(snapshot.timeframe),
    runtimeMode: source === "LIVE" ? "LIVE" : source,
    price: snapshot.ticker.price ?? fallback.price,
    volume,
    source,
    session: snapshot.observability.sourceLabel,
    fallback: snapshot.fallback,
    dataQuality: snapshot.observability.dataQuality,
    sourceStatus: snapshot.observability.sourceStatus,
    syncStatus: snapshot.observability.syncStatus,
    latencyMs: snapshot.observability.latencyMs,
    freshnessSeconds: snapshot.observability.freshnessSeconds,
    missingCandles: snapshot.observability.missingCandles,
    spreadQuality: snapshot.observability.spreadQuality,
    lastTickAt: snapshot.observability.lastTickAt,
    lastCandleAt: snapshot.observability.lastCandleAt,
  };
}

function candlesFromBackend(snapshot: BackendMarketSnapshot, fallback: readonly OhlcCandle[]): readonly OhlcCandle[] {
  if (snapshot.candles.length === 0) return fallback;

  return snapshot.candles.slice(-48).map(candle => ({
    timestamp: displayTimestamp(candle.timestamp),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume ?? 0,
  }));
}

function signalFromBackend(kalos: BackendKalosOutput | null, snapshot: BackendMarketSnapshot, fallback: KalosSignal): KalosSignal {
  if (!kalos) return fallback;

  const decision = normalizeDecision(kalos.decision);
  const reasons = [
    ...kalos.whyBuy,
    ...kalos.whySell,
    ...kalos.technicalReasons.slice(0, 3),
  ].filter(Boolean);
  const rejectedReasons = [
    ...snapshot.dataGuard.rejectedReasons,
    ...snapshot.dataGuard.reasons,
    ...kalos.whyWait,
    "LIVE OFF bloque toute execution reelle.",
    "AUTO EXECUTION OFF: aucun ordre Deriv n'est route.",
  ].filter(Boolean);
  const riskScore = riskScoreFromBackend(kalos.risk);
  const dataSource = kalos.dataSource ?? snapshot.observability.source;
  const dataSourceLabel = kalos.source ?? snapshot.observability.sourceLabel;
  const sourceStatus = kalos.sourceStatus ?? snapshot.observability.sourceStatus;
  const dataQuality = kalos.dataQuality ?? snapshot.observability.dataQuality;

  return {
    ...fallback,
    symbol: snapshot.symbol,
    decision,
    confidence: kalos.confidence,
    tp: kalos.tp ?? fallback.tp,
    sl: kalos.sl ?? fallback.sl,
    invalidation: kalos.invalidationLevel ?? fallback.invalidation,
    reasons: reasons.length > 0 ? reasons : [kalos.explanation],
    rejectedReasons,
    timeframe: displayTimeframe(snapshot.timeframe),
    trend: mapTrend(kalos.indicators.trend),
    volatility: mapVolatility(kalos.indicators.volatility),
    riskScore,
    dataSource,
    dataSourceLabel,
    sourceStatus,
    syncStatus: kalos.syncStatus ?? snapshot.observability.syncStatus,
    freshnessSeconds: kalos.freshnessSeconds ?? snapshot.observability.freshnessSeconds,
    latencyMs: kalos.latencyMs ?? snapshot.observability.latencyMs,
    dataQuality,
    lastTickAt: kalos.lastTickAt ?? snapshot.observability.lastTickAt,
    lastCandleAt: kalos.lastCandleAt ?? snapshot.observability.lastCandleAt,
    marketBrain: {
      ...fallback.marketBrain,
      signal: decision,
      confidence: kalos.confidence,
      explanation: `${kalos.explanation} Source KALOS: ${dataSourceLabel}; quality ${dataQuality}.`,
      riskScore,
      structure: mapTrend(kalos.indicators.trend),
      rejectedReasons,
    },
    futurePath: {
      ...fallback.futurePath,
      state: snapshot.dataGuard.action === "DATA_LOW" ? "DATA_LOW" : fallback.futurePath.state,
      confidence: kalos.confidence,
    },
  };
}

function watchlistFromBackend(
  watchlist: readonly WatchlistItem[],
  market: MarketStatus,
  selectedSymbol: SyntheticIndexSymbol,
  signal: KalosSignal
): readonly WatchlistItem[] {
  return watchlist.map(item =>
    item.symbol === selectedSymbol
      ? {
          ...item,
          price: market.price,
          signal: signal.decision,
          spread: market.spread,
          runtimeMode: market.runtimeMode,
          confidence: signal.confidence,
          probability: signal.futurePath.confidence,
          riskScore: signal.riskScore,
          dataQuality: signal.dataQuality ?? market.dataQuality ?? null,
          sourceLabel:
            market.source === "DEMO" && market.sourceStatus === "CONNECTED" && market.session.toLowerCase().includes("deriv")
              ? "DERIV DEMO"
              : market.source === "MOCK"
                ? "MOCK_DATA"
                : market.source,
        }
      : item
  );
}

function connectorStatusFromHealth(
  health: BackendConnectorsHealth | null,
  fallbackConnectors: readonly ConnectorStatus[]
): readonly ConnectorStatus[] {
  if (!health) return fallbackConnectors;

  return fallbackConnectors.map(connector => {
    const backend = health.connectors.find(item => item.id === connector.id);
    if (!backend) return connector;

    return {
      ...connector,
      ...backend,
    };
  }).concat(health.connectors.filter(backend => !fallbackConnectors.some(connector => connector.id === backend.id)));
}

function userInitials(user?: RazonCockpitAuthUser) {
  if (!user) return "R";
  return user.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || user.email[0]?.toUpperCase() || "R";
}

export default function RazonCockpit({
  authUser,
  initialPage = "dashboard",
  licensePlan = "NONE",
  licenseStatus = "MISSING",
  onLogout,
  onNavigateProfile,
  onPageChange,
}: RazonCockpitProps = {}) {
  const { t } = useLanguage();
  const [activePage, setActivePage] = useState<CockpitPage>(initialPage);
  const chartNavigationBlockedUntilRef = useRef(0);
  const [state, setState] = useState<CockpitState>({
    kalosEnabled: true,
    tradingMode: "ANALYSE_SEULEMENT",
    strategyMode: "SHORT_TERM",
    dataMode: "DEMO_DATA",
    analysisInProgress: false,
    tradeInProgress: false,
    emergencyStop: false,
    dataModeAudit: [],
    lastAction: "Cockpit initialise",
  });
  const [demoTick, setDemoTick] = useState(0);
  const [actionDisplayMode, setActionDisplayMode] = useState<ActionDisplayMode>(readInitialActionDisplayMode);
  const [selectedSyntheticSymbol, setSelectedSyntheticSymbol] = useState<SyntheticIndexSymbol>("Boom 500");
  const [backendSnapshot, setBackendSnapshot] = useState<BackendMarketSnapshot | null>(null);
  const [backendKalos, setBackendKalos] = useState<BackendKalosOutput | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendConnectorsHealth | null>(null);
  const [licenseSnapshot, setLicenseSnapshot] = useState<LicenseStatusSnapshot | null>(null);
  const refreshConnectors = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/connectors/health`, { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`health ${response.status}`);
    const payload = (await response.json()) as BackendConnectorsHealth;
    setBackendHealth(payload);
  }, []);
  const refreshLicense = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/licenses/status`, { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`license ${response.status}`);
    const payload = (await response.json()) as LicenseStatusSnapshot;
    setLicenseSnapshot(payload);
  }, []);

  const active = useMemo(() => pageText(activePage, t), [activePage, t]);
  const demoSnapshot = useMemo(
    () => createSyntheticIndexSnapshot(selectedSyntheticSymbol, demoTick, state.dataMode),
    [demoTick, selectedSyntheticSymbol, state.dataMode]
  );

  useEffect(() => {
    setActivePage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    window.localStorage.setItem(ACTION_DISPLAY_MODE_STORAGE_KEY, actionDisplayMode);
  }, [actionDisplayMode]);

  useEffect(() => {
    const pausePolling = (event: Event) => {
      const detail = (event as CustomEvent<{ until?: number }>).detail;
      chartNavigationBlockedUntilRef.current = Math.max(
        chartNavigationBlockedUntilRef.current,
        detail?.until ?? Date.now() + 10000,
      );
    };

    window.addEventListener("razon:chart-navigation", pausePolling);
    return () => window.removeEventListener("razon:chart-navigation", pausePolling);
  }, []);
  const activeSnapshot = useMemo(() => {
    if (!backendSnapshot) return demoSnapshot;

    const market = marketFromBackend(backendSnapshot, demoSnapshot.market);
    const candles = candlesFromBackend(backendSnapshot, demoSnapshot.candles);
    const signal = signalFromBackend(backendKalos, backendSnapshot, demoSnapshot.signal);

    return {
      market,
      candles,
      signal,
      risk: {
        ...demoSnapshot.risk,
        score: signal.riskScore,
        spreadOk: market.spreadQuality !== "ABNORMAL",
        liveEnabled: false,
      },
      watchlist: watchlistFromBackend(demoSnapshot.watchlist, market, selectedSyntheticSymbol, signal),
    };
  }, [backendKalos, backendSnapshot, demoSnapshot, selectedSyntheticSymbol]);
  const activeConnectors = useMemo(() => connectorStatusFromHealth(backendHealth, connectors), [backendHealth]);
  const visibleDataModeLabels = useMemo(() => dataModeLabels(state.dataMode), [state.dataMode]);
  const derivDemoConnected =
    activeSnapshot.market.source === "DEMO" &&
    activeSnapshot.market.sourceStatus === "CONNECTED" &&
    activeSnapshot.market.session.toLowerCase().includes("deriv");
  const showMobileEmergencyStop = activePage === "dashboard" || activePage === "risk";
  const topDataModeLabels = derivDemoConnected
    ? visibleDataModeLabels.slice(1, 3).filter(label => label !== "MOCK")
    : visibleDataModeLabels.slice(1, 3);
  const activeJournalRows = useMemo(() => {
    const sourceLabel = derivDemoConnected ? "DERIV DEMO" : activeSnapshot.market.session;
    const sourceStatus = activeSnapshot.market.sourceStatus ?? "UNKNOWN";
    const fallback = activeSnapshot.market.fallback ?? (derivDemoConnected ? "NONE" : undefined);
    const currentRow: JournalRow = {
      id: `SYN-${selectedSyntheticSymbol.replace(/\s/g, "-").toUpperCase()}`,
      timestamp: new Date().toISOString(),
      symbol: selectedSyntheticSymbol,
      timeframe: activeSnapshot.market.timeframe,
      mode: state.strategyMode,
      decision: activeSnapshot.signal.decision,
      confidence: activeSnapshot.signal.confidence,
      riskScore: activeSnapshot.risk.score,
      source: activeSnapshot.market.source,
      sourceLabel,
      fallback,
      module: "KALOS",
      result: `${sourceLabel} | ${sourceStatus} | fallback ${fallback ?? "n/a"} | LIVE OFF | AUTO EXECUTION OFF`,
    };

    return [currentRow, ...journalRows].slice(0, 9);
  }, [
    activeSnapshot.market.fallback,
    activeSnapshot.market.session,
    activeSnapshot.market.source,
    activeSnapshot.market.sourceStatus,
    activeSnapshot.market.timeframe,
    activeSnapshot.risk.score,
    activeSnapshot.signal.confidence,
    activeSnapshot.signal.decision,
    derivDemoConnected,
    selectedSyntheticSymbol,
    state.strategyMode,
  ]);

  useEffect(() => {
    if (!DEMO_MODE.enabled) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setDemoTick(current => current + 1);
    }, DEMO_MODE.tickMs);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadHealth = async () => {
      if (Date.now() < chartNavigationBlockedUntilRef.current) return;

      try {
        await Promise.all([refreshConnectors(), refreshLicense()]);
      } catch {
        if (!cancelled) {
          setBackendHealth(null);
          setLicenseSnapshot(null);
        }
      }
    };

    void loadHealth();
    const timer = window.setInterval(() => void loadHealth(), 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshConnectors, refreshLicense]);

  useEffect(() => {
    let cancelled = false;
    const providerSymbol = syntheticIndexProviderSymbols[selectedSyntheticSymbol];

    const loadMarket = async () => {
      if (Date.now() < chartNavigationBlockedUntilRef.current) return;

      try {
        const query = `symbol=${encodeURIComponent(providerSymbol)}&timeframe=M5`;
        const [snapshotResponse, kalosResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/markets/snapshot?${query}`, { credentials: "include", headers: { Accept: "application/json" } }),
          fetch(`${API_BASE_URL}/api/kalos?${query}`, { credentials: "include", headers: { Accept: "application/json" } }),
        ]);

        if (!snapshotResponse.ok || !kalosResponse.ok) {
          throw new Error("market request failed");
        }

        const nextSnapshot = (await snapshotResponse.json()) as BackendMarketSnapshot;
        const nextKalos = (await kalosResponse.json()) as BackendKalosOutput;

        if (!cancelled) {
          setBackendSnapshot(nextSnapshot);
          setBackendKalos(nextKalos);
        }
      } catch {
        if (!cancelled) {
          setBackendSnapshot(null);
          setBackendKalos(null);
        }
      }
    };

    void loadMarket();
    const timer = window.setInterval(() => void loadMarket(), 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedSyntheticSymbol]);

  const setLastAction = (lastAction: string) => {
    setState(current => ({ ...current, lastAction }));
  };

  const selectPage = (page: CockpitPage) => {
    setActivePage(page);
    onPageChange?.(page);
  };

  const handleToggleKalos = () => {
    setState(current => ({
      ...current,
      kalosEnabled: !current.kalosEnabled,
      lastAction: !current.kalosEnabled ? "KALOS ON" : "KALOS OFF",
    }));
  };

  const handleTradingModeChange = (mode: TradingMode, dangerous: boolean) => {
    const apply = () => {
      setState(current => ({ ...current, tradingMode: mode, lastAction: `${mode} selected` }));
    };

    if (dangerous) {
      confirmDanger(mode, apply);
      return;
    }

    apply();
  };

  const handleStrategyModeChange = (mode: StrategyMode) => {
    setState(current => ({ ...current, strategyMode: mode, lastAction: `${mode} selected` }));
  };

  const handleEmergencyStop = () => {
    setState(current => ({
      ...current,
      emergencyStop: true,
      tradingMode: "ANALYSE_SEULEMENT",
      lastAction: "EMERGENCY STOP active",
    }));
  };

  const handleDataModeChange = (targetMode: DataMode, status: "APPLIED" | "BLOCKED", reason: string) => {
    setState(current => {
      const auditEntry = {
        id: `data-mode-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: current.dataMode,
        to: targetMode,
        status,
        reason,
      };

      return {
        ...current,
        dataMode: status === "APPLIED" ? targetMode : current.dataMode,
        dataModeAudit: [auditEntry, ...current.dataModeAudit].slice(0, 8),
        lastAction: status === "APPLIED" ? `Data mode ${targetMode}` : `Data mode blocked: ${reason}`,
      };
    });
  };

  const sharedProps = {
    state,
    market: activeSnapshot.market,
    signal: activeSnapshot.signal,
    risk: activeSnapshot.risk,
    candles: activeSnapshot.candles,
    connectors: activeConnectors,
    license: licenseSnapshot,
    journalRows,
    watchlist: activeSnapshot.watchlist,
    alerts,
    backtests: backtestExamples,
    selectedSyntheticSymbol,
    actionDisplayMode,
    onSyntheticSymbolChange: setSelectedSyntheticSymbol,
    onToggleKalos: handleToggleKalos,
    onTradingModeChange: handleTradingModeChange,
    onStrategyModeChange: handleStrategyModeChange,
    onManualAction: setLastAction,
  };

  return (
    <div className="razon-cockpit">
      <div className="cockpit-shell">
        <aside className="cockpit-sidebar">
          <div className="cockpit-brand">
            <div className="cockpit-mark">R</div>
            <div> 
              <strong>{t("app.brand")}</strong>
              <span>{t("app.cockpit")}</span>
            </div>
          </div>
          <nav className="cockpit-nav" aria-label="Cockpit navigation">
            {cockpitPages.map(item => (
              <button
                className={item.id === activePage ? "is-active" : ""}
                key={item.id}
                onClick={() => selectPage(item.id)}
                type="button"
              >
                {navIcons[item.id]}
                {pageText(item.id, t).label}
              </button>
            ))}
          </nav>
          <div className="cockpit-sidebar-footer">
            <StatusPill tone={state.dataMode === "REAL_DATA" ? "critical" : "demo"}>{state.dataMode}</StatusPill>
            <StatusPill tone="demo">{DEMO_MODE.name}</StatusPill>
            {state.dataMode === "DEMO_DATA" ? <StatusPill tone="MOCK">NO REAL IMPACT</StatusPill> : null}
            <StatusPill tone="live-off">{t("common.liveDisabled")}</StatusPill>
            <StatusPill tone={derivDemoConnected ? "connected" : "MOCK"}>
              {derivDemoConnected ? t("dashboard.mockBlocked") : "MOCK DATA VISIBLE"}
            </StatusPill>
          </div>
        </aside>

        <main className="cockpit-main">
          <header className="cockpit-topbar">
            <div className="cockpit-title">
              <h1>{active.title}</h1>
              <p>{active.description}</p>
            </div>
            <div className="cockpit-top-actions">
              <StatusPill tone="live-off">{t("common.liveOff")}</StatusPill>
              <StatusPill tone={state.dataMode === "REAL_DATA" ? "critical" : "demo"}>{state.dataMode}</StatusPill>
              {topDataModeLabels.map(label => (
                <StatusPill tone={label === "MOCK" ? "MOCK" : "demo"} key={label}>{label}</StatusPill>
              ))}
              {derivDemoConnected ? <StatusPill tone="connected">DERIV DEMO</StatusPill> : null}
              {topDataModeLabels.includes(DEMO_MODE.name) ? null : <StatusPill tone="demo">{DEMO_MODE.name}</StatusPill>}
              <StatusPill className="mobile-hide-status" tone={activeSnapshot.market.runtimeMode}>
                {activeSnapshot.market.runtimeMode} ACTIVE
              </StatusPill>
              <StatusPill className="mobile-hide-status" tone={state.emergencyStop ? "critical" : "connected"}>
                {state.emergencyStop ? "STOPPED" : "SAFE"}
              </StatusPill>
              <span className="cockpit-pill cockpit-demo-balance">
                SIM {DEMO_MODE.accountBalance.toLocaleString("en-US")} {DEMO_MODE.currency}
              </span>
              <span className="cockpit-pill cockpit-last-action">
                <Activity size={13} />
                {state.lastAction}
              </span>
              <button className="razon-user-menu" onClick={onNavigateProfile} type="button">
                <span className="razon-user-avatar">{userInitials(authUser)}</span>
                <span className="razon-user-copy">
                  <strong>{authUser?.displayName ?? "Current user"}</strong>
                  <small>{licensePlan} · {licenseStatus}</small>
                </span>
                <UserCircle size={15} aria-hidden="true" />
              </button>
              {onLogout ? (
                <button className="razon-logout-button" onClick={onLogout} type="button">
                  <LogOut size={14} aria-hidden="true" />
                  Logout
                </button>
              ) : null}
              <span className="desktop-only">
                <EmergencyStopButton active={state.emergencyStop} onEmergencyStop={handleEmergencyStop} />
              </span>
            </div>
          </header>

          <div className="cockpit-content">
            {activePage === "dashboard" ? (
              <div className="mobile-only mobile-priority-stack">
                <MobileKalosCard
                  actionDisplayMode={actionDisplayMode}
                  enabled={state.kalosEnabled}
                  signal={activeSnapshot.signal}
                  onToggle={handleToggleKalos}
                />
                <MobileRiskStatus risk={activeSnapshot.risk} />
                <MobileTradingPanel
                  emergencyStop={state.emergencyStop}
                  strategyMode={state.strategyMode}
                  tradingMode={state.tradingMode}
                  onAction={setLastAction}
                  onStrategyModeChange={handleStrategyModeChange}
                  onTradingModeChange={handleTradingModeChange}
                />
                <MobileConnectorStatus connectors={activeConnectors} />
              </div>
            ) : null}

            {activePage === "dashboard" ? <DashboardPage {...sharedProps} /> : null}
            {activePage === "kalos" ? (
              <KalosPanelPage
                market={activeSnapshot.market}
                state={state}
                signal={activeSnapshot.signal}
                actionDisplayMode={actionDisplayMode}
                risk={activeSnapshot.risk}
                onToggleKalos={handleToggleKalos}
              />
            ) : null}
            {activePage === "market-chart" ? (
              <MarketChartPage
                alerts={alerts}
                candles={activeSnapshot.candles}
                market={activeSnapshot.market}
                signal={activeSnapshot.signal}
                actionDisplayMode={actionDisplayMode}
                watchlist={activeSnapshot.watchlist}
              />
            ) : null}
            {activePage === "connectors" ? (
              <ConnectorsPage
                connectors={activeConnectors}
                license={backendHealth?.license}
                onRefreshConnectors={refreshConnectors}
                user={backendHealth?.user}
              />
            ) : null}
            {activePage === "journal" ? <JournalPage backtests={backtestExamples} rows={activeJournalRows} /> : null}
            {activePage === "risk" ? (
              <RiskStatusPage
                risk={activeSnapshot.risk}
                state={state}
                onStrategyModeChange={handleStrategyModeChange}
                onTradingModeChange={handleTradingModeChange}
              />
            ) : null}
            {activePage === "settings" ? (
              <SettingsPage
                connectors={activeConnectors}
                license={backendHealth?.license}
                licenseStatus={licenseSnapshot}
                onRefreshConnectors={refreshConnectors}
                onRefreshLicense={refreshLicense}
                state={state}
                user={backendHealth?.user}
                onDataModeChange={handleDataModeChange}
                actionDisplayMode={actionDisplayMode}
                onActionDisplayModeChange={setActionDisplayMode}
                onStrategyModeChange={handleStrategyModeChange}
                onTradingModeChange={handleTradingModeChange}
              />
            ) : null}
          </div>
        </main>
      </div>
      {showMobileEmergencyStop ? <MobileEmergencyStop active={state.emergencyStop} onEmergencyStop={handleEmergencyStop} /> : null}
      <MobileBottomNav
        activePage={activePage}
        pages={cockpitPages}
        onSelect={selectPage}
      />
    </div>
  );
}
