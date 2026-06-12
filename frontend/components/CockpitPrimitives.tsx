import type { ReactNode } from "react";
import type { ConnectorState, RuntimeMode, SignalDecision } from "../app/cockpit.types";

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="cockpit-panel">
      <div className="cockpit-panel-header">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({
  children,
  className = "",
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone?: SignalDecision | ConnectorState | RuntimeMode | "critical" | "live-off" | "demo" | string;
}) {
  const toneClassName = String(tone ?? "")
    .toLowerCase()
    .replace("_", "-");

  return <span className={`cockpit-pill ${toneClassName} ${className}`.trim()}>{children}</span>;
}

export function formatPrice(value: number) {
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 5 });
}

export function formatDecision(decision: SignalDecision) {
  if (decision === "NO_TRADE") return "NO_TRADE";
  if (decision === "DATA_LOW") return "DATA_LOW";
  if (decision === "INVALID") return "INVALID";
  return decision;
}

export function confirmDanger(action: string, onConfirm: () => void) {
  const isFrench = document.documentElement.lang.toLowerCase().startsWith("fr");
  const message = isFrench
    ? "Confirmation requise. Aucun ordre réel ne sera envoyé."
    : "Confirmation required. No real order will be sent.";
  const accepted = window.confirm(`${action}\n\n${message}`);
  if (accepted) onConfirm();
}
