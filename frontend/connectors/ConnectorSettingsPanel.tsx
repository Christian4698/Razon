import { KeyRound, PlugZap, RefreshCw, RotateCcw, Save, Trash2, Unplug } from "lucide-react";
import { useState } from "react";
import type { ConnectorLicenseSnapshot, ConnectorStatus, ConnectorUserScope } from "../app/cockpit.types";
import { StatusPill } from "../components/CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";
import { API_BASE_URL } from "@/lib/api";

type ConnectorSecretDrafts = Record<string, string>;
type ConnectorNotices = Record<string, string>;
type ConnectorAction = "test" | "save-secret" | "delete-secret" | "reconnect" | "disconnect";

const actionLabels: Record<ConnectorAction, string> = {
  test: "Test connection",
  "save-secret": "Save secret",
  "delete-secret": "Delete secret",
  reconnect: "Reconnect",
  disconnect: "Disconnect",
};

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "n/a";
  return String(value);
}

function displayDate(value: string | null | undefined) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function connectorSourceLabel(connector: ConnectorStatus) {
  if (connector.id === "deriv-demo" && connector.runtimeMode === "DEMO" && connector.state === "connected") return "DERIV DEMO";
  if (connector.runtimeMode === "REAL_DATA") return "REAL_DATA";
  return connector.source === "MOCK" ? "MOCK_DATA" : connector.source;
}

function defaultUser(): ConnectorUserScope {
  return {
    scope: "CURRENT_USER",
    userId: "demo-current-user",
    displayName: "Current user",
  };
}

function defaultLicense(): ConnectorLicenseSnapshot {
  return {
    status: "ACTIVE",
    plan: "DEMO_SANDBOX",
    expiryDate: null,
    deviceLimit: null,
    activeDevices: null,
    sessionLimit: null,
    activeSessions: null,
    engineStatus: "PENDING",
    message: "License Engine pending",
  };
}

export function ConnectorSettingsPanel({
  connectors,
  license,
  onRefresh,
  user,
}: {
  readonly connectors: readonly ConnectorStatus[];
  readonly license?: ConnectorLicenseSnapshot;
  readonly onRefresh?: () => Promise<void> | void;
  readonly user?: ConnectorUserScope;
}) {
  const { t } = useLanguage();
  const [draftSecrets, setDraftSecrets] = useState<ConnectorSecretDrafts>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notices, setNotices] = useState<ConnectorNotices>({});
  const activeUser = user ?? defaultUser();
  const activeLicense = license ?? defaultLicense();

  const runAction = async (connector: ConnectorStatus, action: ConnectorAction) => {
    const actionKey = `${connector.id}:${action}`;
    const draft = draftSecrets[connector.id] ?? "";

    if (action === "save-secret" && draft.trim().length < 6) {
      setNotices(current => ({ ...current, [connector.id]: "Enter a new backend-only token before saving." }));
      return;
    }

    setBusyAction(actionKey);
    setNotices(current => ({ ...current, [connector.id]: `${actionLabels[action]} pending...` }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/connectors/${encodeURIComponent(connector.id)}/${action}`, {
        body: action === "save-secret" ? JSON.stringify({ secret: draft }) : undefined,
        credentials: "include",
        headers: action === "save-secret"
          ? { "Content-Type": "application/json", Accept: "application/json" }
          : { Accept: "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload.message === "string" ? payload.message : `Request failed (${response.status})`;
        throw new Error(message);
      }

      setDraftSecrets(current => ({ ...current, [connector.id]: "" }));
      setNotices(current => ({ ...current, [connector.id]: `${actionLabels[action]} completed. Secret value was not returned.` }));
      await onRefresh?.();
    } catch {
      setNotices(current => ({ ...current, [connector.id]: `${actionLabels[action]} failed safely. No execution route was used.` }));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="connector-settings">
      <section className="cockpit-panel connector-account-panel">
        <div className="cockpit-panel-header">
          <div>
            <h2>{t("connectors.settings")}</h2>
            <p className="cockpit-muted">{t("connectors.settingsDescription")}</p>
          </div>
          <StatusPill tone="live-off">{t("connectors.executionOff")}</StatusPill>
        </div>
        <div className="connector-account-grid">
          <span>
            <b>{t("connectors.currentUser")}</b>
            <strong>{activeUser.displayName}</strong>
            <small>{activeUser.scope} | {activeUser.userId}</small>
          </span>
          <span>
            <b>{t("connectors.licensePlan")}</b>
            <strong>{activeLicense.plan}</strong>
            <small>{activeLicense.message}</small>
          </span>
          <span>
            <b>{t("connectors.licenseStatus")}</b>
            <strong>{activeLicense.status}</strong>
            <small>Expiry {displayValue(activeLicense.expiryDate)}</small>
          </span>
          <span>
            <b>{t("connectors.devices")}</b>
            <strong>{displayValue(activeLicense.activeDevices)} / {displayValue(activeLicense.deviceLimit)}</strong>
            <small>Engine {activeLicense.engineStatus}</small>
          </span>
          <span>
            <b>{t("connectors.sessions")}</b>
            <strong>{displayValue(activeLicense.activeSessions)} / {displayValue(activeLicense.sessionLimit)}</strong>
            <small>Current-user scoped</small>
          </span>
        </div>
      </section>

      <div className="connector-settings-grid">
        {connectors.map(connector => {
          const draft = draftSecrets[connector.id] ?? "";
          const busy = (action: ConnectorAction) => busyAction === `${connector.id}:${action}`;

          return (
            <section className="connector-settings-card" key={connector.id}>
              <div className="connector-settings-head">
                <div>
                  <h3>{connector.name}</h3>
                  <p>{connector.provider ?? "Provider"} | {connector.accountKind ?? connector.accessMode} | {connector.ownerScope ?? "CURRENT_USER"}</p>
                </div>
                <div className="connector-settings-pills">
                  <StatusPill tone={connector.connectorStatus ?? connector.state}>{connector.connectorStatus ?? connector.state.toUpperCase()}</StatusPill>
                  <StatusPill tone={connector.runtimeMode}>{connector.runtimeMode}</StatusPill>
                </div>
              </div>

              <div className="connector-warning-strip">
                {(connector.warnings?.length ? connector.warnings : ["LIVE BLOCKED"]).map(warning => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>

              <div className="connector-metric-grid">
                <span>
                  <b>{t("connectors.ownerScope")}</b>
                  <strong>{connector.ownerScope ?? "CURRENT_USER"}</strong>
                </span>
                <span>
                  <b>{t("common.license")}</b>
                  <strong>{connector.licenseStatus ?? activeLicense.status}</strong>
                </span>
                <span>
                  <b>{t("common.dataQuality")}</b>
                  <strong>{connector.dataQuality ?? "DISCONNECTED"}</strong>
                </span>
                <span>
                  <b>{t("common.source")}</b>
                  <strong>{connectorSourceLabel(connector)}</strong>
                </span>
                <span>
                  <b>{t("common.latency")}</b>
                  <strong>{connector.latencyMs === null ? "n/a" : `${connector.latencyMs} ms`}</strong>
                </span>
                <span>
                  <b>{t("common.freshness")}</b>
                  <strong>{connector.freshnessSeconds === null || connector.freshnessSeconds === undefined ? "n/a" : `${connector.freshnessSeconds}s`}</strong>
                </span>
                <span>
                  <b>{t("common.lastTick")}</b>
                  <strong>{displayDate(connector.lastTickAt)}</strong>
                </span>
                <span>
                  <b>{t("common.lastCandle")}</b>
                  <strong>{displayDate(connector.lastCandleAt)}</strong>
                </span>
                <span>
                  <b>{t("common.readOnly")}</b>
                  <strong>{connector.readOnlyStatus ?? "READ_ONLY"}</strong>
                </span>
                <span>
                  <b>LIVE</b>
                  <strong>LIVE BLOCKED</strong>
                </span>
                <span>
                  <b>{t("connectors.devices")}</b>
                  <strong>{displayValue(connector.allowedDevicesCount)}</strong>
                </span>
                <span>
                  <b>{t("connectors.sessions")}</b>
                  <strong>{displayValue(connector.activeSessionsCount)}</strong>
                </span>
              </div>

              <div className="secret-settings">
                <div className="secret-settings-title">
                  <span>
                    <KeyRound size={14} aria-hidden="true" />
                    {t("connectors.secretSettings")}
                  </span>
                  <StatusPill tone={connector.secretStatus ?? "MISSING"}>{connector.secretStatus ?? "MISSING"}</StatusPill>
                </div>
                <div className="connector-secret-state">
                  <span>{t("connectors.secretSaved")}: <b>{connector.secretSaved ? "true" : "false"}</b></span>
                  <span>{t("connectors.lastUpdated")}: <b>{displayDate(connector.secretLastUpdatedAt)}</b></span>
                  <span>{t("connectors.preview")}: <b>{connector.secretMaskedPreview ?? "not returned"}</b></span>
                </div>
                <label className="connector-secret-input">
                  <span>{t("connectors.enterNewToken")}</span>
                  <input
                    autoComplete="new-password"
                    onChange={event => setDraftSecrets(current => ({ ...current, [connector.id]: event.target.value }))}
                    placeholder={t("connectors.enterNewToken")}
                    type="password"
                    value={draft}
                  />
                </label>
                <div className="connector-action-row">
                  <button disabled={busy("save-secret")} onClick={() => runAction(connector, "save-secret")} type="button">
                    <Save size={14} aria-hidden="true" />
                    {t("connectors.saveSecret")}
                  </button>
                  <button disabled={busy("save-secret")} onClick={() => runAction(connector, "save-secret")} type="button">
                    <RotateCcw size={14} aria-hidden="true" />
                    {t("connectors.rotateSecret")}
                  </button>
                  <button disabled={busy("delete-secret")} onClick={() => runAction(connector, "delete-secret")} type="button">
                    <Trash2 size={14} aria-hidden="true" />
                    {t("connectors.deleteSecret")}
                  </button>
                  <button disabled={busy("test")} onClick={() => runAction(connector, "test")} type="button">
                    <RefreshCw size={14} aria-hidden="true" />
                    {t("connectors.testConnection")}
                  </button>
                  <button disabled={busy("reconnect")} onClick={() => runAction(connector, "reconnect")} type="button">
                    <PlugZap size={14} aria-hidden="true" />
                    {t("connectors.reconnect")}
                  </button>
                  <button disabled={busy("disconnect")} onClick={() => runAction(connector, "disconnect")} type="button">
                    <Unplug size={14} aria-hidden="true" />
                    {t("connectors.disconnect")}
                  </button>
                </div>
                {notices[connector.id] ? <p className="connector-action-notice">{notices[connector.id]}</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
