import { AlertTriangle, Database, LockKeyhole, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import type { DataMode, DataModeAuditEntry } from "../app/cockpit.types";
import { dataModeLabels } from "../app/cockpit-data";
import { StatusPill } from "../components/CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";

const REQUIRED_PHRASE = "JE COMPRENDS";

function blockerReason({
  emergencyStop,
  analysisInProgress,
  tradeInProgress,
  t,
}: {
  emergencyStop: boolean;
  analysisInProgress: boolean;
  tradeInProgress: boolean;
  t: (key: string) => string;
}) {
  if (emergencyStop) return t("dataMode.blockerEmergency");
  if (analysisInProgress) return t("dataMode.blockerAnalysis");
  if (tradeInProgress) return t("dataMode.blockerTrade");
  return null;
}

export function DataModeControl({
  currentMode,
  emergencyStop,
  analysisInProgress,
  tradeInProgress,
  auditEntries,
  onDataModeChange,
}: {
  currentMode: DataMode;
  emergencyStop: boolean;
  analysisInProgress: boolean;
  tradeInProgress: boolean;
  auditEntries: readonly DataModeAuditEntry[];
  onDataModeChange: (targetMode: DataMode, status: "APPLIED" | "BLOCKED", reason: string) => void;
}) {
  const { t } = useLanguage();
  const [targetMode, setTargetMode] = useState<DataMode>(currentMode === "DEMO_DATA" ? "REAL_DATA" : "DEMO_DATA");
  const [warningAccepted, setWarningAccepted] = useState(false);
  const [safetyAccepted, setSafetyAccepted] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState("");
  const labels = dataModeLabels(currentMode);
  const targetLabels = dataModeLabels(targetMode);
  const blocker = blockerReason({ emergencyStop, analysisInProgress, tradeInProgress, t });
  const phraseOk = typedPhrase === REQUIRED_PHRASE;
  const canApply = !blocker && warningAccepted && safetyAccepted && phraseOk && targetMode !== currentMode;
  const stepsComplete = [warningAccepted, safetyAccepted, phraseOk].filter(Boolean).length;

  const warning = useMemo(() => {
    if (targetMode === "REAL_DATA") {
      return t("dataMode.warningReal");
    }

    return t("dataMode.warningDemo");
  }, [targetMode, t]);

  const applyChange = () => {
    if (targetMode === currentMode) {
      onDataModeChange(targetMode, "BLOCKED", t("dataMode.sameModeBlocked"));
      return;
    }

    if (blocker) {
      onDataModeChange(targetMode, "BLOCKED", blocker);
      return;
    }

    if (!warningAccepted || !safetyAccepted || !phraseOk) {
      onDataModeChange(targetMode, "BLOCKED", t("dataMode.confirmationsIncomplete"));
      return;
    }

    onDataModeChange(targetMode, "APPLIED", `${targetMode}: ${t("dataMode.switched")}`);
    setWarningAccepted(false);
    setSafetyAccepted(false);
    setTypedPhrase("");
  };

  return (
    <section className="cockpit-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>{t("dataMode.title")}</h2>
          <p className="cockpit-muted">{t("dataMode.description")}</p>
        </div>
        <StatusPill tone={currentMode === "REAL_DATA" ? "critical" : "demo"}>{currentMode}</StatusPill>
      </div>

      <div className="data-mode-warning">
        <AlertTriangle size={17} />
        <span>{warning}</span>
      </div>

      <div className="overlay-chip-grid">
        {labels.map(label => (
          <span className={label === "NO REAL IMPACT" ? "overlay-chip is-safe" : "overlay-chip"} key={label}>{label}</span>
        ))}
      </div>

      <div className="data-mode-switch" aria-label="Data mode target">
        <button
          className={targetMode === "DEMO_DATA" ? "cockpit-control is-active" : "cockpit-control"}
          type="button"
          onClick={() => setTargetMode("DEMO_DATA")}
        >
          <Database size={15} />
          DEMO_DATA
        </button>
        <button
          className={targetMode === "REAL_DATA" ? "cockpit-control is-active" : "cockpit-control"}
          type="button"
          onClick={() => setTargetMode("REAL_DATA")}
        >
          <LockKeyhole size={15} />
          REAL_DATA
        </button>
      </div>

      <div className="cockpit-rule-row">
        <div className="cockpit-row">
          <strong>{t("dataMode.targetMode")}</strong>
          <StatusPill tone={targetMode === "REAL_DATA" ? "critical" : "demo"}>{targetMode}</StatusPill>
        </div>
        <div className="overlay-chip-grid">
          {targetLabels.map(label => (
            <span className="overlay-chip" key={label}>{label}</span>
          ))}
        </div>
      </div>

      <div className="data-mode-confirm-grid">
        <label className="data-mode-step">
          <input checked={warningAccepted} onChange={event => setWarningAccepted(event.target.checked)} type="checkbox" />
          <span>
            <strong>{t("dataMode.step1")}</strong>
            {t("dataMode.step1Desc")}
          </span>
        </label>
        <label className="data-mode-step">
          <input checked={safetyAccepted} onChange={event => setSafetyAccepted(event.target.checked)} type="checkbox" />
          <span>
            <strong>{t("dataMode.step2")}</strong>
            {t("dataMode.step2Desc")}
          </span>
        </label>
        <label className="data-mode-step">
          <span>
            <strong>{t("dataMode.step3")}</strong>
            {t("dataMode.step3Desc")}
          </span>
          <input
            className="data-mode-phrase"
            onChange={event => setTypedPhrase(event.target.value)}
            placeholder={REQUIRED_PHRASE}
            type="text"
            value={typedPhrase}
          />
        </label>
      </div>

      {blocker ? (
        <div className="data-mode-warning critical">
          <AlertTriangle size={17} />
          <span>{blocker}</span>
        </div>
      ) : null}

      <div className="cockpit-row">
        <span className="cockpit-muted">{t("dataMode.confirmations")} {stepsComplete}/3</span>
        <button className={canApply ? "cockpit-safe-button" : "cockpit-control"} onClick={applyChange} type="button">
          <ShieldCheck size={15} />
          {t("dataMode.apply")}
        </button>
      </div>

      <div className="cockpit-stack">
        {auditEntries.slice(0, 3).map(entry => (
          <div className="cockpit-rule-row" key={entry.id}>
            <div className="cockpit-row">
              <strong>{`${entry.from} -> ${entry.to}`}</strong>
              <StatusPill tone={entry.status === "APPLIED" ? "connected" : "critical"}>{entry.status}</StatusPill>
            </div>
            <span className="cockpit-muted">{entry.reason}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
