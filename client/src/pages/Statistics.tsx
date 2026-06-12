import DashboardLayout from "@/components/DashboardLayout";
import RazonEmptyState from "@/components/RazonEmptyState";
import { Badge } from "@/components/ui/badge";
import { useRazonApi } from "@/hooks/useRazonApi";
import type { RazonBacktestState, RazonJournalResponse } from "@/lib/api";
import { BarChart3, BookOpen } from "lucide-react";

export default function Statistics() {
  const backtest = useRazonApi<RazonBacktestState>("/api/backtest");
  const journal = useRazonApi<RazonJournalResponse>("/api/journal");

  return (
    <DashboardLayout
      title="RAZON Analytics"
      description="Verified analytics and backtest readiness"
    >
      <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card-glow p-6">
            <p className="metric-value mb-2">No verified performance yet</p>
            <p className="text-sm text-muted-foreground">
              Verified analytics are not available in V1.
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-glow p-8">
          <div className="mb-4 flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-accent" />
            <h3 className="text-lg font-bold">Backtest Foundation</h3>
          </div>
          {backtest.data ? (
            <div className="space-y-4">
              <Badge variant="secondary">{backtest.data.status}</Badge>
              <p className="text-sm text-muted-foreground">
                {backtest.data.message}
              </p>
              <p className="font-semibold">{backtest.data.performanceMessage}</p>
            </div>
          ) : (
            <RazonEmptyState
              title="Loading backtest state"
              description="RAZON is waiting for /api/backtest."
            />
          )}
        </div>

        <div className="card-glow p-8">
          <div className="mb-4 flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-accent" />
            <h3 className="text-lg font-bold">Journal Records</h3>
          </div>
          {journal.data?.entries.length ? (
            <div className="space-y-3">
              {journal.data.entries.slice(0, 5).map(entry => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border bg-secondary/50 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="secondary">{entry.decision}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Confidence: {entry.confidence}%
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <RazonEmptyState
              title="No journal records yet"
              description="Run the signal engine to create decision journal entries."
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
