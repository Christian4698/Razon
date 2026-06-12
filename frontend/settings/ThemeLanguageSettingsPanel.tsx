import { Languages, MonitorCog, Palette } from "lucide-react";
import { availableThemeModes, type ThemeMode, useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/i18n/useLanguage";
import type { LanguageCode } from "@/i18n/translations";
import { StatusPill } from "../components/CockpitPrimitives";

function themeLabel(mode: ThemeMode, t: (key: string) => string) {
  if (mode === "AUTO_SYSTEM") return t("theme.autoSystem");
  if (mode === "LIGHT") return t("theme.light");
  if (mode === "DARK") return t("theme.dark");
  return t("theme.obscure");
}

export function ThemeLanguageSettingsPanel() {
  const { language, languages, setLanguage, t } = useLanguage();
  const { mode, resolvedTheme, setThemeMode } = useTheme();

  return (
    <section className="cockpit-panel theme-language-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>{t("theme.title")}</h2>
          <p className="cockpit-muted">{t("theme.description")}</p>
        </div>
        <StatusPill tone="connected">{t("theme.storage")}</StatusPill>
      </div>

      <div className="theme-language-grid">
        <label className="theme-setting-field">
          <span>
            <Languages size={15} aria-hidden="true" />
            {t("theme.language")}
          </span>
          <select
            aria-label={t("theme.language")}
            onChange={event => setLanguage(event.target.value as LanguageCode)}
            value={language}
          >
            {languages.map(item => (
              <option key={item.code} value={item.code}>
                {item.nativeName}
              </option>
            ))}
          </select>
          <small>{t("theme.languageHint")}</small>
        </label>

        <label className="theme-setting-field">
          <span>
            <Palette size={15} aria-hidden="true" />
            {t("theme.theme")}
          </span>
          <select
            aria-label={t("theme.theme")}
            onChange={event => setThemeMode(event.target.value as ThemeMode)}
            value={mode}
          >
            {availableThemeModes.map(item => (
              <option key={item} value={item}>
                {themeLabel(item, t)}
              </option>
            ))}
          </select>
          <small>{t("theme.themeHint")}</small>
        </label>

        <div className="theme-setting-field is-readonly">
          <span>
            <MonitorCog size={15} aria-hidden="true" />
            {t("theme.resolved")}
          </span>
          <strong>{themeLabel(resolvedTheme, t)}</strong>
          <small>{mode === "AUTO_SYSTEM" ? t("theme.autoSystem") : mode}</small>
        </div>
      </div>

      <div className="dashboard-safety-row">
        <StatusPill tone="live-off">{t("common.liveOff")}</StatusPill>
        <StatusPill tone="live-off">{t("common.autoExecutionOff")}</StatusPill>
        <StatusPill tone="connected">{t("warnings.noSecret")}</StatusPill>
      </div>
    </section>
  );
}
