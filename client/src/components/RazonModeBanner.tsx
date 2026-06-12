import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RazonMode } from "@/lib/api";
import type { RazonApiState } from "@/hooks/useRazonApi";

interface RazonModeBannerProps {
  state: RazonApiState;
  mode?: RazonMode;
  compact?: boolean;
}

const modes: Array<{ value: RazonMode; label: "DEMO" | "BACKTEST" | "LIVE" }> = [
  { value: "demo", label: "DEMO" },
  { value: "backtest", label: "BACKTEST" },
  { value: "live", label: "LIVE" },
];

export default function RazonModeBanner({
  state,
  mode = "demo",
  compact = false,
}: RazonModeBannerProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 p-4",
        compact && "p-3"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={state === "loading" ? "secondary" : "default"}>
          Loading
        </Badge>
        <Badge variant={state === "connected" ? "default" : "secondary"}>
          Connected
        </Badge>
        <Badge variant={state === "disconnected" ? "destructive" : "secondary"}>
          Disconnected
        </Badge>
        <Badge variant={mode === "demo" ? "default" : "secondary"}>Demo</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs font-semibold uppercase tracking-widest">
        {modes.map(item => (
          <div
            key={item.value}
            className={cn(
              "rounded-md border border-border px-3 py-2 text-center text-muted-foreground",
              item.value === mode && "border-accent bg-accent/10 text-accent",
              item.value === "live" && "opacity-50"
            )}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
