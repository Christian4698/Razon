import type { KalosMarketBrain, KalosMarketBrainScenario } from "../app/cockpit.types";
import { formatPrice, StatusPill } from "../components/CockpitPrimitives";

function scenarioTone(scenario: KalosMarketBrainScenario) {
  if (scenario === "CONTINUE") return "connected" as const;
  if (scenario === "REVERSE" || scenario === "WAIT") return "delayed" as const;
  return "critical" as const;
}

export function KalosMarketBrainPanel({ brain }: { brain: KalosMarketBrain }) {
  return (
    <section className="cockpit-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>KALOS THINKING…</h2>
          <p className="cockpit-muted">Interpretation contextuelle, lecture seule et analyse-only.</p>
        </div>
        <StatusPill tone="live-off">LIVE OFF</StatusPill>
      </div>

      <div className="cockpit-kpi-row">
        <div className="cockpit-kpi">
          <span className="cockpit-label">Structure</span>
          <div className="cockpit-value" style={{ fontSize: 19 }}>{brain.structure}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Confiance</span>
          <div className="cockpit-value">{brain.confidence}%</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Scénario</span>
          <div className="cockpit-value" style={{ fontSize: 19 }}>{brain.scenario}</div>
        </div>
      </div>

      <div className="cockpit-rule-row">
        <div className="cockpit-row">
          <strong>Raison</strong>
          <StatusPill tone={scenarioTone(brain.scenario)}>{brain.signal}</StatusPill>
        </div>
        <span className="cockpit-muted">{brain.explanation}</span>
      </div>

      <div className="cockpit-grid two">
        <div className="cockpit-stack">
          <div className="cockpit-label">Chemin attendu</div>
          {brain.expectedPath.map(item => (
            <div className="cockpit-rule-row" key={`${item.step}-${item.probability}`}>
              <div className="cockpit-row">
                <strong>{item.step}</strong>
                <span className="cockpit-muted">{item.probability}%</span>
              </div>
              <span className="cockpit-muted">
                {item.hypothesis}
                {item.price === undefined ? "" : ` @ ${formatPrice(item.price)}`}
              </span>
            </div>
          ))}
        </div>
        <div className="cockpit-stack">
          <div className="cockpit-kpi-row">
            <div className="cockpit-kpi">
              <span className="cockpit-label">Timing</span>
              <div className="cockpit-value">{brain.timingScore}</div>
            </div>
            <div className="cockpit-kpi">
              <span className="cockpit-label">Risk</span>
              <div className="cockpit-value">{brain.riskScore}</div>
            </div>
          </div>
          <div className="cockpit-rule-row">
            <div className="cockpit-row">
              <strong>Invalidation</strong>
              <StatusPill tone="live-off">NO EXECUTION</StatusPill>
            </div>
            <span className="cockpit-muted">
              {brain.invalidation === null ? "Aucune zone valide en lecture seule." : formatPrice(brain.invalidation)}
            </span>
          </div>
          {brain.rejectedReasons.map(reason => (
            <div className="cockpit-rule-row" key={reason}>
              <div className="cockpit-row">
                <strong>Blocage</strong>
                <StatusPill tone="critical">BLOCK</StatusPill>
              </div>
              <span className="cockpit-muted">{reason}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
