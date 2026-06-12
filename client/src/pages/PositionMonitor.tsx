import DashboardLayout from "@/components/DashboardLayout";
import RazonEmptyState from "@/components/RazonEmptyState";
import { Badge } from "@/components/ui/badge";
import { useRazonApi } from "@/hooks/useRazonApi";
import type { RazonRiskState, RazonStatus } from "@/lib/api";
import { Shield, XCircle } from "lucide-react";

export default function PositionMonitor() {
  const risk = useRazonApi<RazonRiskState>("/api/risk");
  const status = useRazonApi<RazonStatus>("/api/status");

  return (
    <DashboardLayout
      title="RAZON Positions"
      description="Position monitoring foundation for RAZON V1"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-glow p-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold">Live Positions</h3>
            <Badge variant="secondary">{status.data?.mode ?? "demo"}</Badge>
          </div>

          {risk.data ? (
            <RazonEmptyState
              title="No live positions connected in V1"
              description="RAZON does not connect to MT5 or any broker in this version."
            />
          ) : (
            <RazonEmptyState
              title="Loading position state"
              description="RAZON is waiting for /api/risk."
            />
          )}
        </div>

        <div className="card-glow p-8">
          <h3 className="mb-6 text-lg font-bold">Execution Status</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-4">
              <XCircle className="mt-0.5 h-5 w-5 text-red-400" />
              <div>
                <p className="font-semibold">Automatic trading disabled</p>
                <p className="text-sm text-muted-foreground">
                  RAZON V1 is analysis-only.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-4">
              <Shield className="mt-0.5 h-5 w-5 text-accent" />
              <div>
                <p className="font-semibold">Manual review required</p>
                <p className="text-sm text-muted-foreground">
                  API responses are not order instructions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
