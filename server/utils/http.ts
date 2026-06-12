import type { Request, Response } from "express";

export function parseNumberQuery(
  req: Request,
  key: string,
  fallback: number
): number {
  const rawValue = req.query[key];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sendJson<T>(res: Response, payload: T) {
  return res.status(200).json(payload);
}
