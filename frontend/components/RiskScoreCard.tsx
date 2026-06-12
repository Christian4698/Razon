import { ShieldCheck, ShieldX } from "lucide-react";
import type { RiskStatus } from "../app/cockpit.types";
import { Panel, StatusPill } from "./CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";

export function RiskScoreCard({ risk }: { risk: RiskStatus }) {
  const { t } = useLanguage();
  const accepted = risk.score < 50 && risk.slPresent && risk.tpPresent && risk.journalReady && !risk.liveEnabled;

  return (
    <Panel title={t("nav.risk")} action={<StatusPill tone={accepted ? "connected" : "critical"}>{accepted ? t("common.valid") : t("common.block")}</StatusPill>}>
      <div className="risk-score">
        {accepted ? <ShieldCheck size={42} color="#63e6a6" /> : <ShieldX size={42} color="#ff8a8a" />}
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

      <div className="cockpit-kpi-row" style={{ marginTop: 12 }}>
        <div className="cockpit-kpi">
          <span className="cockpit-label">RR</span>
          <div className="cockpit-value">1:{risk.rr}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">{t("common.risk")}/trade</span>
          <div className="cockpit-value">{risk.riskPerTrade}%</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">{t("risk.daily")}</span>
          <div className="cockpit-value">{risk.dailyDrawdown}%</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">LIVE</span>
          <div className="cockpit-value cockpit-negative">{risk.liveEnabled ? "ON" : "OFF"}</div>
        </div>
      </div>
    </Panel>
  );
}
