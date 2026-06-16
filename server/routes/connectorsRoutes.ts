import { Router } from "express";
import { getConnectorsHealth, postConnectorSafeAction } from "../controllers/connectorsController";
import { requireAuth } from "../middleware/authMiddleware";

export const connectorsRoutes = Router();

connectorsRoutes.get("/connectors/health", requireAuth(), getConnectorsHealth);
connectorsRoutes.post("/connectors/:id/test", requireAuth(), postConnectorSafeAction);
connectorsRoutes.post("/connectors/:id/save-secret", requireAuth(), postConnectorSafeAction);
connectorsRoutes.post("/connectors/:id/delete-secret", requireAuth(), postConnectorSafeAction);
connectorsRoutes.post("/connectors/:id/reconnect", requireAuth(), postConnectorSafeAction);
connectorsRoutes.post("/connectors/:id/disconnect", requireAuth(), postConnectorSafeAction);
