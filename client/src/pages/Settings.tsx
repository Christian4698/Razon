import DashboardLayout from "@/components/DashboardLayout";
import RazonEmptyState from "@/components/RazonEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useRazonApi } from "@/hooks/useRazonApi";
import type { RazonStatus } from "@/lib/api";
import { Lock, Settings as SettingsIcon, Shield, Zap } from "lucide-react";

export default function Settings() {
  const status = useRazonApi<RazonStatus>("/api/status");

  return (
    <DashboardLayout
      title="RAZON Settings"
      description="Application mode and V1 safety configuration"
    >
      <div className="space-y-8">
        <div className="card-glow p-8">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-accent/10 p-3">
                <Zap className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Signal Engine</h3>
                <p className="text-sm text-muted-foreground">
                  Manual analysis requests only in V1.
                </p>
              </div>
            </div>
            <Badge variant="secondary">{status.data?.mode ?? "demo"}</Badge>
          </div>

          {status.data ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-secondary/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">API State</p>
                  <Badge variant="default">{status.data.state}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  RAZON API is available for analysis requests.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-secondary/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">Automatic Mode</p>
                  <Badge variant="secondary">Disabled in V1</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  RAZON V1 does not execute trades automatically.
                </p>
              </div>
            </div>
          ) : (
            <RazonEmptyState
              title="Loading settings"
              description="RAZON is waiting for /api/status."
            />
          )}
        </div>

        <div className="card-glow p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-lg bg-accent/10 p-3">
              <Shield className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Execution Safety</h3>
              <p className="text-sm text-muted-foreground">
                Live trading and MT5 are blocked in this foundation.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              ["Automatic trading", status.data?.automaticTradingAllowed],
              ["MT5 connected", status.data?.mt5Connected],
              ["Live execution", status.data?.liveExecutionEnabled],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-4"
              >
                <div>
                  <p className="font-semibold">{label}</p>
                  <p className="text-sm text-muted-foreground">
                    Locked by backend policy.
                  </p>
                </div>
                <Switch checked={Boolean(value)} disabled />
              </div>
            ))}
          </div>
        </div>

        <div className="card-glow p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-lg bg-accent/10 p-3">
              <Lock className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Security</h3>
              <p className="text-sm text-muted-foreground">
                Account controls are UI-only until authentication is connected.
              </p>
            </div>
          </div>

          <Button disabled variant="outline" className="btn-fintech">
            Configure Authentication Later
          </Button>
        </div>

        <div className="card-glow p-8">
          <div className="mb-4 flex items-center gap-3">
            <SettingsIcon className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-bold">About RAZON</h3>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="mb-1 font-semibold text-foreground">Version</p>
              <p>1.0.0</p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-foreground">Platform</p>
              <p>AI Trading Analysis Platform</p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-foreground">Provider</p>
              <p>Powered by General Tech Consult</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
