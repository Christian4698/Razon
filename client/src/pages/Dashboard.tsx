import DashboardLayout from "@/components/DashboardLayout";
import RazonEmptyState from "@/components/RazonEmptyState";
import { Badge } from "@/components/ui/badge";
import { useRazonApi } from "@/hooks/useRazonApi";
import type {
  RazonJournalResponse,
  RazonMarketSnapshot,
  RazonSignalsResponse,
} from "@/lib/api";
import { AlertCircle, BarChart3, Shield, TrendingUp } from "lucide-react";
import { useEffect } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "N/A";
}

function signalClass(signal?: string) {
  if (signal === "BUY") return "bg-green-500/20 text-green-400";
  if (signal === "SELL") return "bg-red-500/20 text-red-400";
  return "bg-amber-500/20 text-amber-400";
}

export default function Dashboard() {
  const market = useRazonApi<RazonMarketSnapshot>("/api/market-data");
  const signals = useRazonApi<RazonSignalsResponse>("/api/signals");
  const journal = useRazonApi<RazonJournalResponse>("/api/journal");

  const input = market.data?.input;
  const currentSignal = signals.data?.signal;

  useEffect(() => {
    if (signals.data?.journalEntryId) {
      void journal.refetch();
    }
  }, [journal.refetch, signals.data?.journalEntryId]);

  return (
    <DashboardLayout
      title="RAZON Dashboard"
      description="API-connected analysis workspace for RAZON V1"
    >
      <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-4">
        {[
          { label: "Price", value: input ? formatNumber(input.price) : "Loading" },
          { label: "Volume", value: input ? formatNumber(input.volume) : "Loading" },
          { label: "RSI", value: input ? formatNumber(input.rsi) : "Loading" },
          { label: "EMA", value: input ? formatNumber(input.ema) : "Loading" },
        ].map(metric => (
          <div key={metric.label} className="card-glow p-6">
            <p className="metric-label mb-2">{metric.label}</p>
            <p className="metric-value">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-3">
        <div className="card-glow p-8 lg:col-span-2">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="metric-label mb-2">Current Signal</p>
              <h2 className="text-3xl font-bold text-foreground">
                {market.data?.instrument ?? "RAZON:SIM"}
              </h2>
            </div>
            <div
              className={`rounded-lg px-4 py-2 text-lg font-bold ${signalClass(
                currentSignal?.signal
              )}`}
            >
              {currentSignal?.signal ?? "Loading"}
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="metric-label mb-1">Entry</p>
              <p className="metric-value">{formatNumber(currentSignal?.entry)}</p>
            </div>
            <div>
              <p className="metric-label mb-1">SL</p>
              <p className="metric-value text-red-400">
                {formatNumber(currentSignal?.sl)}
              </p>
            </div>
            <div>
              <p className="metric-label mb-1">TP</p>
              <p className="metric-value text-green-400">
                {formatNumber(currentSignal?.tp)}
              </p>
            </div>
            <div>
              <p className="metric-label mb-1">Confidence</p>
              <p className="metric-value">{currentSignal?.confidence ?? 0}%</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/50 p-4">
            <p className="mb-2 text-sm text-muted-foreground">Decision Reasons</p>
            {currentSignal ? (
              <ul className="space-y-2 text-sm text-foreground">
                {currentSignal.reasons.map(reason => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Loading signal engine...</p>
            )}
          </div>
        </div>

        <div className="card-glow p-8">
          <p className="metric-label mb-4">Execution Guard</p>
          <div className="space-y-3">
            <Badge variant="secondary">Demo</Badge>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-4">
              <Shield className="mt-0.5 h-5 w-5 text-accent" />
              <p className="text-sm text-muted-foreground">
                Automatic trading is disabled in RAZON V1.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-400" />
              <p className="text-sm text-muted-foreground">
                No MT5 connector is active.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card-glow p-6 mb-8">
        <h3 className="mb-4 text-lg font-bold">RAZON Market Data</h3>
        {market.data?.candles.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={market.data.candles}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#66ccff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#66ccff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#888"
                  tickFormatter={value => new Date(value).toLocaleTimeString()}
                />
                <YAxis stroke="#888" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1f2e",
                    border: "1px solid #333",
                  }}
                  labelFormatter={value => new Date(value).toLocaleTimeString()}
                />
                <Area
                  dataKey="price"
                  fill="url(#colorPrice)"
                  stroke="#66ccff"
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <RazonEmptyState
            title="Loading market data"
            description="RAZON is waiting for the market-data API."
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-glow p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <BarChart3 className="h-5 w-5 text-accent" />
            No verified performance yet
          </h3>
          <p className="text-sm text-muted-foreground">
            RAZON V1 does not display win rate, profit factor, return, or profit
            until verified performance data exists.
          </p>
        </div>

        <div className="card-glow p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <TrendingUp className="h-5 w-5 text-accent" />
            Decision Journal
          </h3>
          {journal.data?.entries.length ? (
            <div className="space-y-3">
              {journal.data.entries.slice(0, 3).map(entry => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border bg-secondary/50 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="secondary">{entry.decision}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {entry.reasons[0] ?? "No reason recorded."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <RazonEmptyState
              title="Journal waiting for decisions"
              description="A journal entry is created whenever the signal API runs."
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
