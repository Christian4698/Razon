import type { NextFunction, Request, Response } from "express";

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "https://razon.generaltechconsult.com",
];

function configuredOrigins() {
  const configured = [process.env.CORS_ORIGIN, process.env.APP_BASE_URL]
    .filter(Boolean)
    .join(",");

  return `${defaultAllowedOrigins.join(",")},${configured}`
    .split(",")
    .map(origin => origin.trim())
    .filter((origin, index, origins) => Boolean(origin) && origins.indexOf(origin) === index);
}

function wildcardToRegex(origin: string) {
  const escaped = origin
    .split("*")
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^.]+");
  return new RegExp(`^${escaped}$`, "i");
}

function isAllowedOrigin(origin: string, allowedOrigins: readonly string[]) {
  return allowedOrigins.some(allowed => {
    if (allowed === origin) return true;
    if (allowed.includes("*")) return wildcardToRegex(allowed).test(origin);
    return false;
  });
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.header("origin");
  const allowedOrigins = configuredOrigins();
  if (origin && isAllowedOrigin(origin, allowedOrigins)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-RAZON-Device-Id, X-RAZON-Session-Id");
    res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }

  if (req.method === "OPTIONS") {
    res.status(origin && isAllowedOrigin(origin, allowedOrigins) ? 204 : 403).end();
    return;
  }

  next();
}
