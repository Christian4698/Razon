import type { NextFunction, Request, Response } from "express";
import { authSessionService, type AuthSessionSnapshot } from "../../backend/src/modules/security/auth-session.service";
import type { UserRole } from "../../backend/src/modules/users";

export const accessCookieName = "razon_access";
export const refreshCookieName = "razon_refresh";

export interface AuthRequestContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly role: UserRole;
  readonly snapshot: AuthSessionSnapshot;
}

export type RequestWithAuth = Request & {
  auth?: AuthRequestContext;
};

function isSecureRequest(req: Request) {
  return req.secure || req.header("x-forwarded-proto") === "https" || process.env.NODE_ENV === "production";
}

function isCrossSiteFrontend(req: Request) {
  const origin = req.header("origin");
  if (!origin) return false;

  const host = req.header("host");
  if (!host) return false;

  try {
    return new URL(origin).host !== host;
  } catch {
    return false;
  }
}

function parseCookies(req: Request) {
  const header = req.header("cookie") ?? "";
  return Object.fromEntries(
    header
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  ) as Record<string, string | undefined>;
}

export function cookieValue(req: Request, name: string) {
  return parseCookies(req)[name] ?? null;
}

function cookieBase(req: Request) {
  const crossSite = isCrossSiteFrontend(req) || process.env.AUTH_COOKIE_SAMESITE === "none";
  return {
    httpOnly: true,
    sameSite: crossSite ? "none" as const : "lax" as const,
    secure: crossSite ? true : isSecureRequest(req),
    path: "/",
  };
}

export function setAccessCookie(req: Request, res: Response, token: string, expiresAt: string) {
  res.cookie(accessCookieName, token, {
    ...cookieBase(req),
    expires: new Date(expiresAt),
  });
}

export function setRefreshCookie(req: Request, res: Response, token: string, expiresAt: string) {
  res.cookie(refreshCookieName, token, {
    ...cookieBase(req),
    expires: new Date(expiresAt),
  });
}

export function clearAuthCookies(req: Request, res: Response) {
  res.clearCookie(accessCookieName, cookieBase(req));
  res.clearCookie(refreshCookieName, cookieBase(req));
}

export function authenticateRequest(req: Request, res: Response): AuthRequestContext | null {
  const accessToken = cookieValue(req, accessCookieName);
  const access = authSessionService.authenticateAccessToken(accessToken);
  if (access) {
    return {
      userId: access.user.id,
      sessionId: access.sessionId,
      role: access.user.role,
      snapshot: authSessionService.snapshot(access.user.id, access.sessionId, access.accessExpiresAt, access.refreshExpiresAt),
    };
  }

  const refreshed = authSessionService.refresh(cookieValue(req, refreshCookieName));
  if (!refreshed) return null;

  setAccessCookie(req, res, refreshed.accessToken, refreshed.accessExpiresAt);
  return {
    userId: refreshed.user.id,
    sessionId: refreshed.sessionId,
    role: refreshed.user.role,
    snapshot: refreshed.snapshot,
  };
}

export function attachAuthContext(req: RequestWithAuth, res: Response, next: NextFunction) {
  const context = authenticateRequest(req, res);
  if (context) req.auth = context;
  next();
}

function wantsHtml(req: Request) {
  return Boolean(
    req.accepts(["html", "json"]) === "html" &&
    !req.path.startsWith("/api") &&
    !req.originalUrl.startsWith("/api")
  );
}

export function requireAuth() {
  return (req: RequestWithAuth, res: Response, next: NextFunction) => {
    const context = req.auth ?? authenticateRequest(req, res);
    if (!context) {
      clearAuthCookies(req, res);
      if (wantsHtml(req)) {
        res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl || "/dashboard")}`);
        return;
      }

      res.status(401).json({
        authenticated: false,
        error: "AUTH_REQUIRED",
        message: "Authentication is required.",
        liveExecutionEnabled: false,
        automaticTradingAllowed: false,
        secretsExposed: false,
      });
      return;
    }

    req.auth = context;
    next();
  };
}

export function requireApiAuthJson() {
  return (req: RequestWithAuth, res: Response, next: NextFunction) => {
    const context = req.auth ?? authenticateRequest(req, res);
    if (!context) {
      clearAuthCookies(req, res);
      res.status(401).json({ error: "AUTH_REQUIRED" });
      return;
    }

    req.auth = context;
    next();
  };
}

export function requireAdmin() {
  const auth = requireAuth();
  return (req: RequestWithAuth, res: Response, next: NextFunction) => {
    auth(req, res, () => {
      if (req.auth?.role === "OWNER" || req.auth?.role === "ADMIN") {
        next();
        return;
      }

      res.status(403).json({
        error: "ADMIN_REQUIRED",
        message: "Admin access is required.",
        liveExecutionEnabled: false,
        automaticTradingAllowed: false,
        secretsExposed: false,
      });
    });
  };
}

export function requireLicense() {
  const auth = requireAuth();
  return (req: RequestWithAuth, res: Response, next: NextFunction) => {
    auth(req, res, () => {
      const snapshot = req.auth?.snapshot;
      if (!snapshot) {
        res.status(401).json({ error: "AUTH_REQUIRED" });
        return;
      }

      if (snapshot.license.status === "ACTIVE" || snapshot.license.status === "EXPIRED") {
        next();
        return;
      }

      const status = snapshot.license.status;
      res.status(status === "PENDING" || status === "MISSING" ? 402 : 403).json({
        error:
          status === "PENDING" || status === "MISSING"
            ? "LICENSE_ACTIVATION_REQUIRED"
            : "LICENSE_ACCESS_DENIED",
        status,
        message: snapshot.license.message,
        license: snapshot.license,
        permissions: snapshot.permissions,
        liveExecutionEnabled: false,
        automaticTradingAllowed: false,
        secretsExposed: false,
      });
    });
  };
}
