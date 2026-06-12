import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { AuthField, AuthMessage, AuthShell } from "./AuthShell";

export function ForgotPasswordPage({ onNavigate }: { readonly onNavigate: (path: string) => void }) {
  const { forgotPassword } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setMessage(await forgotPassword(identifier));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Reset request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset access" description="Request password recovery for an existing RAZON account. Registration stays closed.">
      <form className="razon-auth-form" onSubmit={submit}>
        <AuthField label="Email or username">
          <span className="razon-auth-input-icon"><MailCheck size={16} aria-hidden="true" /></span>
          <input
            autoComplete="username"
            onChange={event => setIdentifier(event.target.value)}
            placeholder="client@example.com"
            value={identifier}
          />
        </AuthField>
        {message ? <AuthMessage tone="success">{message}</AuthMessage> : null}
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <button className="razon-auth-submit" disabled={busy} type="submit">
          {busy ? "Preparing reset..." : "Send reset instructions"}
        </button>
        <button className="razon-auth-link centered" onClick={() => onNavigate("/login")} type="button">
          Back to login
        </button>
      </form>
    </AuthShell>
  );
}
