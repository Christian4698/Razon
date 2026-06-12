import { Bot, Hand, PauseCircle, Settings2, Zap } from "lucide-react";
import type { ReactElement } from "react";
import type { StrategyMode, TradingMode } from "../app/cockpit.types";
import { useLanguage } from "@/i18n/useLanguage";

const tradingButtons: Array<{ value: TradingMode; labelKey: string; dangerous?: boolean; icon: ReactElement }> = [
  { value: "ANALYSE_SEULEMENT", labelKey: "trading.analysisOnly", icon: <PauseCircle size={15} /> },
  { value: "MANUEL", labelKey: "trading.manual", icon: <Hand size={15} /> },
  { value: "SEMI_AUTO", labelKey: "trading.semiAuto", dangerous: true, icon: <Settings2 size={15} /> },
  { value: "AUTO", labelKey: "trading.auto", dangerous: true, icon: <Bot size={15} /> },
];

const strategyButtons: Array<{ value: StrategyMode; labelKey: string }> = [
  { value: "SCALPING", labelKey: "trading.scalping" },
  { value: "SHORT_TERM", labelKey: "trading.shortTerm" },
  { value: "LONG_TERM", labelKey: "trading.longTerm" },
];

export function TradingModeSelector({
  tradingMode,
  strategyMode,
  onTradingModeChange,
  onStrategyModeChange,
}: {
  tradingMode: TradingMode;
  strategyMode: StrategyMode;
  onTradingModeChange: (mode: TradingMode, dangerous: boolean) => void;
  onStrategyModeChange: (mode: StrategyMode) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="cockpit-stack">
      <div>
        <div className="cockpit-label" style={{ marginBottom: 8 }}>{t("trading.mode")}</div>
        <div className="cockpit-controls">
          {tradingButtons.map(button => (
            <button
              className={`cockpit-control ${tradingMode === button.value ? "is-active" : ""}`}
              key={button.value}
              onClick={() => onTradingModeChange(button.value, Boolean(button.dangerous))}
              type="button"
            >
              {button.icon}
              {t(button.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="cockpit-label" style={{ marginBottom: 8 }}>{t("trading.horizon")}</div>
        <div className="cockpit-controls">
          {strategyButtons.map(button => (
            <button
              className={`cockpit-control ${strategyMode === button.value ? "is-active" : ""}`}
              key={button.value}
              onClick={() => onStrategyModeChange(button.value)}
              type="button"
            >
              <Zap size={15} />
              {t(button.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
