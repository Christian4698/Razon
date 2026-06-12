import { Router } from "express";
import {
  getKalos,
  getMarketData,
  getMarketHub,
  getMarketScanner,
  getMarketSnapshot,
  getMarketSymbols,
} from "../controllers/marketDataController";

export const marketDataRoutes = Router();

marketDataRoutes.get("/market-data", getMarketData);
marketDataRoutes.get("/markets/hub", getMarketHub);
marketDataRoutes.get("/markets/snapshot", getMarketSnapshot);
marketDataRoutes.get("/markets/scanner", getMarketScanner);
marketDataRoutes.get("/markets/symbols", getMarketSymbols);
marketDataRoutes.get("/kalos", getKalos);
