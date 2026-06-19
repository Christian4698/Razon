import { Router } from "express";
import { getRealismAudit } from "../controllers/realismAuditController";

export const realismAuditRoutes = Router();

realismAuditRoutes.get("/realism-audit", getRealismAudit);
