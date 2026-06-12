import { Router } from "express";
import { getStatus } from "../controllers/statusController";

export const statusRoutes = Router();

statusRoutes.get("/status", getStatus);
