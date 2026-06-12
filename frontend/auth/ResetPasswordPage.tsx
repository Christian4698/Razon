import { KeyRound } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { AuthField, AuthMessage, AuthShell } from "./AuthShell";

export function ResetPasswordPage({ onNavigate }: { readonly onNavigate: (path: string) => void }) {
  const { resetPassword } = useAuth();
  const queryToken = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [token, setToken] = useState(queryToken);
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
      setMessage(await resetPassword({ token, newPassword }));
      window.setTimeout(() => onNavigate("/login"), 900);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Choose a new password" description="Reset tokens are single-use and expire quickly. Tokens are never stored in localStorage.">
      <form className="razon-auth-form" onSubmit={submit}>
        <AuthField label="Reset token">
          <span className="razon-auth-input-icon"><KeyRound size={16} aria-hidden="true" /></span>
          <input
            autoComplete="one-time-code"
            onChange={event => setToken(event.target.value)}
            placeholder="Paste reset token"
            value={token}
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
        {message ? <AuthMessage tone="success">{message}</AuthMessage> : null}
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <button className="razon-auth-submit" disabled={busy} type="submit">
          {busy ? "Updating password..." : "Reset password"}
        </button>
      </form>
    </AuthShell>
  );
}
