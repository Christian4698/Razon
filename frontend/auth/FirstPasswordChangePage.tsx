import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { AuthField, AuthMessage, AuthShell } from "./AuthShell";

export function FirstPasswordChangePage() {
  const { changePassword, session } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Password update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Change temporary password"
      description={`${session?.user.displayName ?? "User"}, your first login requires a new private password before cockpit access.`}
    >
      <form className="razon-auth-form" onSubmit={submit}>
        <AuthField label="Temporary password">
          <span className="razon-auth-input-icon"><KeyRound size={16} aria-hidden="true" /></span>
          <input
            autoComplete="current-password"
            onChange={event => setCurrentPassword(event.target.value)}
            type="password"
            value={currentPassword}
          />
        </AuthField>
        <AuthField label="New password">
          <span className="razon-auth-input-icon"><KeyRound size={16} aria-hidden="true" /></span>
          <input
            autoComplete="new-password"
            onChange={event => setNewPassword(event.target.value)}
            placeholder="At least 10 characters"
            type="password"
            value={newPassword}
          />
        </AuthField>
        <AuthField label="Confirm new password">
          <span className="razon-auth-input-icon"><KeyRound size={16} aria-hidden="true" /></span>
          <input
            autoComplete="new-password"
            onChange={event => setConfirmPassword(event.target.value)}
            type="password"
            value={confirmPassword}
          />
        </AuthField>
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <button className="razon-auth-submit" disabled={busy} type="submit">
          {busy ? "Saving password..." : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}
