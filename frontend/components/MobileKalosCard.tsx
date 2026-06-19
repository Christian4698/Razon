import { Eye } from "lucide-react";
import type { ActionDisplayMode, KalosSignal } from "../app/cockpit.types";
import { displayAction, equivalentActionLabel } from "../app/actionDisplay";
import { formatPrice, StatusPill } from "./CockpitPrimitives";
import { ConfidenceGauge } from "./ConfidenceGauge";

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "n/a";
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} sec`;
  return `${Math.round(seconds / 60)} min`;
}

function formatMetric(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
}

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
          <span>HORIZON <strong>{signal.adaptiveHorizon?.selectedHorizon ?? signal.signalHorizon?.selected ?? "n/a"}</strong></span>
          <span>VALID <strong>{formatDuration(signal.adaptiveHorizon?.validForSeconds ?? signal.signalHorizon?.durationAliveSeconds)}</strong></span>
          <span>LEFT <strong>{formatDuration(signal.signalHorizon?.remainingSeconds)}</strong></span>
          <span>PROFIT <strong>{formatDuration(signal.adaptiveHorizon?.profitWindowSeconds)}</strong></span>
          <span>EV <strong>{formatMetric(signal.statisticalRisk?.expectedValue, 4)}</strong></span>
          <span>SHARPE <strong>{formatMetric(signal.statisticalRisk?.sharpeRatio, 2)}</strong></span>
          <span>KELLY <strong>{formatMetric((signal.statisticalRisk?.kellyFraction ?? 0) * 100, 2)}%</strong></span>
          <span>REGIME <strong>{signal.statisticalRisk?.volatilityRegime ?? "n/a"}</strong></span>
          <span>TF <strong>{signal.adaptiveHorizon?.timeframeAgreement ?? "n/a"}</strong></span>
        </div>
        {signal.statisticalRisk?.noTradeReason ? <p>No-trade reason: {signal.statisticalRisk.noTradeReason}</p> : null}
        {signal.adaptiveHorizon?.noTradeReason ? <p>Adaptive no-trade reason: {signal.adaptiveHorizon.noTradeReason}</p> : null}
        <button className={enabled ? "mobile-toggle is-active" : "mobile-toggle"} onClick={onToggle} type="button">
          <Eye size={16} />
          KALOS ON/OFF
        </button>
      </div>
    </details>
  );
}
