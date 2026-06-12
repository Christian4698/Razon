import type { Request, Response } from "express";
import { razonRiskManager } from "../services/razonRiskManager";
import { sendJson } from "../utils/http";

export function getRisk(_req: Request, res: Response) {
  return sendJson(res, razonRiskManager.getRiskState());
}
