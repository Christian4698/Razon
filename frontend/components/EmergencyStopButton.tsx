import { Siren } from "lucide-react";
import { confirmDanger } from "./CockpitPrimitives";

export function EmergencyStopButton({
  active,
  onEmergencyStop,
}: {
  active: boolean;
  onEmergencyStop: () => void;
}) {
  return (
    <button
      className="cockpit-danger cockpit-emergency"
      onClick={() => confirmDanger("EMERGENCY STOP", onEmergencyStop)}
      type="button"
    >
      <Siren size={17} />
      {active ? "EMERGENCY ACTIVE" : "EMERGENCY STOP"}
    </button>
  );
}
