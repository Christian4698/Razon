import type { Request, Response } from "express";
import { getCurrentUserScope } from "../services/connectors/connectorSecretsRepository";
import { buildExecutionPreview } from "../services/execution/executionPreviewService";
import { sendJson } from "../utils/http";

function parsePreviewBody(req: Request) {
  const body = typeof req.body === "object" && req.body !== null ? req.body as Record<string, unknown> : {};

  return {
    symbol: typeof body.symbol === "string" ? body.symbol : undefined,
    timeframe: typeof body.timeframe === "string" ? body.timeframe as "1m" | "5m" | "15m" | "1h" | "1d" : undefined,
    userStake: typeof body.userStake === "number" ? body.userStake : undefined,
    targetAccount: body.targetAccount === "REAL" ? "REAL" as const : "DEMO" as const,
    userAcceptedExtraRisk: body.userAcceptedExtraRisk === true,
  };
}

export async function previewExecution(req: Request, res: Response) {
  try {
    return sendJson(res, await buildExecutionPreview(parsePreviewBody(req), getCurrentUserScope(req)));
  } catch (error) {
    return res.status(502).json({
      error: "EXECUTION_PREVIEW_FAILED",
      message: error instanceof Error ? error.message : "Unable to build execution preview",
      liveExecutionEnabled: false,
      orderPlacementAllowed: false,
    });
  }
}

export async function confirmDemoExecution(req: Request, res: Response) {
  try {
    const result = await buildExecutionPreview({ ...parsePreviewBody(req), targetAccount: "DEMO" }, getCurrentUserScope(req));

    return sendJson(res, {
      ...result,
      status: "DEMO_CONFIRMATION_RECORDED",
      execution: "SIMULATED_ONLY",
      liveExecutionEnabled: false,
      orderPlacementAllowed: false,
    });
  } catch (error) {
    return res.status(502).json({
      error: "DEMO_CONFIRMATION_FAILED",
      message: error instanceof Error ? error.message : "Unable to confirm demo simulation",
      liveExecutionEnabled: false,
      orderPlacementAllowed: false,
    });
  }
}

export function confirmRealExecution(_req: Request, res: Response) {
  return res.status(403).json({
    error: "REAL_EXECUTION_LOCKED",
    message: "REAL execution is locked. No real order route is available.",
    requiredChecklist: [
      "1000 demo trades",
      "Sharpe > 1.5",
      "drawdown < 8%",
      "no MOCK",
      "complete journal",
      "kill switch tested",
    ],
    liveExecutionEnabled: false,
    orderPlacementAllowed: false,
  });
}
