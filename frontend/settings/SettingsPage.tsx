import type { ActionDisplayMode, CockpitState, ConnectorLicenseSnapshot, ConnectorStatus, ConnectorUserScope, DataMode, LicenseStatusSnapshot } from "../app/cockpit.types";
import { StatusPill } from "../components/CockpitPrimitives";
import { TradingModeSelector } from "../components/TradingModeSelector";
import { ConnectorSettingsPanel } from "../connectors/ConnectorSettingsPanel";
import { LicenseSettingsPanel } from "./LicenseSettingsPanel";
import { PrivacySafetyPanel } from "./PrivacySafetyPanel";
import { ThemeLanguageSettingsPanel } from "./ThemeLanguageSettingsPanel";
import { useLanguage } from "@/i18n/useLanguage";

export function SettingsPage({
  connectors,
  license,
  licenseStatus,
  onRefreshConnectors,
  onRefreshLicense,
  state,
  user,
  onDataModeChange,
  actionDisplayMode,
  onActionDisplayModeChange,
  onTradingModeChange,
  onStrategyModeChange,
}: {
  connectors: readonly ConnectorStatus[];
  license?: ConnectorLicenseSnapshot;
  licenseStatus?: LicenseStatusSnapshot | null;
  onRefreshConnectors?: () => Promise<void> | void;
  onRefreshLicense?: () => Promise<void> | void;
  state: CockpitState;
  user?: ConnectorUserScope;
  onDataModeChange: (targetMode: DataMode, status: "APPLIED" | "BLOCKED", reason: string) => void;
  actionDisplayMode: ActionDisplayMode;
  onActionDisplayModeChange: (mode: ActionDisplayMode) => void;
  onTradingModeChange: Parameters<typeof TradingModeSelector>[0]["onTradingModeChange"];
  onStrategyModeChange: Parameters<typeof TradingModeSelector>[0]["onStrategyModeChange"];
}) {
  const { t } = useLanguage();
  const settings = [
    { label: "ENABLE_LIVE_TRADING", on: false },
    { label: "MODE_SIMULATION", on: true },
    { label: "ALLOW_AUTO_EXECUTION", on: false },
    { label: "DATA_MODE_VISIBLE", on: true },
    { label: "KALOS", on: state.kalosEnabled },
    { label: "Journal", on: true },
    { label: t("settings.emergencyStop"), on: state.emergencyStop },
  ];

  return (
    <div className="cockpit-grid two">
      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>{t("settings.title")}</h2>
          <StatusPill tone="live-off">{t("common.liveOff")}</StatusPill>
        </div>
        <div className="settings-grid">
          {settings.map(setting => (
            <div className="setting-row" key={setting.label}>
              <strong>{setting.label}</strong>
              <span className={`toggle-state ${setting.on ? "on" : ""}`}>{setting.on ? "ON" : "OFF"}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>{t("settings.modes")}</h2>
          <StatusPill tone={state.dataMode === "REAL_DATA" ? "critical" : "demo"}>{state.dataMode}</StatusPill>
        </div>
        <TradingModeSelector
          strategyMode={state.strategyMode}
          tradingMode={state.tradingMode}
          onStrategyModeChange={onStrategyModeChange}
          onTradingModeChange={onTradingModeChange}
        />
        <div className="setting-row action-display-setting">
          <strong>Deriv action display</strong>
          <div className="chart-control-group" role="radiogroup" aria-label="Deriv action display">
            <button
              aria-checked={actionDisplayMode === "standard"}
              className={`cockpit-control ${actionDisplayMode === "standard" ? "is-active" : ""}`}
              onClick={() => onActionDisplayModeChange("standard")}
              role="radio"
              type="button"
            >
              Standard: BUY/SELL
            </button>
            <button
              aria-checked={actionDisplayMode === "deriv"}
              className={`cockpit-control ${actionDisplayMode === "deriv" ? "is-active" : ""}`}
              onClick={() => onActionDisplayModeChange("deriv")}
              role="radio"
              type="button"
            >
              Deriv: UP/DOWN
            </button>
          </div>
        </div>
      </section>
      <div className="settings-connectors-span">
        <ThemeLanguageSettingsPanel />
      </div>
      <div className="settings-connectors-span">
        <LicenseSettingsPanel license={licenseStatus ?? null} onRefresh={onRefreshLicense} />
      </div>
      <div className="settings-connectors-span">
        <ConnectorSettingsPanel connectors={connectors} license={license} onRefresh={onRefreshConnectors} user={user} />
      </div>
      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>{t("settings.safetyFlags")}</h2>
          <StatusPill tone="connected">{t("settings.locked")}</StatusPill>
        </div>
        <div className="cockpit-stack">
          <div className="setting-row">
            <strong>{t("settings.martingale")}</strong>
            <span className="toggle-state">{t("common.block")}</span>
          </div>
          <div className="setting-row">
            <strong>{t("settings.orderWithoutSl")}</strong>
            <span className="toggle-state">{t("common.block")}</span>
          </div>
          <div className="setting-row">
            <strong>{t("settings.orderWithoutTp")}</strong>
            <span className="toggle-state">{t("common.block")}</span>
          </div>
        </div>
      </section>
      <PrivacySafetyPanel state={state} onDataModeChange={onDataModeChange} />
    </div>
  );
}
