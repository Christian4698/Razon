import { Router } from "express";
import { getConnectorsHealth, postConnectorSafeAction } from "../controllers/connectorsController";

export const connectorsRoutes = Router();

connectorsRoutes.get("/connectors/health", getConnectorsHealth);
connectorsRoutes.post("/connectors/:id/test", postConnectorSafeAction);
connectorsRoutes.post("/connectors/:id/save-secret", postConnectorSafeAction);
connectorsRoutes.post("/connectors/:id/delete-secret", postConnectorSafeAction);
connectorsRoutes.post("/connectors/:id/reconnect", postConnectorSafeAction);
connectorsRoutes.post("/connectors/:id/disconnect", postConnectorSafeAction);
