import { Router } from "express";
import { getSignals } from "../controllers/signalsController";

export const signalsRoutes = Router();

signalsRoutes.get("/signals", getSignals);
