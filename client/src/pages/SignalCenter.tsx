import DashboardLayout from "@/components/DashboardLayout";
import RazonEmptyState from "@/components/RazonEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRazonApi } from "@/hooks/useRazonApi";
import type { RazonJournalResponse, RazonSignalsResponse } from "@/lib/api";
import { useEffect } from "react";

function formatValue(value: number | null) {
  return typeof value === "number" ? value.toLocaleString() : "N/A";
}

function signalClass(signal?: string) {
  if (signal === "BUY") return "bg-green-500/20 text-green-400";
  if (signal === "SELL") return "bg-red-500/20 text-red-400";
  return "bg-amber-500/20 text-amber-400";
}

export default function SignalCenter() {
  const signals = useRazonApi<RazonSignalsResponse>("/api/signals");
  const journal = useRazonApi<RazonJournalResponse>("/api/journal");
  const signal = signals.data?.signal;

  useEffect(() => {
    if (signals.data?.journalEntryId) {
      void journal.refetch();
    }
  }, [journal.refetch, signals.data?.journalEntryId]);

  const refresh = async () => {
    await signals.refetch();
    await journal.refetch();
  };

  return (
    <DashboardLayout
      title="RAZON Signals"
      description="Analysis-only BUY, SELL, or NO SIGNAL output from the V1 engine"
    >
      <div className="mb-6 flex justify-end">
        <Button className="btn-fintech" variant="outline" onClick={refresh}>
          Run Signal Engine
        </Button>
      </div>

      {signal ? (
        <div className="card-glow p-8 mb-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div>
              <p className="metric-label mb-2">Signal</p>
              <div
                className={`inline-block rounded-lg px-4 py-2 text-lg font-bold ${signalClass(
                  signal.signal
                )}`}
              >
                {signal.signal}
              </div>

              <p className="metric-label mt-6 mb-2">Confidence</p>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-accent/60"
                    style={{ width: `${signal.confidence}%` }}
                  />
                </div>
                <span className="w-12 text-right text-lg font-bold text-accent">
                  {signal.confidence}%
                </span>
              </div>
            </div>

            <div>
              <p className="metric-label mb-4">Analysis Levels</p>
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Entry</p>
                  <p className="text-xl font-bold">{formatValue(signal.entry)}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">SL</p>
                  <p className="text-xl font-bold text-red-400">
                    {formatValue(signal.sl)}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">TP</p>
                  <p className="text-xl font-bold text-green-400">
                    {formatValue(signal.tp)}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="metric-label mb-4">Inputs</p>
              <div className="space-y-3 text-sm">
                {signals.data &&
                  Object.entries(signals.data.input).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between rounded-lg border border-border bg-secondary/50 p-3"
                    >
                      <span className="uppercase text-muted-foreground">{key}</span>
                      <span className="font-mono">{value.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <p className="metric-label mb-4">Reasons</p>
              <ul className="space-y-3 text-sm text-foreground">
                {signal.reasons.map(reason => (
                  <li key={reason} className="rounded-lg bg-secondary/50 p-3">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <RazonEmptyState
          title="Loading signal engine"
          description="RAZON is waiting for /api/signals."
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {journal.data?.decisionSummary.map(summary => (
          <div key={summary.decision} className="card-glow p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{summary.title}</h3>
              <Badge variant="secondary">{summary.entries.length}</Badge>
            </div>
            {summary.entries[0] ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                {summary.entries[0].reasons.map(reason => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No journal entry yet for {summary.decision}.
              </p>
            )}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
