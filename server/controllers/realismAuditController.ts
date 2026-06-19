import type { Request, Response } from "express";
import { getRealismAuditReport } from "../services/realism/realismAuditService";
import { sendJson } from "../utils/http";

export function getRealismAudit(_req: Request, res: Response) {
  return sendJson(res, getRealismAuditReport());
}
