import type { Request, Response } from "express";
import { saasPersistenceStatus } from "../../backend/src/modules/persistence/saas-persistence.repository";
import type { RazonStatus } from "../types/razon";
import { sendJson } from "../utils/http";

export function getStatus(_req: Request, res: Response) {
  const status: RazonStatus = {
    app: "RAZON",
    tagline: "AI Trading Analysis Platform",
    state: "connected",
    mode: "demo",
    dataMode: "DEMO_DATA",
    dataModeLabels: ["DEMO_DATA", "DEMO_MODE", "MOCK", "NO REAL IMPACT"],
    api: "online",
    automaticTradingAllowed: false,
    mt5Connected: false,
    liveExecutionEnabled: false,
    verifiedPerformance: false,
    performanceMessage: "No verified performance yet",
    persistence: saasPersistenceStatus(),
    timestamp: new Date().toISOString(),
  } as RazonStatus & { persistence: ReturnType<typeof saasPersistenceStatus> };

  return sendJson(res, status);
}

export function getHealth(_req: Request, res: Response) {
  return sendJson(res, {
    ok: true,
    app: "RAZON",
    api: "online",
    persistence: saasPersistenceStatus(),
    timestamp: new Date().toISOString(),
  });
}
