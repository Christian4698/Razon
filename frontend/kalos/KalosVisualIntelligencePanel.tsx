import type { KalosSignal } from "../app/cockpit.types";
import { formatPrice, StatusPill } from "../components/CockpitPrimitives";
import {
  kalosMarketStructureFeatures,
  kalosModes,
  kalosOutputFields,
  kalosSafetyRules,
  kalosSmartMoneyFeatures,
} from "./kalos-visual-intelligence.mock";

export function KalosVisualIntelligencePanel({ signal }: { signal: KalosSignal }) {
  const acceptedOverlays = signal.overlayObjects.filter(item => item.status === "ACCEPTED").length;
  const rejectedOverlays = signal.overlayObjects.filter(item => item.status === "REJECTED").length;

  return (
    <section className="cockpit-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>KALOS Visual Market Intelligence</h2>
          <p className="cockpit-muted">Structure, smart money, overlays et sortie lecture seule sans execution.</p>
        </div>
        <StatusPill tone="live-off">LIVE OFF</StatusPill>
      </div>

      <div className="cockpit-grid two">
        <div className="cockpit-stack">
          <div>
            <div className="cockpit-label">Structure marche</div>
            <div className="overlay-chip-grid">
              {kalosMarketStructureFeatures.map(feature => (
                <span className="overlay-chip" key={feature}>{feature}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="cockpit-label">Smart Money</div>
            <div className="overlay-chip-grid">
              {kalosSmartMoneyFeatures.map(feature => (
                <span className="overlay-chip" key={feature}>{feature}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="cockpit-label">Modes prevus</div>
            <div className="overlay-chip-grid">
              {kalosModes.map(mode => (
                <span className={mode === "AUTO" ? "overlay-chip is-risky" : "overlay-chip"} key={mode}>{mode}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="cockpit-stack">
          <div className="cockpit-kpi-row">
            <div className="cockpit-kpi">
              <span className="cockpit-label">Trend</span>
              <div className="cockpit-value" style={{ fontSize: 19 }}>{signal.trend}</div>
            </div>
            <div className="cockpit-kpi">
              <span className="cockpit-label">Accepted overlays</span>
              <div className="cockpit-value cockpit-positive">{acceptedOverlays}</div>
            </div>
            <div className="cockpit-kpi">
              <span className="cockpit-label">Rejected overlays</span>
              <div className="cockpit-value cockpit-negative">{rejectedOverlays}</div>
            </div>
          </div>

          <div>
            <div className="cockpit-label">Sortie KALOS</div>
            <div className="overlay-chip-grid">
              {kalosOutputFields.map(field => (
                <span className="overlay-chip" key={field}>{field}</span>
              ))}
            </div>
          </div>

          <div className="cockpit-stack">
            {signal.overlayObjects.slice(0, 5).map(item => (
              <div className="cockpit-rule-row" key={item.id}>
                <div className="cockpit-row">
                  <strong>{item.label}</strong>
                  <span className="cockpit-muted">
                    {item.price === undefined ? item.type : `${item.type} ${formatPrice(item.price)}`}
                  </span>
                  <StatusPill tone={item.status === "REJECTED" ? "critical" : "connected"}>{item.status}</StatusPill>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="cockpit-label">Regles</div>
            <div className="overlay-chip-grid">
              {kalosSafetyRules.map(rule => (
                <span className="overlay-chip is-risky" key={rule}>{rule}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
