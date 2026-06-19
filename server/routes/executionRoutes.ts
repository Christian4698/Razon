import { Router } from "express";
import { confirmDemoExecution, confirmRealExecution, previewExecution } from "../controllers/executionController";

export const executionRoutes = Router();

executionRoutes.post("/execution/preview", previewExecution);
executionRoutes.post("/execution/confirm-demo", confirmDemoExecution);
executionRoutes.post("/execution/confirm-real", confirmRealExecution);
