import { Router } from "express";
import { getBacktest } from "../controllers/backtestController";

export const backtestRoutes = Router();

backtestRoutes.get("/backtest", getBacktest);
