import { Eye, Target, XCircle } from "lucide-react";
import type { ActionDisplayMode, KalosSignal } from "../app/cockpit.types";
import { displayAction, equivalentActionLabel, toDerivAction } from "../app/actionDisplay";
import { formatPrice, Panel, StatusPill } from "./CockpitPrimitives";
import { ConfidenceGauge } from "./ConfidenceGauge";
import { useLanguage } from "@/i18n/useLanguage";

function kalosSourceLabel(signal: KalosSignal) {
  if (signal.dataSource === "DEMO" && signal.sourceStatus === "CONNECTED" && signal.dataSourceLabel?.toLowerCase().includes("deriv")) {
    return "DERIV DEMO";
  }

  if (signal.dataSource === "MOCK") return "MOCK_DATA";
  return signal.dataSourceLabel ?? signal.dataSource ?? "UNKNOWN";
}

export function KalosSignalCard({
  actionDisplayMode = "standard",
  signal,
  enabled,
  onToggle,
}: {
  actionDisplayMode?: ActionDisplayMode;
  signal: KalosSignal;
  enabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  const sourceLabel = kalosSourceLabel(signal);
  const actionLabel = displayAction(signal.decision, actionDisplayMode);
  const equivalent = equivalentActionLabel(signal.decision, actionDisplayMode);
  const derivPreview = toDerivAction(signal.decision);

  return (
    <Panel
      title={t("kalos.panel")}
      action={
        <button className={`cockpit-control ${enabled ? "is-active" : ""}`} onClick={onToggle} type="button">
          <Eye size={16} />
          {t("kalos.toggle")}
        </button>
      }
    >
      <div className="cockpit-row" style={{ alignItems: "flex-start" }}>
        <div className="cockpit-stack">
          <StatusPill tone={signal.decision}>ACTION: {actionLabel}</StatusPill>
          <span className="cockpit-muted">{equivalent.label}: {equivalent.value}</span>
          <span className="cockpit-muted">Would execute: {derivPreview}</span>
          <div>
            <div className="cockpit-label">{t("common.symbol")}</div>
            <div className="cockpit-value">{signal.symbol}</div>
            <span className="cockpit-muted">
              {signal.timeframe} | Volatilite {signal.volatility}
            </span>
          </div>
        </div>
        <ConfidenceGauge value={signal.confidence} />
      </div>

      <div className="cockpit-kpi-row" style={{ marginTop: 12 }}>
        <div className="cockpit-kpi">
          <span className="cockpit-label">{t("kalos.source")}</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{sourceLabel}</div>
          <span className="cockpit-muted">{signal.sourceStatus ?? "UNKNOWN"}</span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">{t("common.dataQuality")}</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{signal.dataQuality ?? "UNKNOWN"}</div>
          <span className="cockpit-muted">
            Freshness {signal.freshnessSeconds === undefined || signal.freshnessSeconds === null ? "n/a" : `${signal.freshnessSeconds}s`}
          </span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">TP</span>
          <div className="cockpit-value cockpit-positive">{formatPrice(signal.tp)}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">SL</span>
          <div className="cockpit-value cockpit-negative">{formatPrice(signal.sl)}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Invalidation</span>
          <div className="cockpit-value" style={{ fontSize: 20 }}>{formatPrice(signal.invalidation)}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">{t("common.riskScore")}</span>
          <div className="cockpit-value">{signal.riskScore}</div>
        </div>
      </div>

      <div className="cockpit-grid two" style={{ marginTop: 12 }}>
        <div className="cockpit-stack">
          <div className="cockpit-row" style={{ justifyContent: "flex-start" }}>
            <Target size={16} color="#63e6a6" />
            <strong>{t("kalos.reasonsAccepted")}</strong>
          </div>
          {signal.reasons.map(reason => (
            <p className="cockpit-muted" key={reason}>{reason}</p>
          ))}
        </div>
        <div className="cockpit-stack">
          <div className="cockpit-row" style={{ justifyContent: "flex-start" }}>
            <XCircle size={16} color="#f4c86a" />
            <strong>{t("kalos.reasonsRejected")}</strong>
          </div>
          {signal.rejectedReasons.map(reason => (
            <p className="cockpit-muted" key={reason}>{reason}</p>
          ))}
        </div>
      </div>
    </Panel>
  );
}
