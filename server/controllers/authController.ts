import type { Request, Response } from "express";
import { authSessionService } from "../../backend/src/modules/security/auth-session.service";
import {
  accessCookieName,
  authenticateRequest,
  clearAuthCookies,
  cookieValue,
  refreshCookieName,
  setAccessCookie,
  setRefreshCookie,
  type RequestWithAuth,
} from "../middleware/authMiddleware";

function body(req: Request) {
  return (req.body ?? {}) as Record<string, unknown>;
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function booleanField(value: unknown) {
  return value === true || value === "true";
}

function clientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "local";
}

export function login(req: Request, res: Response) {
  const payload = body(req);
  const identifier = stringField(payload.identifier || payload.email || payload.username);
  const password = stringField(payload.password);
  if (!identifier || !password) {
    return res.status(400).json({
      ok: false,
      error: "LOGIN_FIELDS_REQUIRED",
      message: "Email/username and password are required.",
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
      secretsExposed: false,
    });
  }

  const result = authSessionService.login({
    identifier,
    password,
    rememberMe: booleanField(payload.rememberMe),
    ip: clientIp(req),
  });
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.code,
      message: result.message,
      retryAfterMs: result.retryAfterMs,
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
      secretsExposed: false,
    });
  }

  setAccessCookie(req, res, result.accessToken, result.accessExpiresAt);
  setRefreshCookie(req, res, result.refreshToken, result.refreshExpiresAt);
  return res.json(result.snapshot);
}

export function me(req: RequestWithAuth, res: Response) {
  const context = req.auth ?? authenticateRequest(req, res);
  if (!context) {
    clearAuthCookies(req, res);
    return res.status(401).json({
      authenticated: false,
      error: "AUTH_REQUIRED",
      message: "Authentication is required.",
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
      secretsExposed: false,
    });
  }

  req.auth = context;
  return res.json(context.snapshot);
}

export function refresh(req: Request, res: Response) {
  const refreshed = authSessionService.refresh(cookieValue(req, refreshCookieName));
  if (!refreshed) {
    clearAuthCookies(req, res);
    return res.status(401).json({
      authenticated: false,
      error: "SESSION_EXPIRED",
      message: "Session expired.",
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
      secretsExposed: false,
    });
  }

  setAccessCookie(req, res, refreshed.accessToken, refreshed.accessExpiresAt);
  return res.json(refreshed.snapshot);
}

export function logout(req: Request, res: Response) {
  authSessionService.logout(cookieValue(req, refreshCookieName));
  clearAuthCookies(req, res);
  return res.json({
    ok: true,
    authenticated: false,
    liveExecutionEnabled: false,
    automaticTradingAllowed: false,
    secretsExposed: false,
  });
}

export function logoutGlobal(req: RequestWithAuth, res: Response) {
  if (req.auth?.userId) authSessionService.logoutGlobal(req.auth.userId);
  authSessionService.logout(cookieValue(req, refreshCookieName));
  clearAuthCookies(req, res);
  return res.json({
    ok: true,
    authenticated: false,
    message: "All sessions were logged out.",
    liveExecutionEnabled: false,
    automaticTradingAllowed: false,
    secretsExposed: false,
  });
}

export function changePassword(req: RequestWithAuth, res: Response) {
  if (!req.auth) {
    return res.status(401).json({ error: "AUTH_REQUIRED", liveExecutionEnabled: false, automaticTradingAllowed: false });
  }

  const payload = body(req);
  const result = authSessionService.changePassword(
    req.auth.userId,
    stringField(payload.currentPassword),
    stringField(payload.newPassword),
  );
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.code,
      message: result.message,
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
      secretsExposed: false,
    });
  }

  const context = authenticateRequest(req, res);
  return res.json({
    ok: true,
    message: result.message,
    me: context?.snapshot ?? null,
    liveExecutionEnabled: false,
    automaticTradingAllowed: false,
    secretsExposed: false,
  });
}

export function forgotPassword(req: Request, res: Response) {
  const result = authSessionService.requestPasswordReset(stringField(body(req).identifier || body(req).email));
  return res.json({
    ok: true,
    message: result.message,
    liveExecutionEnabled: false,
    automaticTradingAllowed: false,
    secretsExposed: false,
  });
}

export function resetPassword(req: Request, res: Response) {
  const payload = body(req);
  const result = authSessionService.resetPassword(
    stringField(payload.token),
    stringField(payload.newPassword),
  );
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.code,
      message: result.message,
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
      secretsExposed: false,
    });
  }

  clearAuthCookies(req, res);
  return res.json({
    ok: true,
    message: result.message,
    liveExecutionEnabled: false,
    automaticTradingAllowed: false,
    secretsExposed: false,
  });
}

export function authCookieNames(_req: Request, res: Response) {
  return res.json({
    accessCookie: accessCookieName,
    refreshCookie: refreshCookieName,
    httpOnly: true,
    liveExecutionEnabled: false,
    automaticTradingAllowed: false,
    secretsExposed: false,
  });
}
