import { Lock, ShieldAlert } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { AuthShell } from "./AuthShell";

export function LicenseAccessDeniedPage() {
  const { logout, session } = useAuth();
  const status = session?.license.status ?? "MISSING";

  return (
    <AuthShell
      eyebrow="Access control"
      title="Cockpit access blocked"
      description="The license engine refused this account. Contact an administrator before continuing."
    >
      <div className="razon-license-status denied">
        <Lock size={18} aria-hidden="true" />
        <span>
          <strong>{status}</strong>
          {session?.license.message ?? "Access denied."}
        </span>
      </div>
      <div className="razon-auth-note">
        <ShieldAlert size={15} aria-hidden="true" />
        No local bypass is available. License state is checked server-side.
      </div>
      <button className="razon-auth-submit" onClick={() => void logout()} type="button">
        Logout
      </button>
    </AuthShell>
  );
}
