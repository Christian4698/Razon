import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  RadioTower,
  ShieldCheck,
  ShieldOff,
  TerminalSquare,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { AuthField, AuthMessage } from "./AuthShell";

export function LoginPage({ onNavigate }: { readonly nextPath?: string; readonly onNavigate: (path: string) => void }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const session = await login({ identifier, password, rememberMe });
      onNavigate(session.user.mustChangePassword ? "/change-password" : "/cockpit");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="razon-login-screen">
      <section className="razon-login-shell" aria-label="RAZON login">
        <aside className="razon-login-intel">
          <div className="razon-login-brand">
            <div className="razon-login-mark">R</div>
            <div>
              <strong>RAZON</strong>
              <span>AI Trading Cockpit</span>
            </div>
          </div>

          <div className="razon-login-copy">
            <span className="razon-login-kicker">Secure market intelligence</span>
            <h1>Welcome back</h1>
            <p>Access your AI Trading Cockpit</p>
          </div>

          <div className="razon-login-signal" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="razon-login-assurance">
            <span>
              <TerminalSquare size={17} aria-hidden="true" />
              Runtime controlled
            </span>
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
              Server-side license gate
            </span>
            <span>
              <ShieldOff size={17} aria-hidden="true" />
              No live execution route
            </span>
          </div>
        </aside>

        <section className="razon-login-panel">
          <div className="razon-login-status-grid" aria-label="Runtime safety status">
            <span>
              <b>Runtime</b>
              <strong>DEMO</strong>
            </span>
            <span>
              <b>LIVE</b>
              <strong>OFF</strong>
            </span>
            <span>
              <b>License Status</b>
              <strong>CHECK REQUIRED</strong>
            </span>
          </div>

          <form className="razon-auth-form razon-login-form" onSubmit={submit}>
            <div className="razon-login-form-head">
              <span className="razon-login-kicker">Identity required</span>
              <h2>Sign in</h2>
            </div>

            <AuthField label="Email / Username">
              <span className="razon-auth-input-icon"><Mail size={16} aria-hidden="true" /></span>
              <input
                autoComplete="username"
                autoFocus
                name="identifier"
                onChange={event => setIdentifier(event.target.value)}
                placeholder="operator@razon.ai"
                value={identifier}
              />
            </AuthField>

            <AuthField label="Password">
              <span className="razon-auth-input-icon"><LockKeyhole size={16} aria-hidden="true" /></span>
              <input
                autoComplete="current-password"
                name="password"
                onChange={event => setPassword(event.target.value)}
                placeholder="Enter password"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button className="razon-auth-inline-button" onClick={() => setShowPassword(value => !value)} type="button">
                {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                <span className="sr-only">Toggle password visibility</span>
              </button>
            </AuthField>

            <div className="razon-auth-row">
              <label className="razon-auth-checkbox">
                <input checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} type="checkbox" />
                Remember me
              </label>
              <button className="razon-auth-link" onClick={() => onNavigate("/forgot-password")} type="button">
                Forgot password
              </button>
            </div>

            {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
            {notice ? <AuthMessage>{notice}</AuthMessage> : null}

            <div className="razon-login-actions single">
              <button className="razon-auth-submit razon-login-primary" disabled={busy} type="submit">
                {busy ? "Checking access..." : "Sign In"}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="razon-auth-note">
              <RadioTower size={15} aria-hidden="true" />
              Access is issued by an administrator. Authentication is required before cockpit access.
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
