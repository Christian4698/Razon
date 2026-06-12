import { Router } from "express";
import { getRisk } from "../controllers/riskController";

export const riskRoutes = Router();

riskRoutes.get("/risk", getRisk);
