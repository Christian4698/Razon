import type { CockpitState, RiskStatus } from "../app/cockpit.types";
import { RiskScoreCard } from "../components/RiskScoreCard";
import { TradingModeSelector } from "../components/TradingModeSelector";
import { StatusPill } from "../components/CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";

export function RiskStatusPage({
  risk,
  state,
  onTradingModeChange,
  onStrategyModeChange,
}: {
  risk: RiskStatus;
  state: CockpitState;
  onTradingModeChange: Parameters<typeof TradingModeSelector>[0]["onTradingModeChange"];
  onStrategyModeChange: Parameters<typeof TradingModeSelector>[0]["onStrategyModeChange"];
}) {
  const { t } = useLanguage();
  const rules = [
    { label: "confidence >= 80", ok: true },
    { label: "RR >= 1:2", ok: risk.rr >= 2 },
    { label: t("risk.slPresent"), ok: risk.slPresent },
    { label: t("risk.tpPresent"), ok: risk.tpPresent },
    { label: t("risk.journalReady"), ok: risk.journalReady },
    { label: t("risk.liveDisabled"), ok: !risk.liveEnabled },
    { label: t("risk.mockExecutionBlocked"), ok: true },
    { label: t("risk.martingaleBlocked"), ok: true },
  ];

  return (
    <div className="cockpit-grid two">
      <div className="cockpit-stack">
        <RiskScoreCard risk={risk} />
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>{t("risk.rules")}</h2>
            <StatusPill tone="connected">{t("risk.enforced")}</StatusPill>
          </div>
          <div className="cockpit-stack">
            {rules.map(rule => (
              <div className="cockpit-rule-row" key={rule.label}>
                <div className="cockpit-row">
                  <strong>{rule.label}</strong>
                  <StatusPill tone={rule.ok ? "connected" : "critical"}>{rule.ok ? t("common.ok") : t("common.block")}</StatusPill>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="cockpit-stack">
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>{t("risk.tradingModes")}</h2>
            <StatusPill tone="live-off">{t("common.liveOff")}</StatusPill>
          </div>
          <TradingModeSelector
            strategyMode={state.strategyMode}
            tradingMode={state.tradingMode}
            onStrategyModeChange={onStrategyModeChange}
            onTradingModeChange={onTradingModeChange}
          />
        </section>
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>{t("risk.drawdown")}</h2>
            <span className="cockpit-pill demo">DEMO</span>
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
              <span className="cockpit-label">{t("risk.emergency")}</span>
              <div className={state.emergencyStop ? "cockpit-value cockpit-negative" : "cockpit-value cockpit-positive"}>
                {state.emergencyStop ? "ON" : "OFF"}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
