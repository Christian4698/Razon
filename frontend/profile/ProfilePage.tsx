import { KeyRound, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { StatusPill } from "../components/CockpitPrimitives";
import { AuthField, AuthMessage } from "../auth/AuthShell";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "R";
}

export function ProfilePage({ onNavigate }: { readonly onNavigate: (path: string) => void }) {
  const { changePassword, logout, logoutGlobal, session } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Password update failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <main className="razon-profile-screen">
      <section className="cockpit-panel razon-profile-header">
        <button className="cockpit-control" onClick={() => onNavigate("/dashboard")} type="button">
          Back to cockpit
        </button>
        <div className="razon-profile-identity">
          <div className="razon-user-avatar large">{initials(session.user.displayName)}</div>
          <div>
            <h1>{session.user.displayName}</h1>
            <p>{session.user.email}</p>
          </div>
        </div>
        <div className="dashboard-safety-row">
          <StatusPill tone="connected">{session.plan}</StatusPill>
          <StatusPill tone={session.license.status === "ACTIVE" ? "connected" : "critical"}>{session.license.status}</StatusPill>
          <StatusPill tone="live-off">LIVE OFF</StatusPill>
        </div>
      </section>

      <section className="cockpit-grid two">
        <div className="cockpit-panel">
          <div className="cockpit-panel-header">
            <div>
              <h2>Account security</h2>
              <p className="cockpit-muted">Update your password without exposing session tokens to localStorage.</p>
            </div>
            <StatusPill tone="connected">HTTPONLY</StatusPill>
          </div>
          <form className="razon-auth-form compact" onSubmit={submit}>
            <AuthField label="Current password">
              <span className="razon-auth-input-icon"><KeyRound size={16} aria-hidden="true" /></span>
              <input onChange={event => setCurrentPassword(event.target.value)} type="password" value={currentPassword} />
            </AuthField>
            <AuthField label="New password">
              <span className="razon-auth-input-icon"><KeyRound size={16} aria-hidden="true" /></span>
              <input onChange={event => setNewPassword(event.target.value)} type="password" value={newPassword} />
            </AuthField>
            {message ? <AuthMessage tone="success">{message}</AuthMessage> : null}
            {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
            <button className="razon-auth-submit" disabled={busy} type="submit">
              {busy ? "Saving..." : "Change password"}
            </button>
          </form>
        </div>

        <div className="cockpit-panel">
          <div className="cockpit-panel-header">
            <div>
              <h2>License and sessions</h2>
              <p className="cockpit-muted">Server-side license state, devices and session limits.</p>
            </div>
            <StatusPill tone="demo">{session.license.status}</StatusPill>
          </div>
          <div className="license-grid">
            <span><b>Plan</b><strong>{session.plan}</strong></span>
            <span><b>Devices</b><strong>{session.license.activeDevices} / {session.license.deviceLimit ?? "n/a"}</strong></span>
            <span><b>Sessions</b><strong>{session.license.activeSessions} / {session.license.sessionLimit ?? "n/a"}</strong></span>
            <span><b>Expiry</b><strong>{session.license.expiryDate ? new Date(session.license.expiryDate).toLocaleDateString("en-US") : "n/a"}</strong></span>
          </div>
          <div className="connector-action-row">
            <button onClick={() => void logout()} type="button">
              <LogOut size={14} aria-hidden="true" />
              Logout
            </button>
            <button onClick={() => void logoutGlobal()} type="button">
              <MonitorSmartphone size={14} aria-hidden="true" />
              Logout global
            </button>
          </div>
          <div className="razon-auth-note">
            <ShieldCheck size={15} aria-hidden="true" />
            Connector secrets and license keys are never shown here.
          </div>
        </div>
      </section>
    </main>
  );
}
