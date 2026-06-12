import { Bot, Hand, OctagonX, PauseCircle, Settings2, TrendingDown, TrendingUp } from "lucide-react";
import type { StrategyMode, TradingMode } from "../app/cockpit.types";
import { confirmDanger } from "./CockpitPrimitives";

export function MobileTradingPanel({
  tradingMode,
  strategyMode,
  emergencyStop,
  onTradingModeChange,
  onStrategyModeChange,
  onAction,
}: {
  tradingMode: TradingMode;
  strategyMode: StrategyMode;
  emergencyStop: boolean;
  onTradingModeChange: (mode: TradingMode, dangerous: boolean) => void;
  onStrategyModeChange: (mode: StrategyMode) => void;
  onAction: (action: string) => void;
}) {
  const manualAction = (label: string) => {
    confirmDanger(label, () => onAction(`${label} confirme en simulation mobile`));
  };

  return (
    <details className="mobile-panel" open>
      <summary>Trading mobile</summary>
      <div className="mobile-panel-body">
        <div className="mobile-control-grid">
          <button className={tradingMode === "ANALYSE_SEULEMENT" ? "is-active" : ""} onClick={() => onTradingModeChange("ANALYSE_SEULEMENT", false)} type="button">
            <PauseCircle size={16} />
            ANALYSE SEULEMENT
          </button>
          <button className={tradingMode === "MANUEL" ? "is-active" : ""} onClick={() => onTradingModeChange("MANUEL", false)} type="button">
            <Hand size={16} />
            MANUEL
          </button>
          <button className={tradingMode === "SEMI_AUTO" ? "is-active" : ""} onClick={() => onTradingModeChange("SEMI_AUTO", true)} type="button">
            <Settings2 size={16} />
            SEMI-AUTO
          </button>
          <button className={tradingMode === "AUTO" ? "is-active danger" : "danger"} onClick={() => onTradingModeChange("AUTO", true)} type="button">
            <Bot size={16} />
            AUTO
          </button>
        </div>

        <div className="mobile-control-grid horizon">
          {[
            ["SCALPING", "SCALPING"],
            ["SHORT_TERM", "COURT TERME"],
            ["LONG_TERM", "LONG TERME"],
          ].map(([value, label]) => (
            <button
              className={strategyMode === value ? "is-active" : ""}
              key={value}
              onClick={() => onStrategyModeChange(value as StrategyMode)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mobile-action-row">
          <button className="buy" disabled={emergencyStop} onClick={() => manualAction("BUY MANUEL")} type="button">
            <TrendingUp size={17} />
            BUY MANUEL
          </button>
          <button className="sell" disabled={emergencyStop} onClick={() => manualAction("SELL MANUEL")} type="button">
            <TrendingDown size={17} />
            SELL MANUEL
          </button>
          <button className="danger" onClick={() => manualAction("STOP BOT")} type="button">
            <OctagonX size={17} />
            STOP BOT
          </button>
        </div>
      </div>
    </details>
  );
}
