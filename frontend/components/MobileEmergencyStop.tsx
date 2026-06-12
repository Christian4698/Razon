import { Siren } from "lucide-react";
import { confirmDanger } from "./CockpitPrimitives";

export function MobileEmergencyStop({
  active,
  onEmergencyStop,
}: {
  active: boolean;
  onEmergencyStop: () => void;
}) {
  return (
    <button
      className={active ? "mobile-emergency is-active" : "mobile-emergency"}
      onClick={() => confirmDanger("EMERGENCY STOP", onEmergencyStop)}
      type="button"
    >
      <Siren size={17} />
      {active ? "STOP ACTIVE" : "EMERGENCY STOP"}
    </button>
  );
}
