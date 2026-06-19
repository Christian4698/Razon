import { Router } from "express";
import {
  authCookieNames,
  changePassword,
  forgotPassword,
  heartbeat,
  login,
  logout,
  logoutGlobal,
  me,
  refresh,
  resetPassword,
} from "../controllers/authController";
import { requireAuth } from "../middleware/authMiddleware";

export const authRoutes = Router();

authRoutes.get("/me", me);
authRoutes.post("/auth/login", login);
authRoutes.post("/auth/refresh", refresh);
authRoutes.post("/auth/logout", logout);
authRoutes.post("/auth/logout-global", requireAuth(), logoutGlobal);
authRoutes.post("/sessions/heartbeat", requireAuth(), heartbeat);
authRoutes.post("/auth/change-password", requireAuth(), changePassword);
authRoutes.post("/auth/forgot-password", forgotPassword);
authRoutes.post("/auth/reset-password", resetPassword);
authRoutes.get("/auth/cookie-policy", authCookieNames);
