import type { AuthPrincipal, SecurityDecision, SecurityRequest } from "./security.types";

export type TokenValidator = (token: string) => AuthPrincipal | null;

export class AuthGuard {
  constructor(private readonly validateToken: TokenValidator = () => null) {}

  authenticate(request: SecurityRequest): AuthPrincipal | null {
    const authorization = request.headers?.Authorization ?? request.headers?.authorization;
    if (!authorization?.startsWith("Bearer ")) return null;

    const token = authorization.slice("Bearer ".length).trim();
    if (!token) return null;
    return this.validateToken(token);
  }

  requireAuthenticated(request: SecurityRequest): SecurityDecision {
    const principal = request.principal ?? this.authenticate(request);
    if (principal) {
      return {
        status: "ALLOW",
        reason: `Authenticated as ${principal.role}.`,
        severity: "info",
        recommendedAction: "Continue.",
      };
    }

    return {
      status: "DENY",
      reason: "Authentication is required.",
      severity: "critical",
      recommendedAction: "Provide a valid bearer token from the backend auth provider.",
    };
  }
}
