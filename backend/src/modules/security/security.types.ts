export type SecurityRole = "ADMIN" | "OPERATOR" | "AUDITOR" | "VIEWER" | "SERVICE";

export type SecurityPermission =
  | "READ_MARKET"
  | "READ_JOURNAL"
  | "READ_SECURITY"
  | "MANAGE_CONNECTORS"
  | "MANAGE_SETTINGS"
  | "REQUEST_LIVE_MODE"
  | "TRIGGER_EMERGENCY_STOP"
  | "ROTATE_SECRETS"
  | "VIEW_AUDIT_LOGS";

export type SecuritySeverity = "info" | "warning" | "critical";

export type SecurityDecisionStatus = "ALLOW" | "DENY";

export type FailSafeState = "SAFE" | "WARNING" | "DANGER" | "STOPPED";

export type RuntimeMode = "LIVE" | "DEMO" | "MOCK";

export interface AuthPrincipal {
  readonly id: string;
  readonly role: SecurityRole;
  readonly permissions: readonly SecurityPermission[];
  readonly sessionId?: string;
}

export interface SecurityRequest {
  readonly ip: string;
  readonly method: string;
  readonly path: string;
  readonly origin?: string;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly body?: unknown;
  readonly principal?: AuthPrincipal;
}

export interface SecurityDecision {
  readonly status: SecurityDecisionStatus;
  readonly reason: string;
  readonly severity: SecuritySeverity;
  readonly recommendedAction: string;
}

export interface EncryptedSecret {
  readonly id: string;
  readonly provider: string;
  readonly keyName: string;
  readonly purpose: string;
  readonly algorithm: string;
  readonly ciphertext: string;
  readonly iv: string;
  readonly maskedValue: string;
  readonly createdAt: string;
  readonly rotatedAt?: string;
}

export interface ApiKeyMetadata {
  readonly id: string;
  readonly provider: string;
  readonly keyName: string;
  readonly maskedValue: string;
  readonly createdAt: string;
  readonly rotatedAt?: string;
}

export interface SecurityAuditRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly event: string;
  readonly actorId: string;
  readonly severity: SecuritySeverity;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface RateLimitRule {
  readonly windowMs: number;
  readonly maxRequests: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly key: string;
  readonly remaining: number;
  readonly resetAt: string;
  readonly retryAfterMs: number;
}

export interface CorsPolicy {
  readonly allowedOrigins: readonly string[];
  readonly allowCredentials: boolean;
}

export interface EnvironmentValidationResult {
  readonly valid: boolean;
  readonly missing: readonly string[];
  readonly placeholders: readonly string[];
  readonly warnings: readonly string[];
}

export interface TradingSafetyInput {
  readonly runtimeMode: RuntimeMode;
  readonly enableLiveTrading: boolean;
  readonly liveConfirmationReceived: boolean;
  readonly emergencyStopActive: boolean;
  readonly killSwitchActive: boolean;
  readonly dataSource: RuntimeMode;
  readonly dataCoherent: boolean;
  readonly spread: number | null;
  readonly maxSpread: number;
  readonly slippage: number | null;
  readonly maxSlippage: number;
  readonly drawdownPercent: number;
  readonly maxDrawdownPercent: number;
  readonly journalAvailable: boolean;
}

export interface TradingSafetyResult {
  readonly allowed: boolean;
  readonly failSafeState: FailSafeState;
  readonly blocks: readonly SecurityDecision[];
}

export interface SecurityHeaders {
  readonly "Content-Security-Policy": string;
  readonly "X-Content-Type-Options": "nosniff";
  readonly "X-Frame-Options": "DENY";
  readonly "X-XSS-Protection": "0";
  readonly "Referrer-Policy": "no-referrer";
  readonly "Cross-Origin-Opener-Policy": "same-origin";
}
