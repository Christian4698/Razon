import { FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import type { CockpitState, DataMode } from "../app/cockpit.types";
import { StatusPill } from "../components/CockpitPrimitives";
import { DataModeControl } from "./DataModeControl";
import { useLanguage } from "@/i18n/useLanguage";

export function PrivacySafetyPanel({
  state,
  onDataModeChange,
}: {
  state: CockpitState;
  onDataModeChange: (targetMode: DataMode, status: "APPLIED" | "BLOCKED", reason: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <>
      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <div>
            <h2>{t("privacy.title")}</h2>
            <p className="cockpit-muted">{t("privacy.description")}</p>
          </div>
          <StatusPill tone={state.emergencyStop ? "critical" : "connected"}>
            {state.emergencyStop ? t("privacy.stopPriority") : t("privacy.locked")}
          </StatusPill>
        </div>

        <div className="cockpit-stack">
          <div className="privacy-safety-row">
            <ShieldAlert size={18} />
            <span>
              <strong>{t("privacy.dashboardReadOnly")}</strong>
              {t("privacy.dashboardReadOnlyDesc")}
            </span>
          </div>
          <div className="privacy-safety-row">
            <ShieldCheck size={18} />
            <span>
              <strong>{t("privacy.executionSeparated")}</strong>
              {t("privacy.executionSeparatedDesc")}
            </span>
          </div>
          <div className="privacy-safety-row">
            <FileText size={18} />
            <span>
              <strong>{t("privacy.auditRequired")}</strong>
              {t("privacy.auditRequiredDesc")}
            </span>
          </div>
        </div>
      </section>

      <DataModeControl
        analysisInProgress={state.analysisInProgress}
        auditEntries={state.dataModeAudit}
        currentMode={state.dataMode}
        emergencyStop={state.emergencyStop}
        tradeInProgress={state.tradeInProgress}
        onDataModeChange={onDataModeChange}
      />
    </>
  );
}
