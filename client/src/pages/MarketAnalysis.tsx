import DashboardLayout from "@/components/DashboardLayout";
import RazonEmptyState from "@/components/RazonEmptyState";
import { Badge } from "@/components/ui/badge";
import { useRazonApi } from "@/hooks/useRazonApi";
import type { RazonMarketSnapshot, RazonSignalsResponse } from "@/lib/api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function MarketAnalysis() {
  const market = useRazonApi<RazonMarketSnapshot>("/api/market-data");
  const signals = useRazonApi<RazonSignalsResponse>("/api/signals");
  const input = market.data?.input;

  return (
    <DashboardLayout
      title="RAZON Analysis"
      description="Market inputs and V1 signal-engine interpretation"
    >
      <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-2">
        <div className="card-glow p-6">
          <h3 className="mb-4 text-lg font-bold">Market Inputs</h3>
          {input ? (
            <div className="space-y-3">
              {Object.entries(input).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-4"
                >
                  <p className="font-semibold uppercase">{key}</p>
                  <p className="font-mono text-accent">{value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <RazonEmptyState
              title="Loading market inputs"
              description="RAZON is waiting for /api/market-data."
            />
          )}
        </div>

        <div className="card-glow p-6">
          <h3 className="mb-4 text-lg font-bold">Signal Interpretation</h3>
          {signals.data?.signal ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-4">
                <p className="font-semibold">Decision</p>
                <Badge variant="default">{signals.data.signal.signal}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-4">
                <p className="font-semibold">Confidence</p>
                <p className="font-mono text-accent">
                  {signals.data.signal.confidence}%
                </p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/50 p-4">
                <p className="mb-3 font-semibold">Reasons</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {signals.data.signal.reasons.map(reason => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <RazonEmptyState
              title="Loading signal analysis"
              description="RAZON is waiting for /api/signals."
            />
          )}
        </div>
      </div>

      <div className="card-glow p-6">
        <h3 className="mb-4 text-lg font-bold">Volume From Market API</h3>
        {market.data?.candles.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={market.data.candles}>
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
                <Bar dataKey="volume" fill="#66ccff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <RazonEmptyState
            title="Loading chart data"
            description="No market-data response has been received yet."
          />
        )}
      </div>
    </DashboardLayout>
  );
}
