import { Router } from "express";
import { getDemoObservationGate } from "../controllers/demoObservationGateController";

export const demoObservationGateRoutes = Router();

demoObservationGateRoutes.get("/demo-observation-gate", getDemoObservationGate);
