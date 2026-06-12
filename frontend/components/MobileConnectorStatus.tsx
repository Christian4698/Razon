import type { ConnectorStatus } from "../app/cockpit.types";
import { StatusPill } from "./CockpitPrimitives";

function connectorSourceLabel(connector: ConnectorStatus) {
  if (connector.id === "deriv-demo" && connector.runtimeMode === "DEMO" && connector.state === "connected") {
    return "DERIV DEMO";
  }

  return connector.source === "MOCK" ? "SIM ARCHIVE" : connector.source;
}

export function MobileConnectorStatus({ connectors }: { connectors: readonly ConnectorStatus[] }) {
  return (
    <details className="mobile-panel" open>
      <summary>Connectors</summary>
      <div className="mobile-panel-body">
        {connectors.map(connector => (
          <div className="mobile-connector-row" key={connector.id}>
            <div>
              <strong>{connector.name}</strong>
              <p>{connector.message}</p>
            </div>
            <div>
              <StatusPill tone={connector.state}>{connectorSourceLabel(connector)}</StatusPill>
              <span>{connector.latencyMs === null ? "No latency" : `${connector.latencyMs} ms`}</span>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
