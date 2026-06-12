import { Cable, CircleOff, RadioTower } from "lucide-react";
import type { ConnectorStatus } from "../app/cockpit.types";
import { Panel, StatusPill } from "./CockpitPrimitives";

const stateIcon = {
  connected: <RadioTower size={18} color="#63e6a6" />,
  delayed: <Cable size={18} color="#f4c86a" />,
  disconnected: <CircleOff size={18} color="#ff8a8a" />,
};

function connectorSourceLabel(connector: ConnectorStatus) {
  if (connector.id === "deriv-demo" && connector.runtimeMode === "DEMO" && connector.state === "connected") {
    return "DERIV DEMO";
  }

  return connector.source === "MOCK" ? "SIM ARCHIVE" : connector.source;
}

export function ConnectionStatusCard({ connector }: { connector: ConnectorStatus }) {
  return (
    <Panel
      title={connector.name}
      action={<StatusPill tone={connector.runtimeMode}>{connector.runtimeMode}</StatusPill>}
    >
      <div className="cockpit-connector-row">
        <div>
          <div className="cockpit-row" style={{ justifyContent: "flex-start" }}>
            {stateIcon[connector.state]}
            <strong>{connector.safetyStatus}</strong>
          </div>
          <p className="cockpit-muted">{connector.message}</p>
        </div>
        <div className="cockpit-stack" style={{ justifyItems: "end", gap: 6 }}>
          <StatusPill tone={connector.state}>{connectorSourceLabel(connector)}</StatusPill>
          <StatusPill tone="live-off">{connector.executionStatus}</StatusPill>
          <span className="cockpit-muted">
            {connector.latencyMs === null ? "No latency" : `${connector.latencyMs} ms`}
          </span>
        </div>
      </div>
    </Panel>
  );
}
