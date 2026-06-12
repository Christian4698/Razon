import type { AlertItem } from "../app/cockpit.types";
import { Panel, StatusPill } from "./CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";

export function AlertPanel({ alerts }: { alerts: readonly AlertItem[] }) {
  const { t } = useLanguage();

  return (
    <Panel title={t("alerts.engine")}>
      <div className="cockpit-stack">
        {alerts.map(alert => (
          <div className="cockpit-alert-row" key={alert.id}>
            <div className="cockpit-row">
              <strong>{alert.title}</strong>
              <StatusPill tone={alert.severity === "CRITICAL" ? "critical" : alert.severity === "WARNING" ? "delayed" : "connected"}>
                {alert.severity}
              </StatusPill>
            </div>
            <p className="cockpit-muted">{alert.detail}</p>
            <span className="cockpit-muted">{alert.time}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
