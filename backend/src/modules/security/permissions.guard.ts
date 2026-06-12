import type { AuthPrincipal, SecurityDecision, SecurityPermission, SecurityRole } from "./security.types";

const rolePermissions: Record<SecurityRole, readonly SecurityPermission[]> = {
  ADMIN: [
    "READ_MARKET",
    "READ_JOURNAL",
    "READ_SECURITY",
    "MANAGE_CONNECTORS",
    "MANAGE_SETTINGS",
    "REQUEST_LIVE_MODE",
    "TRIGGER_EMERGENCY_STOP",
    "ROTATE_SECRETS",
    "VIEW_AUDIT_LOGS",
  ],
  OPERATOR: [
    "READ_MARKET",
    "READ_JOURNAL",
    "READ_SECURITY",
    "MANAGE_CONNECTORS",
    "TRIGGER_EMERGENCY_STOP",
  ],
  AUDITOR: ["READ_MARKET", "READ_JOURNAL", "READ_SECURITY", "VIEW_AUDIT_LOGS"],
  VIEWER: ["READ_MARKET", "READ_JOURNAL"],
  SERVICE: ["READ_MARKET", "READ_SECURITY", "VIEW_AUDIT_LOGS"],
};

export class PermissionsGuard {
  permissionsForRole(role: SecurityRole): readonly SecurityPermission[] {
    return rolePermissions[role];
  }

  hasPermission(principal: AuthPrincipal, permission: SecurityPermission): boolean {
    return principal.permissions.includes(permission) || rolePermissions[principal.role].includes(permission);
  }

  requirePermission(principal: AuthPrincipal | null | undefined, permission: SecurityPermission): SecurityDecision {
    if (!principal) {
      return {
        status: "DENY",
        reason: "No authenticated principal.",
        severity: "critical",
        recommendedAction: "Authenticate before checking permissions.",
      };
    }

    if (this.hasPermission(principal, permission)) {
      return {
        status: "ALLOW",
        reason: `${principal.role} can perform ${permission}.`,
        severity: "info",
        recommendedAction: "Continue.",
      };
    }

    return {
      status: "DENY",
      reason: `${principal.role} cannot perform ${permission}.`,
      severity: "warning",
      recommendedAction: "Request elevated approval from an administrator.",
    };
  }
}
