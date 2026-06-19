import { Eye } from "lucide-react";
import type { ActionDisplayMode, KalosSignal } from "../app/cockpit.types";
import { displayAction, equivalentActionLabel } from "../app/actionDisplay";
import { formatPrice, StatusPill } from "./CockpitPrimitives";
import { ConfidenceGauge } from "./ConfidenceGauge";

export function MobileKalosCard({
  actionDisplayMode = "standard",
  enabled,
  signal,
  onToggle,
}: {
  actionDisplayMode?: ActionDisplayMode;
  enabled: boolean;
  signal: KalosSignal;
  onToggle: () => void;
}) {
  const actionLabel = displayAction(signal.decision, actionDisplayMode);
  const equivalent = equivalentActionLabel(signal.decision, actionDisplayMode);

  return (
    <details className="mobile-panel" open>
      <summary>KALOS</summary>
      <div className="mobile-panel-body">
        <div className="mobile-signal-card">
          <div>
            <StatusPill tone={signal.decision}>ACTION: {actionLabel}</StatusPill>
            <h3>{signal.symbol}</h3>
            <p>{equivalent.label}: {equivalent.value} | {signal.timeframe} | {signal.volatility} | risk {signal.riskScore}</p>
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
