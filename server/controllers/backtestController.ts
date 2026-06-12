import type { Request, Response } from "express";
import { razonBacktestService } from "../services/razonBacktestService";
import { sendJson } from "../utils/http";

export function getBacktest(_req: Request, res: Response) {
  return sendJson(res, razonBacktestService.getState());
}
