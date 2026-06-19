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

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "n/a";
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} sec`;
  return `${Math.round(seconds / 60)} min`;
}

function formatMetric(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
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
          <span className="cockpit-label">Signal valid for</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>
            {formatDuration(signal.adaptiveHorizon?.validForSeconds ?? signal.signalHorizon?.durationAliveSeconds)}
          </div>
          <span className="cockpit-muted">
            Remaining {formatDuration(signal.signalHorizon?.remainingSeconds)}
          </span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Selected horizon</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{signal.adaptiveHorizon?.selectedHorizon ?? signal.signalHorizon?.selected ?? "n/a"}</div>
          <span className="cockpit-muted">
            Fixed {signal.adaptiveHorizon?.fixedHorizon ?? signal.signalHorizon?.selected ?? "n/a"}
          </span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Best profit window</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>
            {formatDuration(signal.adaptiveHorizon?.profitWindowSeconds ?? signal.signalHorizon?.maxProfitWindowSeconds)}
          </div>
          <span className="cockpit-muted">{signal.adaptiveHorizon?.recommendedAction ?? "n/a"}</span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Timeframe agreement</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{signal.adaptiveHorizon?.timeframeAgreement ?? "n/a"}</div>
          <span className="cockpit-muted">Risk mode {signal.adaptiveHorizon?.riskMode ?? "n/a"}</span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">{t("common.riskScore")}</span>
          <div className="cockpit-value">{signal.riskScore}</div>
        </div>
      </div>

      {signal.adaptiveHorizon ? (
        <p className="cockpit-muted" style={{ marginTop: 10 }}>
          Horizon reason: {signal.adaptiveHorizon.reason}
        </p>
      ) : null}

      <div className="cockpit-kpi-row" style={{ marginTop: 12 }}>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Expected Value</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{formatMetric(signal.statisticalRisk?.expectedValue, 4)}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Sharpe</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{formatMetric(signal.statisticalRisk?.sharpeRatio, 2)}</div>
          <span className="cockpit-muted">{signal.statisticalRisk?.sharpeStatus ?? "n/a"}</span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Drawdown</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{formatMetric(signal.statisticalRisk?.drawdown.dailyDrawdown, 2)}%</div>
          <span className="cockpit-muted">Max {formatMetric(signal.statisticalRisk?.drawdown.maxDrawdown, 2)}%</span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Kelly</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{formatMetric((signal.statisticalRisk?.kellyFraction ?? 0) * 100, 2)}%</div>
          <span className="cockpit-muted">Stake {formatMetric(signal.statisticalRisk?.recommendedStake, 2)} USD</span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Volatility regime</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{signal.statisticalRisk?.volatilityRegime ?? "n/a"}</div>
          <span className="cockpit-muted">RR {formatMetric(signal.statisticalRisk?.riskReward, 2)}</span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Calibration status</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{signal.statisticalRisk?.calibration.status ?? "n/a"}</div>
          <span className="cockpit-muted">Error {formatMetric(signal.statisticalRisk?.calibration.calibrationError, 4)}</span>
        </div>
      </div>

      {signal.statisticalRisk?.noTradeReason ? (
        <p className="cockpit-muted" style={{ marginTop: 10 }}>
          No-trade reason: {signal.statisticalRisk.noTradeReason}
        </p>
      ) : null}
      {signal.adaptiveHorizon?.noTradeReason ? (
        <p className="cockpit-muted" style={{ marginTop: 10 }}>
          Adaptive no-trade reason: {signal.adaptiveHorizon.noTradeReason}
        </p>
      ) : null}

      <div className="cockpit-kpi-row" style={{ marginTop: 12 }}>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Backtest score</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{signal.backtestValidation?.backtestScore ?? "n/a"}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Monte Carlo score</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{signal.backtestValidation?.monteCarloScore ?? "n/a"}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Risk of ruin</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{formatMetric(signal.backtestValidation?.riskOfRuin, 2)}%</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Recommended mode</span>
          <div className="cockpit-value" style={{ fontSize: 16 }}>{signal.backtestValidation?.recommendedMode ?? "n/a"}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Recommended horizon</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{signal.backtestValidation?.recommendedHorizon ?? "n/a"}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Real readiness</span>
          <div className="cockpit-value cockpit-negative" style={{ fontSize: 18 }}>
            {signal.backtestValidation?.realReadinessLabel ?? "REAL NOT READY"}
          </div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Production Confidence</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>
            {signal.backtestValidation?.productionConfidence?.productionConfidence ?? "LOW"}
          </div>
          <span className="cockpit-muted">
            Gap {formatMetric(signal.backtestValidation?.productionConfidence?.generalizationGap, 2)}
          </span>
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
