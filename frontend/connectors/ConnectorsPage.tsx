import type { ConnectorLicenseSnapshot, ConnectorStatus, ConnectorUserScope } from "../app/cockpit.types";
import { StatusPill } from "../components/CockpitPrimitives";
import { ConnectorSettingsPanel } from "./ConnectorSettingsPanel";
import { useLanguage } from "@/i18n/useLanguage";

export function ConnectorsPage({
  connectors,
  license,
  onRefreshConnectors,
  user,
}: {
  connectors: readonly ConnectorStatus[];
  license?: ConnectorLicenseSnapshot;
  onRefreshConnectors?: () => Promise<void> | void;
  user?: ConnectorUserScope;
}) {
  const { t } = useLanguage();

  return (
    <div className="cockpit-stack">
      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <div>
            <h2>{t("connectors.title")}</h2>
            <p className="cockpit-muted">{t("connectors.description")}</p>
          </div>
          <StatusPill tone="live-off">{t("common.liveOff")} / {t("common.readOnly")}</StatusPill>
        </div>
        <div className="cockpit-kpi-row">
          <div className="cockpit-kpi">
            <span className="cockpit-label">{t("connectors.connected")}</span>
            <div className="cockpit-value">{connectors.filter(item => item.state === "connected").length}</div>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">{t("connectors.disconnected")}</span>
            <div className="cockpit-value">{connectors.filter(item => item.state === "disconnected").length}</div>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">{t("connectors.secretsSaved")}</span>
            <div className="cockpit-value">{connectors.filter(item => item.secretSaved).length}</div>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">{t("connectors.liveBlocked")}</span>
            <div className="cockpit-value">{connectors.filter(item => item.executionStatus === "LIVE_BLOCKED").length}</div>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">{t("common.license")}</span>
            <div className="cockpit-value">{license?.status ?? "ACTIVE"}</div>
          </div>
        </div>
      </section>
      <ConnectorSettingsPanel connectors={connectors} license={license} onRefresh={onRefreshConnectors} user={user} />
    </div>
  );
}
