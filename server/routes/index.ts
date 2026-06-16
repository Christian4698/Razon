import { Router } from "express";
import { getConnectorsDebugAuth } from "../controllers/connectorsController";
import { requireLicense } from "../middleware/authMiddleware";
import { authRoutes } from "./authRoutes";
import { backtestRoutes } from "./backtestRoutes";
import { connectorsRoutes } from "./connectorsRoutes";
import { journalRoutes } from "./journalRoutes";
import { licensesRoutes } from "./licensesRoutes";
import { marketDataRoutes } from "./marketDataRoutes";
import { riskRoutes } from "./riskRoutes";
import { signalsRoutes } from "./signalsRoutes";
import { statusRoutes } from "./statusRoutes";

export const apiRoutes = Router();

apiRoutes.use(statusRoutes);
apiRoutes.use(authRoutes);
apiRoutes.use(licensesRoutes);
apiRoutes.get("/connectors/debug-auth", getConnectorsDebugAuth);
apiRoutes.use(requireLicense());
apiRoutes.use(connectorsRoutes);
apiRoutes.use(marketDataRoutes);
apiRoutes.use(signalsRoutes);
apiRoutes.use(riskRoutes);
apiRoutes.use(backtestRoutes);
apiRoutes.use(journalRoutes);
