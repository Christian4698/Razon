import { ShieldCheck } from "lucide-react";
import type { RiskStatus } from "../app/cockpit.types";
import { StatusPill } from "./CockpitPrimitives";

export function MobileRiskStatus({ risk }: { risk: RiskStatus }) {
  return (
    <details className="mobile-panel" open>
      <summary>Risk Status</summary>
      <div className="mobile-panel-body">
        <div className="mobile-risk-card">
          <ShieldCheck size={30} color="#63e6a6" />
          <div>
            <div className="cockpit-label">Risk score</div>
            <strong>{risk.score}/100</strong>
          </div>
          <StatusPill tone="live-off">LIVE OFF</StatusPill>
        </div>
        <div className="mobile-metric-strip">
          <span>RR <strong>1:{risk.rr}</strong></span>
          <span>Risk <strong>{risk.riskPerTrade}%</strong></span>
          <span>DD <strong>{risk.dailyDrawdown}%</strong></span>
        </div>
      </div>
    </details>
  );
}
