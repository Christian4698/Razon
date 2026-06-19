import type { Request, Response } from "express";
import { getDemoObservationGateReport } from "../services/observation/demoObservationGateService";
import { sendJson } from "../utils/http";

export function getDemoObservationGate(_req: Request, res: Response) {
  return sendJson(res, getDemoObservationGateReport());
}
