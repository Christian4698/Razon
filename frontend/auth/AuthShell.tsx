import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({
  children,
  eyebrow = "RAZON SaaS Access",
  title,
  description,
}: {
  readonly children: ReactNode;
  readonly eyebrow?: string;
  readonly title: string;
  readonly description: string;
}) {
  return (
    <main className="razon-auth-screen">
      <section className="razon-auth-hero" aria-label="RAZON authentication">
        <div className="cockpit-mark">R</div>
        <div>
          <span className="razon-auth-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="razon-auth-safety">
          <ShieldCheck size={16} aria-hidden="true" />
          LIVE OFF / READ ONLY
        </div>
      </section>
      <section className="razon-auth-card">{children}</section>
    </main>
  );
}

export function AuthField({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <label className="razon-auth-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function AuthMessage({ tone = "info", children }: { readonly tone?: "info" | "error" | "success"; readonly children: ReactNode }) {
  return <p className={`razon-auth-message ${tone}`}>{children}</p>;
}
