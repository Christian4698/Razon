import type { Request, Response } from "express";
import { getShadowTradingReport } from "../services/shadow/shadowTradingService";
import { sendJson } from "../utils/http";

export function getShadowTrading(_req: Request, res: Response) {
  return sendJson(res, getShadowTradingReport());
}
