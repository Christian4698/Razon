import type { FuturePath, FuturePathEngine, FuturePathEngineState } from "../app/cockpit.types";
import { formatPrice, StatusPill } from "../components/CockpitPrimitives";

function stateLabel(state: FuturePathEngineState) {
  return state === "DATA_LOW" ? "DATA LOW" : state;
}

function stateTone(state: FuturePathEngineState) {
  if (state === "READY") return "connected" as const;
  if (state === "WAIT" || state === "INCERTAIN") return "delayed" as const;
  return "critical" as const;
}

function pathClass(path: FuturePath) {
  return `future-path-line ${path.color.toLowerCase()}`;
}

export function KalosFuturePathPanel({ futurePath }: { futurePath: FuturePathEngine }) {
  return (
    <section className="cockpit-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>KALOS Visual Timeline</h2>
          <p className="cockpit-muted">{futurePath.summary}</p>
        </div>
        <StatusPill tone={stateTone(futurePath.state)}>{stateLabel(futurePath.state)}</StatusPill>
      </div>

      <div className="future-path-stack" aria-label="future-path-engine visual paths">
        {futurePath.paths.map(path => (
          <div className="future-path-row" key={path.id}>
            <div className="future-path-head">
              <strong>{path.label}</strong>
              <span className="cockpit-muted">{path.probability}%</span>
            </div>
            <div className="future-path-track" aria-hidden="true">
              <span className={pathClass(path)} style={{ width: `${path.probability}%` }} />
              <span className="future-path-node" />
            </div>
            <div className="future-path-meta">
              <span>
                <b>Temps</b>
                {path.estimatedTime}
              </span>
              <span>
                <b>Objectif</b>
                {path.target === null ? path.objective : formatPrice(path.target)}
              </span>
              <span>
                <b>Invalidation</b>
                {path.invalidation === null ? "n/a" : formatPrice(path.invalidation)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
