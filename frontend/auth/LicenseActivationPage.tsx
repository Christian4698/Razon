import { BadgeCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { AuthShell } from "./AuthShell";

export function LicenseActivationPage() {
  const { logout, session } = useAuth();

  return (
    <AuthShell
      eyebrow="License verification"
      title="License required"
      description="RAZON access is assigned by an administrator. Public registration and self-service activation are disabled."
    >
      <div className="razon-auth-form">
        <div className="razon-license-status">
          <BadgeCheck size={18} aria-hidden="true" />
          <span>
            <strong>{session?.license.status ?? "PENDING"}</strong>
            {session?.license.message ?? "An administrator must assign an active license before cockpit access."}
          </span>
        </div>
        <button className="razon-auth-link centered" onClick={() => void logout()} type="button">
          Logout
        </button>
        <div className="razon-auth-note">
          <ShieldAlert size={15} aria-hidden="true" />
          Contact your administrator for access. LIVE and AUTO EXECUTION remain OFF.
        </div>
      </div>
    </AuthShell>
  );
}
