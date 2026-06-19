import { Router } from "express";
import { getShadowTrading } from "../controllers/shadowTradingController";

export const shadowTradingRoutes = Router();

shadowTradingRoutes.get("/shadow-trading", getShadowTrading);
