import { Eye } from "lucide-react";
import type { KalosSignal } from "../app/cockpit.types";
import { formatDecision, formatPrice, StatusPill } from "./CockpitPrimitives";
import { ConfidenceGauge } from "./ConfidenceGauge";

export function MobileKalosCard({
  enabled,
  signal,
  onToggle,
}: {
  enabled: boolean;
  signal: KalosSignal;
  onToggle: () => void;
}) {
  return (
    <details className="mobile-panel" open>
      <summary>KALOS</summary>
      <div className="mobile-panel-body">
        <div className="mobile-signal-card">
          <div>
            <StatusPill tone={signal.decision}>{formatDecision(signal.decision)}</StatusPill>
            <h3>{signal.symbol}</h3>
            <p>{signal.timeframe} | {signal.volatility} | risk {signal.riskScore}</p>
          </div>
          <ConfidenceGauge value={signal.confidence} />
        </div>
        <div className="mobile-metric-strip">
          <span>TP <strong>{formatPrice(signal.tp)}</strong></span>
          <span>SL <strong>{formatPrice(signal.sl)}</strong></span>
          <span>INV <strong>{formatPrice(signal.invalidation)}</strong></span>
        </div>
        <button className={enabled ? "mobile-toggle is-active" : "mobile-toggle"} onClick={onToggle} type="button">
          <Eye size={16} />
          KALOS ON/OFF
        </button>
      </div>
    </details>
  );
}
