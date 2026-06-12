import { useCallback, useEffect, useState } from "react";
import { razonApi } from "@/lib/api";

export type RazonApiState = "loading" | "connected" | "disconnected";

interface UseRazonApiOptions {
  refreshMs?: number;
  enabled?: boolean;
}

export function useRazonApi<T>(path: string, options: UseRazonApiOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<RazonApiState>("loading");
  const [error, setError] = useState<string | null>(null);
  const enabled = options.enabled ?? true;

  const load = useCallback(async () => {
    if (!enabled) return;

    setState("loading");
    setError(null);

    try {
      const payload = await razonApi<T>(path);
      setData(payload);
      setState("connected");
    } catch (err) {
      setState("disconnected");
      setError(err instanceof Error ? err.message : "Unable to reach RAZON API");
    }
  }, [enabled, path]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !options.refreshMs) return;

    const interval = window.setInterval(() => {
      void load();
    }, options.refreshMs);

    return () => window.clearInterval(interval);
  }, [enabled, load, options.refreshMs]);

  return {
    data,
    state,
    error,
    refetch: load,
  };
}
