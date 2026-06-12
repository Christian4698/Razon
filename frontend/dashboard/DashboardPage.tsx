import { useMemo, useState } from "react";
import type {
  AlertItem,
  BacktestSummary,
  CockpitState,
  ConnectorStatus,
  KalosSignal,
  JournalRow,
  LicenseStatusSnapshot,
  MarketStatus,
  OhlcCandle,
  RiskStatus,
  SyntheticIndexSymbol,
  WatchlistItem,
} from "../app/cockpit.types";
import { chartContextActions, syntheticIndexSymbols } from "../app/cockpit-data";
import { MarketStatusCard } from "../components/MarketStatusCard";
import { KalosSignalCard } from "../components/KalosSignalCard";
import { RiskScoreCard } from "../components/RiskScoreCard";
import { TradingModeSelector } from "../components/TradingModeSelector";
import { WatchlistPanel } from "../components/WatchlistPanel";
import { AlertPanel } from "../components/AlertPanel";
import { JournalTable } from "../components/JournalTable";
import { ConnectionStatusCard } from "../components/ConnectionStatusCard";
import { formatDecision, formatPrice, StatusPill } from "../components/CockpitPrimitives";
import { KalosFuturePathPanel } from "../kalos/KalosFuturePathPanel";
import { KalosMarketBrainPanel } from "../kalos/KalosMarketBrainPanel";
import { KalosMarketReplayPanel } from "../kalos/KalosMarketReplayPanel";
import { KalosVisualIntelligencePanel } from "../kalos/KalosVisualIntelligencePanel";
import { LiveMarketChart } from "../trading/LiveMarketChart";
import { useLanguage } from "@/i18n/useLanguage";

type DashboardTab = "quick" | "kalos" | "chart" | "risk" | "journal" | "replay" | "connectors";

const dashboardTabs: readonly { id: DashboardTab; labelKey: string }[] = [
  { id: "quick", labelKey: "dashboard.tabs.quick" },
  { id: "kalos", labelKey: "dashboard.tabs.kalos" },
  { id: "chart", labelKey: "dashboard.tabs.chart" },
  { id: "risk", labelKey: "dashboard.tabs.risk" },
  { id: "journal", labelKey: "dashboard.tabs.journal" },
  { id: "replay", labelKey: "dashboard.tabs.replay" },
  { id: "connectors", labelKey: "dashboard.tabs.connectors" },
];

function displaySource(state: CockpitState, market: MarketStatus): "MOCK" | "DEMO" | "REAL_DATA" {
  if (state.dataMode === "REAL_DATA" || market.source === "LIVE") return "REAL_DATA";
  return market.source;
}

function feedStatus(state: CockpitState, market: MarketStatus): "CONNECTED" | "DELAYED" | "MOCK" | "DISCONNECTED" | "UNKNOWN" {
  if (market.sourceStatus) return market.sourceStatus;
  if (state.dataMode === "REAL_DATA") return "DELAYED";
  if (market.source === "DEMO") return "CONNECTED";
  return "MOCK";
}

function marketDataSourceLabel(market: MarketStatus) {
  if (market.source === "DEMO" && market.sourceStatus === "CONNECTED" && market.session.toLowerCase().includes("deriv")) {
    return "DERIV DEMO";
  }
  if (market.source === "MOCK") return "MOCK_DATA";
  return market.source;
}

function feedTone(status: "CONNECTED" | "DELAYED" | "MOCK" | "DISCONNECTED" | "UNKNOWN") {
  if (status === "CONNECTED") return "connected" as const;
  if (status === "DELAYED") return "delayed" as const;
  if (status === "DISCONNECTED" || status === "UNKNOWN") return "disconnected" as const;
  return "MOCK" as const;
}

function qualityTone(quality: MarketStatus["dataQuality"]) {
  if (quality === "HEALTHY") return "connected" as const;
  if (quality === "DEGRADED" || quality === "STALE") return "delayed" as const;
  if (quality === "INVALID" || quality === "DISCONNECTED") return "critical" as const;
  return "MOCK" as const;
}

function formatSourceTimestamp(timestamp: string | null | undefined) {
  if (!timestamp) return "n/a";
  return new Date(timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function kalosDataSourceLabel(signal: KalosSignal, market: MarketStatus, state: CockpitState) {
  const source = signal.dataSource ?? displaySource(state, market);
  const label = signal.dataSourceLabel ?? market.session;
  const isDerivDemo =
    source === "DEMO" &&
    (signal.sourceStatus ?? market.sourceStatus) === "CONNECTED" &&
    label.toLowerCase().includes("deriv");

  if (isDerivDemo) return "DERIV DEMO";
  if (source === "MOCK" || market.source === "MOCK") return "MOCK_DATA";
  return source;
}

function mockPolicyLabel(dataSourceLabel: string, market: MarketStatus) {
  if (dataSourceLabel === "DERIV DEMO" && market.sourceStatus === "CONNECTED") return "MOCK_DATA BLOCKED";
  if (dataSourceLabel === "MOCK_DATA") return "MOCK_DATA FALLBACK";
  return "MOCK_DATA OFF";
}

function SyntheticMarketSelector({
  selectedSymbol,
  onChange,
}: {
  selectedSymbol: SyntheticIndexSymbol;
  onChange: (symbol: SyntheticIndexSymbol) => void;
}) {
  const { t } = useLanguage();

  return (
    <section className="cockpit-panel dashboard-selector-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>{t("dashboard.synthetic.title")}</h2>
          <p className="cockpit-muted">{t("dashboard.synthetic.description")}</p>
        </div>
        <StatusPill tone="live-off">{t("common.noRealExecution")}</StatusPill>
      </div>
      <div className="synthetic-market-selector" role="radiogroup" aria-label="Deriv synthetic market selector">
        {syntheticIndexSymbols.map(symbol => (
          <button
            aria-checked={symbol === selectedSymbol}
            className={`cockpit-control ${symbol === selectedSymbol ? "is-active" : ""}`}
            key={symbol}
            onClick={() => onChange(symbol)}
            role="radio"
            type="button"
          >
            {symbol}
          </button>
        ))}
      </div>
    </section>
  );
}

function LicenseGateBanner({ license }: { license: LicenseStatusSnapshot | null }) {
  const { t } = useLanguage();
  if (!license?.dashboardBlocked) return null;

  const status = license?.status ?? "MISSING";
  const label =
    status === "EXPIRED"
      ? t("dashboard.license.expired")
      : status === "SUSPENDED"
        ? t("dashboard.license.suspended")
        : status === "REVOKED"
          ? t("dashboard.license.revoked")
          : t("dashboard.license.required");

  return (
    <section className="cockpit-panel license-gate-panel">
      <div>
        <span className="cockpit-label">{t("common.dashboardAccess")}</span>
        <h2>{label}</h2>
        <p className="cockpit-muted">{t("dashboard.license.readOnly")}</p>
      </div>
      <StatusPill tone="critical">LIMITED READ ONLY</StatusPill>
    </section>
  );
}

function KalosDashboardSummary({
  market,
  selectedSymbol,
  signal,
  state,
}: {
  market: MarketStatus;
  selectedSymbol: SyntheticIndexSymbol;
  signal: KalosSignal;
  state: CockpitState;
}) {
  const { t } = useLanguage();
  const status = feedStatus(state, market);
  const dataSourceLabel = kalosDataSourceLabel(signal, market, state);
  const mockPolicy = mockPolicyLabel(dataSourceLabel, market);
  const dataQuality = signal.dataQuality ?? market.dataQuality;
  const freshnessSeconds = signal.freshnessSeconds ?? market.freshnessSeconds;
  const latencyMs = signal.latencyMs ?? market.latencyMs;

  return (
    <section className="cockpit-panel dashboard-summary-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>{t("dashboard.kalosSummary")}</h2>
          <p className="cockpit-muted">{t("dashboard.kalosSummaryHint")}</p>
        </div>
        <StatusPill tone="live-off">{t("common.liveOff")}</StatusPill>
      </div>

      <div className="dashboard-summary-symbol">
        <span className="cockpit-label">{t("dashboard.selectedSymbol")}</span>
        <strong>{selectedSymbol}</strong>
        <span className="cockpit-muted">
          {market.timeframe} | prix {formatPrice(market.price)}
        </span>
      </div>

      <div className="dashboard-mini-grid">
        <span>
          <b>Source</b>
          <StatusPill tone={dataSourceLabel === "DERIV DEMO" ? "connected" : dataSourceLabel === "MOCK_DATA" ? "MOCK" : "demo"}>
            {dataSourceLabel}
          </StatusPill>
        </span>
        <span>
          <b>{t("dashboard.feedStatus")}</b>
          <StatusPill tone={feedTone(status)}>{status}</StatusPill>
        </span>
        <span>
          <b>{t("common.decision")}</b>
          <strong>{formatDecision(signal.decision)}</strong>
        </span>
        <span>
          <b>{t("common.confidence")}</b>
          <strong>{signal.confidence}%</strong>
        </span>
      </div>

      <div className="dashboard-data-source-banner">
        <div>
          <span className="cockpit-label">{t("common.dataSource")}</span>
          <strong>{dataSourceLabel}</strong>
        </div>
        <StatusPill tone={dataSourceLabel === "DERIV DEMO" ? "connected" : dataSourceLabel === "MOCK_DATA" ? "MOCK" : "demo"}>
          {mockPolicy}
        </StatusPill>
      </div>

      <div className="dashboard-mini-grid">
        <span>
          <b>{t("dashboard.kalosSource")}</b>
          <strong>{signal.dataSourceLabel ?? market.session}</strong>
        </span>
        <span>
          <b>{t("common.fallback")}</b>
          <StatusPill tone={market.fallback === "MOCK_DATA" ? "MOCK" : "connected"}>{market.fallback ?? "NONE"}</StatusPill>
        </span>
        <span>
          <b>{t("dashboard.kalosQuality")}</b>
          <StatusPill tone={qualityTone(dataQuality)}>{dataQuality ?? "UNKNOWN"}</StatusPill>
        </span>
        <span>
          <b>{t("common.lastTick")}</b>
          <strong>{formatSourceTimestamp(signal.lastTickAt ?? market.lastTickAt)}</strong>
        </span>
        <span>
          <b>{t("common.lastCandle")}</b>
          <strong>{formatSourceTimestamp(signal.lastCandleAt ?? market.lastCandleAt)}</strong>
        </span>
        <span>
          <b>{t("common.latency")}</b>
          <strong>{latencyMs === undefined || latencyMs === null ? "n/a" : `${latencyMs} ms`}</strong>
        </span>
        <span>
          <b>{t("common.freshness")}</b>
          <strong>{freshnessSeconds === undefined || freshnessSeconds === null ? "n/a" : `${freshnessSeconds}s`}</strong>
        </span>
      </div>

      <div className="dashboard-safety-row">
        <StatusPill tone="live-off">{t("common.liveOff")}</StatusPill>
        <StatusPill tone="live-off">{t("common.autoExecutionOff")}</StatusPill>
      </div>
    </section>
  );
}

function RiskDashboardSummary({ risk }: { risk: RiskStatus }) {
  const { t } = useLanguage();
  const accepted = risk.score < 50 && risk.slPresent && risk.tpPresent && risk.journalReady && !risk.liveEnabled;

  return (
    <section className="cockpit-panel dashboard-summary-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>{t("dashboard.riskSummary")}</h2>
          <p className="cockpit-muted">{t("dashboard.riskSummaryHint")}</p>
        </div>
        <StatusPill tone={accepted ? "connected" : "critical"}>{accepted ? t("common.valid") : t("common.block")}</StatusPill>
      </div>

      <div className="risk-score compact">
        <div style={{ flex: 1 }}>
          <div className="cockpit-row">
            <span className="cockpit-label">{t("common.riskScore")}</span>
            <strong>{risk.score}/100</strong>
          </div>
          <div className="risk-meter" aria-label={`Risk score ${risk.score}`}>
            <span style={{ width: `${risk.score}%` }} />
          </div>
        </div>
      </div>

      <div className="dashboard-mini-grid">
        <span>
          <b>RR</b>
          <strong>1:{risk.rr}</strong>
        </span>
        <span>
          <b>{t("common.risk")}/trade</b>
          <strong>{risk.riskPerTrade}%</strong>
        </span>
        <span>
          <b>DD jour</b>
          <strong>{risk.dailyDrawdown}%</strong>
        </span>
        <span>
          <b>LIVE</b>
          <strong className="cockpit-negative">OFF</strong>
        </span>
      </div>
    </section>
  );
}

function RiskRulesPanel({ risk }: { risk: RiskStatus }) {
  const { t } = useLanguage();
  const rules = [
    { label: "confidence >= 80", ok: true },
    { label: "RR >= 1:2", ok: risk.rr >= 2 },
    { label: t("risk.slPresent"), ok: risk.slPresent },
    { label: t("risk.tpPresent"), ok: risk.tpPresent },
    { label: t("risk.journalReady"), ok: risk.journalReady },
    { label: t("risk.liveDisabled"), ok: !risk.liveEnabled },
    { label: t("common.autoExecutionOff"), ok: true },
  ];

  return (
    <section className="cockpit-panel">
      <div className="cockpit-panel-header">
        <h2>{t("dashboard.riskRules")}</h2>
        <StatusPill tone="connected">{t("risk.enforced")}</StatusPill>
      </div>
      <div className="cockpit-stack">
        {rules.map(rule => (
          <div className="cockpit-rule-row" key={rule.label}>
            <div className="cockpit-row">
              <strong>{rule.label}</strong>
              <StatusPill tone={rule.ok ? "connected" : "critical"}>{rule.ok ? "OK" : "BLOCK"}</StatusPill>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BacktestPreview({ backtests }: { backtests: readonly BacktestSummary[] }) {
  const { t } = useLanguage();
  return (
    <section className="cockpit-panel">
      <div className="cockpit-panel-header">
        <h2>{t("dashboard.backtests")}</h2>
        <StatusPill tone="MOCK">{t("common.readOnly")}</StatusPill>
      </div>
      <div className="demo-backtest-grid compact">
        {backtests.slice(0, 2).map(backtest => (
          <article className="demo-backtest-card" key={backtest.id}>
            <div className="cockpit-row">
              <strong>{backtest.id}</strong>
              <StatusPill tone={backtest.dataSource}>{backtest.dataSource}</StatusPill>
            </div>
            <p className="cockpit-muted">
              {backtest.symbol} | {backtest.timeframe} | {backtest.mode}
            </p>
            <div className="demo-metric-row">
              <span>
                Win
                <strong>{backtest.winRate.toFixed(1)}%</strong>
              </span>
              <span>
                PF
                <strong>{backtest.profitFactor.toFixed(2)}</strong>
              </span>
              <span>
                Net
                <strong className={backtest.netProfit >= 0 ? "cockpit-positive" : "cockpit-negative"}>
                  {backtest.netProfit.toFixed(1)}
                </strong>
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DashboardPage({
  state,
  market,
  signal,
  risk,
  candles,
  connectors,
  journalRows,
  license,
  watchlist,
  alerts,
  backtests,
  selectedSyntheticSymbol,
  onSyntheticSymbolChange,
  onToggleKalos,
  onTradingModeChange,
  onStrategyModeChange,
}: {
  state: CockpitState;
  market: MarketStatus;
  signal: KalosSignal;
  risk: RiskStatus;
  candles: readonly OhlcCandle[];
  connectors: readonly ConnectorStatus[];
  journalRows: readonly JournalRow[];
  license: LicenseStatusSnapshot | null;
  watchlist: readonly WatchlistItem[];
  alerts: readonly AlertItem[];
  backtests: readonly BacktestSummary[];
  selectedSyntheticSymbol: SyntheticIndexSymbol;
  onSyntheticSymbolChange: (symbol: SyntheticIndexSymbol) => void;
  onToggleKalos: () => void;
  onTradingModeChange: Parameters<typeof TradingModeSelector>[0]["onTradingModeChange"];
  onStrategyModeChange: Parameters<typeof TradingModeSelector>[0]["onStrategyModeChange"];
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<DashboardTab>("quick");
  const marketSourceLabel = marketDataSourceLabel(market);
  const journalForSymbol = useMemo(() => {
    const selectedRows = journalRows.filter(row => row.symbol === selectedSyntheticSymbol);
    const syntheticRow: JournalRow = {
      id: `SYN-${selectedSyntheticSymbol.replace(/\s/g, "-").toUpperCase()}`,
      timestamp: new Date().toISOString(),
      symbol: selectedSyntheticSymbol,
      timeframe: market.timeframe,
      mode: state.strategyMode,
      decision: signal.decision,
      confidence: signal.confidence,
      riskScore: risk.score,
      source: market.source,
      module: "KALOS",
      sourceLabel: market.source === "DEMO" && market.sourceStatus === "CONNECTED" ? "DERIV DEMO" : undefined,
      fallback: market.fallback,
      result: `Synthetic index analysis only; ${market.sourceStatus ?? "UNKNOWN"}; fallback ${market.fallback ?? "n/a"}; LIVE OFF and AUTO execution OFF`,
    };

    return [syntheticRow, ...selectedRows, ...journalRows.filter(row => row.symbol !== selectedSyntheticSymbol)].slice(0, 6);
  }, [
    journalRows,
    market.fallback,
    market.source,
    market.sourceStatus,
    market.timeframe,
    risk.score,
    selectedSyntheticSymbol,
    signal.confidence,
    signal.decision,
    state.strategyMode,
  ]);

  return (
    <div className="dashboard-shell">
      <LicenseGateBanner license={license} />
      <SyntheticMarketSelector selectedSymbol={selectedSyntheticSymbol} onChange={onSyntheticSymbolChange} />

      <div className="dashboard-main-grid">
        <div className="dashboard-chart-column">
          <LiveMarketChart candles={candles} market={market} signal={signal} />
        </div>
        <aside className="dashboard-summary-column" aria-label="KALOS and risk summaries">
          <KalosDashboardSummary
            market={market}
            selectedSymbol={selectedSyntheticSymbol}
            signal={signal}
            state={state}
          />
          <RiskDashboardSummary risk={risk} />
        </aside>
      </div>

      <section className="cockpit-panel dashboard-tabs-panel">
        <div className="dashboard-tab-list" role="tablist" aria-label="Dashboard detail views">
          {dashboardTabs.map(tab => (
            <button
              aria-selected={tab.id === activeTab}
              className={`dashboard-tab ${tab.id === activeTab ? "is-active" : ""}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="dashboard-tab-body" role="tabpanel">
          {activeTab === "quick" ? (
            <div className="dashboard-tab-grid">
              <MarketStatusCard dataMode={state.dataMode} market={market} />
              <section className="cockpit-panel">
                <div className="cockpit-panel-header">
                  <h2>{t("settings.modes")}</h2>
                  <StatusPill tone="live-off">{t("common.autoExecutionOff")}</StatusPill>
                </div>
                <TradingModeSelector
                  strategyMode={state.strategyMode}
                  tradingMode={state.tradingMode}
                  onStrategyModeChange={onStrategyModeChange}
                  onTradingModeChange={onTradingModeChange}
                />
              </section>
              <WatchlistPanel items={watchlist.slice(0, 5)} />
              <AlertPanel alerts={alerts.slice(0, 2)} />
            </div>
          ) : null}

          {activeTab === "kalos" ? (
            <div className="dashboard-tab-grid">
              <KalosSignalCard enabled={state.kalosEnabled} onToggle={onToggleKalos} signal={signal} />
              <KalosMarketBrainPanel brain={signal.marketBrain} />
              <KalosVisualIntelligencePanel signal={signal} />
              <KalosFuturePathPanel futurePath={signal.futurePath} />
            </div>
          ) : null}

          {activeTab === "chart" ? (
            <div className="dashboard-tab-grid">
              <section className="cockpit-panel">
                <div className="cockpit-panel-header">
                  <div>
                    <h2>{t("dashboard.chartContext")}</h2>
                    <p className="cockpit-muted">
                      {selectedSyntheticSymbol} | {market.timeframe} | {marketSourceLabel} | flux {feedStatus(state, market)} | fallback{" "}
                      {market.fallback ?? "NONE"}
                    </p>
                  </div>
                  <StatusPill tone="live-off">{t("common.noExecution")}</StatusPill>
                </div>
                <div className="cockpit-kpi-row">
                  <div className="cockpit-kpi">
                    <span className="cockpit-label">{t("common.price")}</span>
                    <div className="cockpit-value">{formatPrice(market.price)}</div>
                  </div>
                  <div className="cockpit-kpi">
                    <span className="cockpit-label">Spread</span>
                    <div className="cockpit-value">{market.spread}</div>
                  </div>
                  <div className="cockpit-kpi">
                    <span className="cockpit-label">{t("common.volume")}</span>
                    <div className="cockpit-value">{market.volume.toLocaleString("en-US")}</div>
                  </div>
                  <div className="cockpit-kpi">
                    <span className="cockpit-label">{t("common.dataQuality")}</span>
                    <div className="cockpit-value" style={{ fontSize: 18 }}>{market.dataQuality ?? "UNKNOWN"}</div>
                  </div>
                  <div className="cockpit-kpi">
                    <span className="cockpit-label">{t("chart.sync")}</span>
                    <div className="cockpit-value" style={{ fontSize: 18 }}>{market.syncStatus ?? "UNKNOWN"}</div>
                  </div>
                </div>
              </section>
              <section className="cockpit-panel">
                <div className="cockpit-panel-header">
                  <h2>{t("dashboard.chartActions")}</h2>
                  <StatusPill tone="MOCK">{t("common.readOnly")}</StatusPill>
                </div>
                <div className="overlay-chip-grid">
                  {chartContextActions.map(action => (
                    <span className="overlay-chip" key={action.id}>{action.label}</span>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "risk" ? (
            <div className="dashboard-tab-grid">
              <RiskScoreCard risk={risk} />
              <RiskRulesPanel risk={risk} />
              <section className="cockpit-panel">
                <div className="cockpit-panel-header">
                  <h2>{t("dashboard.drawdown")}</h2>
                  <StatusPill tone="demo">DEMO</StatusPill>
                </div>
                <div className="cockpit-kpi-row">
                  <div className="cockpit-kpi">
                    <span className="cockpit-label">{t("risk.daily")}</span>
                    <div className="cockpit-value">{risk.dailyDrawdown}%</div>
                  </div>
                  <div className="cockpit-kpi">
                    <span className="cockpit-label">{t("risk.weekly")}</span>
                    <div className="cockpit-value">{risk.weeklyDrawdown}%</div>
                  </div>
                  <div className="cockpit-kpi">
                    <span className="cockpit-label">{t("risk.total")}</span>
                    <div className="cockpit-value">{risk.totalDrawdown}%</div>
                  </div>
                  <div className="cockpit-kpi">
                    <span className="cockpit-label">{t("common.execution")}</span>
                    <div className="cockpit-value cockpit-negative">OFF</div>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "journal" ? (
            <div className="dashboard-tab-grid single">
              <section className="cockpit-panel">
                <div className="cockpit-panel-header">
                  <h2>{t("journal.title")}</h2>
                  <StatusPill tone="connected">{t("journal.noTradeLogged")}</StatusPill>
                </div>
                <JournalTable rows={journalForSymbol} />
              </section>
              <BacktestPreview backtests={backtests} />
            </div>
          ) : null}

          {activeTab === "replay" ? <KalosMarketReplayPanel replay={signal.marketReplay} /> : null}

          {activeTab === "connectors" ? (
            <div className="dashboard-tab-grid connectors">
              {connectors.slice(0, 4).map(connector => (
                <ConnectionStatusCard connector={connector} key={connector.id} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
