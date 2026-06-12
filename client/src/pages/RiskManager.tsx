import DashboardLayout from "@/components/DashboardLayout";
import RazonEmptyState from "@/components/RazonEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRazonApi } from "@/hooks/useRazonApi";
import type { RazonRiskState } from "@/lib/api";
import { AlertTriangle, Shield } from "lucide-react";

export default function RiskManager() {
  const risk = useRazonApi<RazonRiskState>("/api/risk");

  return (
    <DashboardLayout
      title="RAZON Protect"
      description="Risk and execution guardrails for RAZON V1"
    >
      {risk.data ? (
        <>
          <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-3">
            <div className="card-glow p-6">
              <p className="metric-label mb-2">Automatic Trading</p>
              <p className="metric-value mb-2">Disabled</p>
              <Badge variant="secondary">
                {String(risk.data.automaticTradingAllowed)}
              </Badge>
            </div>
            <div className="card-glow p-6">
              <p className="metric-label mb-2">MT5 Connected</p>
              <p className="metric-value mb-2">No</p>
              <Badge variant="secondary">{String(risk.data.mt5Connected)}</Badge>
            </div>
            <div className="card-glow p-6">
              <p className="metric-label mb-2">Live Execution</p>
              <p className="metric-value mb-2">Blocked</p>
              <Badge variant="secondary">
                {String(risk.data.liveExecutionEnabled)}
              </Badge>
            </div>
          </div>

          <div className="card-glow p-8 mb-8">
            <h3 className="mb-6 text-lg font-bold">Risk Rules</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {risk.data.rules.map(rule => (
                <div
                  key={rule.id}
                  className="flex gap-4 rounded-lg border border-border bg-secondary/50 p-4"
                >
                  {rule.status === "enforced" ? (
                    <Shield className="h-6 w-6 flex-shrink-0 text-accent" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-400" />
                  )}
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{rule.label}</p>
                      <Badge variant="secondary">{rule.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rule.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-glow p-8">
            <h3 className="mb-4 text-lg font-bold">
              {risk.data.performanceMessage}
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              RAZON Protect will not calculate live capital risk until a real
              account data source is explicitly connected in a later version.
            </p>
            <Button disabled variant="outline" className="btn-fintech">
              Automatic Mode Disabled in V1
            </Button>
          </div>
        </>
      ) : (
        <RazonEmptyState
          title="Loading risk state"
          description="RAZON is waiting for /api/risk."
        />
      )}
    </DashboardLayout>
  );
}
