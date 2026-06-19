import type { ActionDisplayMode, CockpitState, KalosSignal, MarketStatus, RiskStatus } from "../app/cockpit.types";
import { displayAction } from "../app/actionDisplay";
import { frappeDollarChecklist, syntheticIndexSymbols } from "../app/cockpit-data";
import { KalosSignalCard } from "../components/KalosSignalCard";
import { KalosFuturePathPanel } from "./KalosFuturePathPanel";
import { KalosMarketReplayPanel } from "./KalosMarketReplayPanel";
import { KalosMarketBrainPanel } from "./KalosMarketBrainPanel";
import { KalosVisualIntelligencePanel } from "./KalosVisualIntelligencePanel";
import { RiskScoreCard } from "../components/RiskScoreCard";
import { StatusPill } from "../components/CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";

export function KalosPanelPage({
  market,
  state,
  signal,
  actionDisplayMode,
  risk,
  onToggleKalos,
}: {
  market: MarketStatus;
  state: CockpitState;
  signal: KalosSignal;
  actionDisplayMode: ActionDisplayMode;
  risk: RiskStatus;
  onToggleKalos: () => void;
}) {
  const { t } = useLanguage();
  const derivConnected =
    market.source === "DEMO" &&
    market.sourceStatus === "CONNECTED" &&
    market.session.toLowerCase().includes("deriv");
  const syntheticStatus = derivConnected ? "DERIV DEMO CONNECTED" : "DERIV DEMO DISCONNECTED";
  const actionLabel = displayAction(signal.decision, actionDisplayMode);
  const layers = [
    { label: "HTF", value: signal.htf },
    { label: "MTF", value: signal.mtf },
    { label: "LTF", value: signal.ltf },
  ];

  const features = [
    "market_structure",
    "liquidity",
    "trend",
    "momentum",
    "volatility",
    "entry_score",
    "no_trade",
    "explanations",
    "kalos_market_brain",
    "future_path_engine",
    "market_replay",
    "kalos_overlay",
    "synthetic_indices",
    "frappe_dollar",
    "chart_context_menu",
  ];

  return (
    <div className="cockpit-grid two">
      <div className="cockpit-stack">
        <KalosSignalCard actionDisplayMode={actionDisplayMode} enabled={state.kalosEnabled} onToggle={onToggleKalos} signal={signal} />
        <KalosVisualIntelligencePanel signal={signal} />
        <KalosMarketBrainPanel brain={signal.marketBrain} />
        <KalosFuturePathPanel futurePath={signal.futurePath} />
        <KalosMarketReplayPanel replay={signal.marketReplay} />
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>HTF / MTF / LTF</h2>
            <StatusPill tone={signal.decision}>ACTION: {actionLabel}</StatusPill>
          </div>
          <div className="cockpit-grid three">
            {layers.map(layer => (
              <div className="cockpit-kpi" key={layer.label}>
                <span className="cockpit-label">{layer.label}</span>
                <div className="cockpit-value" style={{ fontSize: 19 }}>{layer.value}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="cockpit-stack">
        <RiskScoreCard risk={risk} />
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>{t("kalos.featureMatrix")}</h2>
            <StatusPill tone="live-off">{t("common.noExecution")}</StatusPill>
          </div>
          <div className="cockpit-stack">
            {features.map(feature => (
              <div className="cockpit-rule-row" key={feature}>
                <div className="cockpit-row">
                  <strong>{feature}</strong>
                  <StatusPill tone="connected">READY</StatusPill>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>FrappeDollar Engine</h2>
            <StatusPill tone="live-off">{t("common.noExecution")}</StatusPill>
          </div>
          <div className="cockpit-stack">
            {frappeDollarChecklist.map(item => (
              <div className="cockpit-rule-row" key={item.label}>
                <div className="cockpit-row">
                  <strong>{item.label}</strong>
                  <StatusPill tone={item.status === "BLOCKED" ? "critical" : "demo"}>
                    {item.status === "MOCK" ? "READ_ONLY" : item.status}
                  </StatusPill>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>{t("kalos.syntheticIndices")}</h2>
            <StatusPill tone={derivConnected ? "connected" : "disconnected"}>{syntheticStatus}</StatusPill>
          </div>
          <div className="overlay-chip-grid">
            {syntheticIndexSymbols.map(symbol => (
              <span className="overlay-chip" key={symbol}>{symbol}</span>
            ))}
          </div>
        </section>
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>{t("kalos.calibration")}</h2>
            <StatusPill tone={derivConnected ? "connected" : "delayed"}>
              {derivConnected ? "CONNECTED" : "PENDING DATA"}
            </StatusPill>
          </div>
          <div className="cockpit-kpi-row">
            <div className="cockpit-kpi">
              <span className="cockpit-label">{t("common.confidence")} cap</span>
              <div className="cockpit-value">95%</div>
            </div>
            <div className="cockpit-kpi">
              <span className="cockpit-label">Dataset</span>
              <div className="cockpit-value" style={{ fontSize: 18 }}>
                {derivConnected ? "DERIV DEMO" : "MOCK_DATA"}
              </div>
            </div>
            <div className="cockpit-kpi">
              <span className="cockpit-label">NO_TRADE</span>
              <div className="cockpit-value cockpit-positive">ON</div>
            </div>
            <div className="cockpit-kpi">
              <span className="cockpit-label">{t("common.execution")}</span>
              <div className="cockpit-value cockpit-negative">OFF</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
