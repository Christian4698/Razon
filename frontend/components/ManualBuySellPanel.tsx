import { CircleDollarSign, OctagonX, TrendingDown, TrendingUp, X } from "lucide-react";
import { confirmDanger } from "./CockpitPrimitives";

export function ManualBuySellPanel({
  disabled,
  onAction,
}: {
  disabled: boolean;
  onAction: (action: string) => void;
}) {
  const run = (label: string) => {
    confirmDanger(label, () => onAction(`${label} confirme en simulation`));
  };

  return (
    <section className="cockpit-panel">
      <div className="cockpit-panel-header">
        <h2>Manual Buy/Sell Panel</h2>
        <span className="cockpit-pill mock">NO REAL ORDER</span>
      </div>
      <div className="manual-grid">
        <button className="cockpit-safe-button" disabled={disabled} onClick={() => run("BUY MANUEL")} type="button">
          <TrendingUp size={16} />
          BUY MANUEL
        </button>
        <button className="cockpit-danger" disabled={disabled} onClick={() => run("SELL MANUEL")} type="button">
          <TrendingDown size={16} />
          SELL MANUEL
        </button>
        <button className="cockpit-control" disabled={disabled} onClick={() => run("CLOSE")} type="button">
          <X size={16} />
          CLOSE
        </button>
        <button className="cockpit-danger" onClick={() => run("STOP BOT")} type="button">
          <OctagonX size={16} />
          STOP BOT
        </button>
        <button className="cockpit-control" disabled type="button">
          <CircleDollarSign size={16} />
          LIVE OFF
        </button>
      </div>
    </section>
  );
}
