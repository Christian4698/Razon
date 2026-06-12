import { AuditSecurityService } from "./audit-security.service";
import { AuthGuard, type TokenValidator } from "./auth.guard";
import { PermissionsGuard } from "./permissions.guard";
import { RateLimitService } from "./rate-limit.service";
import type {
  CorsPolicy,
  EnvironmentValidationResult,
  SecurityDecision,
  SecurityHeaders,
  SecurityRequest,
  TradingSafetyInput,
  TradingSafetyResult,
} from "./security.types";

const requiredEnvironmentVariables = [
  "APP_SECRET_KEY",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
  "DATABASE_URL",
  "ENABLE_LIVE_TRADING",
  "MODE_SIMULATION",
];

const placeholderPattern = /change-me|your-|example|placeholder|changeme/i;

function deny(reason: string, recommendedAction: string, severity: "warning" | "critical" = "critical"): SecurityDecision {
  return {
    status: "DENY",
    reason,
    severity,
    recommendedAction,
  };
}

export class SecurityService {
  readonly audit = new AuditSecurityService();
  readonly permissions = new PermissionsGuard();
  readonly rateLimit = new RateLimitService();
  readonly auth: AuthGuard;

  constructor(tokenValidator?: TokenValidator) {
    this.auth = new AuthGuard(tokenValidator);
  }

  validateEnvironment(env: Readonly<Record<string, string | undefined>>): EnvironmentValidationResult {
    const missing = requiredEnvironmentVariables.filter(key => !env[key]);
    const placeholders = requiredEnvironmentVariables.filter(key => env[key] && placeholderPattern.test(String(env[key])));
    const warnings = [
      env.ENABLE_LIVE_TRADING === "true" ? "ENABLE_LIVE_TRADING=true requires explicit production approval." : "",
      env.MODE_SIMULATION !== "true" && env.ENABLE_LIVE_TRADING !== "true"
        ? "MODE_SIMULATION should remain true until production readiness is approved."
        : "",
    ].filter(Boolean);

    return {
      valid: missing.length === 0 && placeholders.length === 0,
      missing,
      placeholders,
      warnings,
    };
  }

  validateCorsOrigin(origin: string | undefined, policy: CorsPolicy): SecurityDecision {
    if (!origin) return { status: "ALLOW", reason: "Server-to-server request without browser origin.", severity: "info", recommendedAction: "Continue." };
    if (policy.allowedOrigins.includes(origin)) return { status: "ALLOW", reason: "Origin allowed.", severity: "info", recommendedAction: "Continue." };
    return deny(`CORS origin '${origin}' is not allowed.`, "Add the origin to a reviewed allowlist or reject the request.", "warning");
  }

  validateInput(input: unknown): SecurityDecision {
    const serialized = JSON.stringify(input ?? {});
    if (serialized.length > 200_000) return deny("Input payload is too large.", "Reject request and review client behavior.", "warning");
    if (/<script|javascript:|onerror=|onload=/i.test(serialized)) return deny("Potential XSS payload detected.", "Reject request and sanitize input.", "critical");
    if (/\b(drop table|truncate table|delete from)\b/i.test(serialized)) return deny("Potential destructive SQL-like payload detected.", "Reject request and use structured validation.", "critical");
    return { status: "ALLOW", reason: "Input passed baseline validation.", severity: "info", recommendedAction: "Continue with schema validation." };
  }

  evaluateRequest(
    request: SecurityRequest,
    policy: CorsPolicy,
  ): readonly SecurityDecision[] {
    const rate = this.rateLimit.checkLimit(`${request.ip}:${request.path}`);
    const decisions = [
      this.validateCorsOrigin(request.origin, policy),
      this.validateInput(request.body),
      rate.allowed
        ? { status: "ALLOW", reason: "Rate limit ok.", severity: "info", recommendedAction: "Continue." } as const
        : deny("Rate limit exceeded.", `Retry after ${rate.retryAfterMs}ms.`, "warning"),
    ];

    this.audit.record("SECURITY_REQUEST_EVALUATED", request.principal?.id ?? "anonymous", "info", {
      path: request.path,
      decisions,
      rate,
    });

    return decisions;
  }

  evaluateTradingSafety(input: TradingSafetyInput): TradingSafetyResult {
    const blocks: SecurityDecision[] = [];

    if (input.runtimeMode === "LIVE" && !input.enableLiveTrading) {
      blocks.push(deny("LIVE trading is disabled by default.", "Set ENABLE_LIVE_TRADING=true only after production approval."));
    }
    if (input.runtimeMode === "LIVE" && !input.liveConfirmationReceived) {
      blocks.push(deny("LIVE mode requires explicit confirmation.", "Require manual confirmation before LIVE."));
    }
    if (input.emergencyStopActive) blocks.push(deny("Emergency Stop is active.", "Keep trading stopped until reviewed."));
    if (input.killSwitchActive) blocks.push(deny("Persistent Kill Switch is active.", "Investigate and reset only with admin approval."));
    if (input.dataSource === "MOCK") blocks.push(deny("Execution is blocked when data source is MOCK.", "Use verified LIVE or DEMO data only."));
    if (!input.dataCoherent) blocks.push(deny("Market data is incoherent.", "Refresh data and validate price/spread consistency."));
    if (input.spread === null || input.spread > input.maxSpread) blocks.push(deny("Spread is dangerous or unavailable.", "Wait for normal spread conditions.", "warning"));
    if (input.slippage === null || input.slippage > input.maxSlippage) blocks.push(deny("Slippage is dangerous or unavailable.", "Wait for normal execution conditions.", "warning"));
    if (input.drawdownPercent >= input.maxDrawdownPercent) blocks.push(deny("Drawdown limit reached.", "Stop trading and review risk.", "critical"));
    if (!input.journalAvailable) blocks.push(deny("Journal is unavailable.", "Restore journaling before any future execution."));

    const failSafeState = input.emergencyStopActive || input.killSwitchActive
      ? "STOPPED"
      : blocks.some(block => block.severity === "critical")
        ? "DANGER"
        : blocks.length
          ? "WARNING"
          : "SAFE";

    return {
      allowed: blocks.length === 0,
      failSafeState,
      blocks,
    };
  }

  buildSecurityHeaders(): SecurityHeaders {
    return {
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "0",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Opener-Policy": "same-origin",
    };
  }
}

export function createSecurityService(tokenValidator?: TokenValidator) {
  return new SecurityService(tokenValidator);
}
