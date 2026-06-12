import { Router } from "express";
import {
  activateLicense,
  createAdminUser,
  createLicense,
  deleteAdminUser,
  forceLogoutAdminUser,
  getLicenseStatus,
  listAdminAuditLogs,
  listAdminDevices,
  listAdminLicenses,
  listAdminUsers,
  renewLicense,
  revokeLicense,
  suspendLicense,
  suspendAdminUser,
  updateAdminUser,
} from "../controllers/licensesController";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware";

export const licensesRoutes = Router();

licensesRoutes.post("/licenses/create", requireAdmin(), createLicense);
licensesRoutes.post("/licenses/activate", requireAuth(), activateLicense);
licensesRoutes.get("/licenses/status", requireAuth(), getLicenseStatus);
licensesRoutes.post("/licenses/renew", requireAdmin(), renewLicense);
licensesRoutes.post("/licenses/suspend", requireAdmin(), suspendLicense);
licensesRoutes.post("/licenses/revoke", requireAdmin(), revokeLicense);
licensesRoutes.get("/admin/licenses", requireAdmin(), listAdminLicenses);
licensesRoutes.get("/admin/users", requireAdmin(), listAdminUsers);
licensesRoutes.post("/admin/users", requireAdmin(), createAdminUser);
licensesRoutes.patch("/admin/users/:id", requireAdmin(), updateAdminUser);
licensesRoutes.delete("/admin/users/:id", requireAdmin(), deleteAdminUser);
licensesRoutes.post("/admin/users/:id/suspend", requireAdmin(), suspendAdminUser);
licensesRoutes.post("/admin/users/:id/logout-global", requireAdmin(), forceLogoutAdminUser);
licensesRoutes.get("/admin/devices", requireAdmin(), listAdminDevices);
licensesRoutes.get("/admin/audit-logs", requireAdmin(), listAdminAuditLogs);
