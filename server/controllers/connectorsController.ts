import crypto from "crypto";
import type { Request, Response } from "express";
import { accessCookieName, authenticateRequest, refreshCookieName, type RequestWithAuth } from "../middleware/authMiddleware";
import { configuredOrigins, isAllowedOrigin } from "../middleware/corsMiddleware";
import { derivDemoReadOnlyClient } from "../services/deriv/DerivDemoReadOnlyClient";
import {
  deleteConnectorSecret,
  disconnectConnectorSecret,
  getCurrentUserScope,
  getLicenseSnapshot,
  getSecretMetadata,
  isConnectorId,
  markConnectorSecretTest,
  readConnectorSecret,
  saveConnectorSecret,
  saveConnectorOAuthSecret,
  type ConnectorId,
  type ConnectorSecretStatus,
  type CurrentUserScope,
  type LicenseSnapshot,
} from "../services/connectors/connectorSecretsRepository";
import { sendJson } from "../utils/http";

function now() {
  return new Date().toISOString();
}

interface DerivOAuthState {
  readonly user: CurrentUserScope;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  readonly createdAt: number;
}

interface DerivOAuthTokenResponse {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly error?: string;
  readonly error_description?: string;
}

const derivOAuthStates = new Map<string, DerivOAuthState>();
const DERIV_OAUTH_AUTH_URL = "https://auth.deriv.com/oauth2/auth";
const DERIV_OAUTH_TOKEN_URL = "https://auth.deriv.com/oauth2/token";

function base64Url(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function oauthClientId() {
  const value = process.env.DERIV_OAUTH_CLIENT_ID?.trim() || process.env.DERIV_APP_ID?.trim() || "";
  return /^[a-zA-Z0-9_-]+$/.test(value) ? value : "";
}

function publicBaseUrl(req: Request) {
  const configured =
    process.env.DERIV_OAUTH_PUBLIC_BASE_URL?.trim() ||
    process.env.API_PUBLIC_URL?.trim() ||
    process.env.API_BASE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const protocol = req.header("x-forwarded-proto") || req.protocol || "http";
  return `${protocol}://${req.get("host")}`;
}

function derivOAuthRedirectUri(req: Request) {
  return process.env.DERIV_OAUTH_REDIRECT_URI?.trim() || `${publicBaseUrl(req)}/api/connectors/deriv-demo/oauth/callback`;
}

function pruneDerivOAuthStates() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [state, value] of Array.from(derivOAuthStates.entries())) {
    if (value.createdAt < cutoff) derivOAuthStates.delete(state);
  }
}

async function exchangeDerivOAuthCode(params: {
  readonly code: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  readonly clientId: string;
}): Promise<DerivOAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  });
  const clientSecret = process.env.DERIV_OAUTH_CLIENT_SECRET?.trim();
  if (clientSecret) body.set("client_secret", clientSecret);

  const response = await fetch(DERIV_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as DerivOAuthTokenResponse;
  if (!response.ok || !payload.access_token) {
    const message = payload.error_description || payload.error || `Deriv OAuth token exchange returned ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

type RuntimeMode = "MOCK" | "DEMO" | "REAL_DATA";
type ConnectorStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "CONNECTED_DEMO" | "DEGRADED" | "ERROR";
type DataQuality = "GOOD" | "HEALTHY" | "DEGRADED" | "STALE" | "INVALID" | "DISCONNECTED";

interface ConnectorHealthCard {
  readonly id: ConnectorId;
  readonly name: string;
  readonly provider: "Deriv" | "MT5" | "Forex" | "Future Providers";
  readonly accountKind: "DEMO" | "REAL" | "API" | "FUTURE";
  readonly ownerScope: "CURRENT_USER";
  readonly ownerUserId: string;
  readonly licenseStatus: LicenseSnapshot["status"];
  readonly connectorStatus: ConnectorStatus;
  readonly runtimeMode: RuntimeMode;
  readonly dataQuality: DataQuality;
  readonly sourceStatus: "CONNECTED" | "DELAYED" | "MOCK" | "DISCONNECTED" | "UNKNOWN";
  readonly syncStatus: "IN_SYNC" | "LAGGING" | "OUT_OF_SYNC" | "UNKNOWN";
  readonly latencyMs: number | null;
  readonly lastTickAt: string | null;
  readonly lastCandleAt: string | null;
  readonly freshnessSeconds: number | null;
  readonly readOnly: true;
  readonly readOnlyStatus: "READ_ONLY";
  readonly liveBlocked: true;
  readonly executionStatus: "LIVE_BLOCKED";
  readonly liveTradingAllowed: false;
  readonly orderPlacementAllowed: false;
  readonly secretStatus: ConnectorSecretStatus;
  readonly secretSaved: boolean;
  readonly secretLastUpdatedAt: string | null;
  readonly secretMaskedPreview?: string;
  readonly secretLocation: "BACKEND_ONLY";
  readonly tokenVisible: false;
  readonly allowedDevicesCount: number | null;
  readonly activeSessionsCount: number | null;
  readonly activeDevicesCount: number | null;
  readonly warnings: readonly string[];
  readonly message: string;
  readonly generatedAt: string;
  /**
   * Legacy dashboard fields remain for existing cards. They are derived from the
   * safe connector model above and do not contain secret material.
   */
  readonly state: "connected" | "disconnected" | "delayed";
  readonly safetyStatus: "DISCONNECTED" | "CONNECTED_DEMO" | "CONNECTED_REAL_READONLY" | "LIVE_BLOCKED";
  readonly accessMode: "DEMO" | "REAL";
  readonly source: "DEMO" | "MOCK" | "LIVE" | "PERSONAL_DERIV_DEMO" | "PERSONAL_DERIV_DEMO_OAUTH";
  readonly readonlyByDefault: true;
  readonly saved?: boolean;
  readonly connected?: boolean;
  readonly lastTestAt?: string | null;
  readonly accountType?: "DEMO" | "REAL" | "UNKNOWN" | null;
  readonly status?: "CONNECTED" | "DISCONNECTED";
  readonly personalSource?: "PERSONAL_DERIV_DEMO" | "PERSONAL_DERIV_DEMO_OAUTH" | null;
  readonly loginid?: string | null;
  readonly brokerLoginId?: string | null;
  readonly accountId?: string | null;
  readonly authType?: "PAT" | "OAUTH" | "UNKNOWN";
}

function legacyState(status: ConnectorStatus): ConnectorHealthCard["state"] {
  if (status === "CONNECTED" || status === "CONNECTED_DEMO") return "connected";
  if (status === "DEGRADED") return "delayed";
  return "disconnected";
}

function legacySafety(status: ConnectorStatus, runtimeMode: RuntimeMode): ConnectorHealthCard["safetyStatus"] {
  if (runtimeMode === "REAL_DATA" && (status === "CONNECTED" || status === "CONNECTED_DEMO")) return "CONNECTED_REAL_READONLY";
  if (status === "CONNECTED" || status === "CONNECTED_DEMO") return "CONNECTED_DEMO";
  return "DISCONNECTED";
}

function legacySource(runtimeMode: RuntimeMode): ConnectorHealthCard["source"] {
  if (runtimeMode === "REAL_DATA") return "LIVE";
  return runtimeMode;
}

function buildWarnings({
  connectorStatus,
  runtimeMode,
  secretStatus,
  license,
  appIdConfigured = true,
}: {
  readonly connectorStatus: ConnectorStatus;
  readonly runtimeMode: RuntimeMode;
  readonly secretStatus: ConnectorSecretStatus;
  readonly license: LicenseSnapshot;
  readonly appIdConfigured?: boolean;
}) {
  const warnings: string[] = [];

  if (runtimeMode === "MOCK") warnings.push("MOCK_DATA");
  if (runtimeMode === "DEMO") warnings.push("DEMO READ-ONLY");
  if (runtimeMode === "REAL_DATA") warnings.push("REAL DATA BUT EXECUTION OFF");
  if (connectorStatus === "DISCONNECTED") warnings.push("DISCONNECTED");
  if (secretStatus === "MISSING") warnings.push("TOKEN MISSING");
  if (!appIdConfigured) warnings.push("APP ID MISSING");
  if (license.status === "MISSING") warnings.push("LICENSE REQUIRED");
  if (license.status === "EXPIRED") warnings.push("LICENSE EXPIRED");
  if (
    license.deviceLimit !== null &&
    license.activeDevices !== null &&
    license.deviceLimit > 0 &&
    license.activeDevices >= license.deviceLimit
  ) {
    warnings.push("DEVICE LIMIT REACHED");
  }
  if (
    license.sessionLimit !== null &&
    license.activeSessions !== null &&
    license.sessionLimit > 0 &&
    license.activeSessions >= license.sessionLimit
  ) {
    warnings.push("SESSION LIMIT REACHED");
  }

  return warnings;
}

function connectorCard(params: {
  readonly id: ConnectorId;
  readonly name: string;
  readonly provider: ConnectorHealthCard["provider"];
  readonly accountKind: ConnectorHealthCard["accountKind"];
  readonly user: CurrentUserScope;
  readonly license: LicenseSnapshot;
  readonly connectorStatus: ConnectorStatus;
  readonly runtimeMode: RuntimeMode;
  readonly dataQuality: DataQuality;
  readonly sourceStatus: ConnectorHealthCard["sourceStatus"];
  readonly syncStatus?: ConnectorHealthCard["syncStatus"];
  readonly latencyMs?: number | null;
  readonly lastTickAt?: string | null;
  readonly lastCandleAt?: string | null;
  readonly freshnessSeconds?: number | null;
  readonly secretStatus?: ConnectorSecretStatus;
  readonly secretSaved?: boolean;
  readonly secretLastUpdatedAt?: string | null;
  readonly secretMaskedPreview?: string;
  readonly appIdConfigured?: boolean;
  readonly message: string;
}): ConnectorHealthCard {
  const secretStatus = params.secretStatus ?? "MISSING";
  const accessMode = params.accountKind === "REAL" ? "REAL" : "DEMO";

  return {
    id: params.id,
    name: params.name,
    provider: params.provider,
    accountKind: params.accountKind,
    ownerScope: params.user.scope,
    ownerUserId: params.user.userId,
    licenseStatus: params.license.status,
    connectorStatus: params.connectorStatus,
    runtimeMode: params.runtimeMode,
    dataQuality: params.dataQuality,
    sourceStatus: params.sourceStatus,
    syncStatus: params.syncStatus ?? (params.connectorStatus === "CONNECTED" || params.connectorStatus === "CONNECTED_DEMO" ? "IN_SYNC" : "UNKNOWN"),
    latencyMs: params.latencyMs ?? null,
    lastTickAt: params.lastTickAt ?? null,
    lastCandleAt: params.lastCandleAt ?? null,
    freshnessSeconds: params.freshnessSeconds ?? null,
    readOnly: true,
    readOnlyStatus: "READ_ONLY",
    liveBlocked: true,
    executionStatus: "LIVE_BLOCKED",
    liveTradingAllowed: false,
    orderPlacementAllowed: false,
    secretStatus,
    secretSaved: params.secretSaved ?? false,
    secretLastUpdatedAt: params.secretLastUpdatedAt ?? null,
    ...(params.secretMaskedPreview ? { secretMaskedPreview: params.secretMaskedPreview } : {}),
    secretLocation: "BACKEND_ONLY",
    tokenVisible: false,
    allowedDevicesCount: params.license.deviceLimit,
    activeSessionsCount: params.license.activeSessions,
    activeDevicesCount: params.license.activeDevices,
    warnings: buildWarnings({
      connectorStatus: params.connectorStatus,
      runtimeMode: params.runtimeMode,
      secretStatus,
      license: params.license,
      appIdConfigured: params.appIdConfigured,
    }),
    message: params.message,
    generatedAt: now(),
    state: legacyState(params.connectorStatus),
    safetyStatus: legacySafety(params.connectorStatus, params.runtimeMode),
    accessMode,
    source: legacySource(params.runtimeMode),
    readonlyByDefault: true,
  };
}

function safeSecretFields(metadata: ReturnType<typeof getSecretMetadata>) {
  return {
    secretStatus: metadata.status,
    secretSaved: metadata.saved,
    secretLastUpdatedAt: metadata.lastUpdatedAt,
    ...(metadata.maskedPreview ? { secretMaskedPreview: metadata.maskedPreview } : {}),
    saved: metadata.saved,
    connected: metadata.connected ?? false,
    lastTestAt: metadata.lastTestAt ?? null,
    accountType: metadata.accountType ?? null,
    status: metadata.connected ? "CONNECTED" as const : "DISCONNECTED" as const,
    personalSource: metadata.source ?? null,
    loginid: metadata.loginid ?? null,
    brokerLoginId: metadata.loginid ?? null,
    accountId: metadata.accountId ?? null,
    authType: metadata.authType ?? "UNKNOWN",
  };
}

function mt5ReadOnlyHealth(user: CurrentUserScope, license: LicenseSnapshot, id: "mt5-demo" | "mt5-real") {
  const real = id === "mt5-real";
  const secret = getSecretMetadata(user, id);

  return connectorCard({
    id,
    name: real ? "MT5 Real" : "MT5 Demo",
    provider: "MT5",
    accountKind: real ? "REAL" : "DEMO",
    user,
    license,
    connectorStatus: "DISCONNECTED",
    runtimeMode: real ? "REAL_DATA" : "MOCK",
    dataQuality: "DISCONNECTED",
    sourceStatus: "DISCONNECTED",
    ...safeSecretFields(secret),
    message: real
      ? "MT5 Real is current-user scoped, read-only, and disconnected until a personal bridge secret is saved."
      : "MT5 Demo bridge is pending. Personal demo credentials stay backend-only.",
  });
}

function staticConnectorHealth(
  user: CurrentUserScope,
  license: LicenseSnapshot,
  id: "deriv-real" | "forex-api" | "future-providers"
) {
  const secret = getSecretMetadata(user, id);
  const templates = {
    "deriv-real": {
      name: "Deriv Real",
      provider: "Deriv" as const,
      accountKind: "REAL" as const,
      runtimeMode: "REAL_DATA" as const,
      message: "Deriv Real is prepared for current-user read-only market data. Execution remains OFF.",
    },
    "forex-api": {
      name: "Forex API",
      provider: "Forex" as const,
      accountKind: "API" as const,
      runtimeMode: "MOCK" as const,
      message: "Forex API personal secret storage is ready. Runtime remains MOCK until a read-only provider is wired.",
    },
    "future-providers": {
      name: "Future Providers",
      provider: "Future Providers" as const,
      accountKind: "FUTURE" as const,
      runtimeMode: "MOCK" as const,
      message: "Future provider slots are current-user scoped and safe by default.",
    },
  }[id];

  return connectorCard({
    id,
    name: templates.name,
    provider: templates.provider,
    accountKind: templates.accountKind,
    user,
    license,
    connectorStatus: "DISCONNECTED",
    runtimeMode: templates.runtimeMode,
    dataQuality: "DISCONNECTED",
    sourceStatus: "DISCONNECTED",
    ...safeSecretFields(secret),
    message: templates.message,
  });
}

async function derivDemoHealth(user: CurrentUserScope, license: LicenseSnapshot) {
  const personalSecret = getSecretMetadata(user, "deriv-demo");
  const personalConnected = personalSecret.saved && personalSecret.connected === true && personalSecret.accountType === "DEMO";
  const deriv = personalConnected ? derivDemoReadOnlyClient.health() : await derivDemoReadOnlyClient.connect();
  const connected = personalConnected || deriv.sourceStatus === "CONNECTED";
  const message = personalConnected
    ? "Compte Deriv DEMO personnel connecté en lecture seule."
    : deriv.message;

  return {
    ...connectorCard({
      id: "deriv-demo",
      name: "Deriv Demo",
      provider: "Deriv",
      accountKind: "DEMO",
      user,
      license,
      connectorStatus: connected ? "CONNECTED_DEMO" : deriv.sourceStatus === "MOCK" ? "DISCONNECTED" : "ERROR",
      runtimeMode: connected ? "DEMO" : "MOCK",
      dataQuality: connected ? "GOOD" : "DISCONNECTED",
      sourceStatus: connected ? "CONNECTED" : deriv.sourceStatus === "MOCK" ? "MOCK" : "DISCONNECTED",
      latencyMs: deriv.latencyMs,
      freshnessSeconds: connected ? 0 : null,
      lastTickAt: connected ? deriv.generatedAt : null,
      lastCandleAt: connected ? deriv.generatedAt : null,
      appIdConfigured: deriv.appIdConfigured,
      ...safeSecretFields(personalSecret),
      message,
    }),
    appIdConfigured: deriv.appIdConfigured,
    endpointConfigured: deriv.endpointConfigured,
    source: personalConnected ? (personalSecret.source ?? "PERSONAL_DERIV_DEMO_OAUTH") : "DEMO",
  };
}

async function buildConnectors(user: CurrentUserScope, license: LicenseSnapshot) {
  return [
    await derivDemoHealth(user, license),
    staticConnectorHealth(user, license, "deriv-real"),
    mt5ReadOnlyHealth(user, license, "mt5-demo"),
    mt5ReadOnlyHealth(user, license, "mt5-real"),
    staticConnectorHealth(user, license, "forex-api"),
    staticConnectorHealth(user, license, "future-providers"),
  ];
}

export async function getConnectorsHealth(req: Request, res: Response) {
  const user = getCurrentUserScope(req);
  const license = getLicenseSnapshot(user);
  const connectors = await buildConnectors(user, license);

  return sendJson(res, {
    generatedAt: now(),
    mode: "demo" as const,
    user,
    license,
    readOnly: true as const,
    automaticTradingAllowed: false as const,
    liveExecutionEnabled: false as const,
    autoExecutionEnabled: false as const,
    secretsExposed: false as const,
    routes: {
      orderRoutesExposed: false as const,
      buySellRoutesExposed: false as const,
      proposalRoutesExposed: false as const,
    },
    connectors,
  });
}

function authCookiePresent(req: Request) {
  const cookie = req.header("cookie") ?? "";
  return cookie.includes(`${accessCookieName}=`) || cookie.includes(`${refreshCookieName}=`);
}

export function getConnectorsDebugAuth(req: RequestWithAuth, res: Response) {
  const context = req.auth ?? authenticateRequest(req, res);
  const origin = req.header("origin") ?? null;
  const allowedOrigins = configuredOrigins();

  if (context) req.auth = context;

  return sendJson(res, {
    authenticated: Boolean(context),
    userId: context?.userId ?? null,
    role: context?.role ?? null,
    cookiePresent: authCookiePresent(req),
    origin,
    corsAllowed: origin ? isAllowedOrigin(origin, allowedOrigins) : true,
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    secretsExposed: false as const,
  });
}

export function getDerivDiagnostics(_req: Request, res: Response) {
  return sendJson(res, derivDemoReadOnlyClient.getDiagnostics());
}

export function startDerivDemoOAuth(req: Request, res: Response) {
  derivDemoReadOnlyClient.updateOAuthDiagnostics({
    oauthStartReached: true,
    authPassed: true,
    lastError: null,
  });
  console.info("[RAZON Deriv] OAUTH_START_REACHED=true");
  console.info("[RAZON Deriv] AUTH_PASSED=true");

  const user = getCurrentUserScope(req);
  const clientId = oauthClientId();

  if (!clientId) {
    derivDemoReadOnlyClient.updateOAuthDiagnostics({
      oauthRedirectReady: false,
      oauthRedirectIssued: false,
      lastError: "OAUTH_REDIRECT_READY: DERIV_OAUTH_CLIENT_ID or DERIV_APP_ID is required.",
    });
    return res.status(400).json({
      ok: false,
      error: "DERIV_OAUTH_CLIENT_ID_MISSING",
      message: "DERIV_OAUTH_CLIENT_ID or DERIV_APP_ID is required to start Deriv OAuth.",
      liveExecutionEnabled: false,
      orderPlacementAllowed: false,
      secretsExposed: false,
    });
  }

  pruneDerivOAuthStates();
  const codeVerifier = base64Url(crypto.randomBytes(48));
  const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = base64Url(crypto.randomBytes(32));
  const redirectUri = derivOAuthRedirectUri(req);
  derivOAuthStates.set(state, {
    user,
    codeVerifier,
    redirectUri,
    createdAt: Date.now(),
  });
  derivDemoReadOnlyClient.updateOAuthDiagnostics({ pkceGenerated: true });
  console.info("[RAZON Deriv] PKCE_GENERATED=true");

  const authorizationUrl = new URL(DERIV_OAUTH_AUTH_URL);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("scope", "trade");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  derivDemoReadOnlyClient.updateOAuthDiagnostics({
    oauthRedirectReady: true,
    oauthRedirectIssued: true,
    lastError: null,
  });
  console.info("[RAZON Deriv] OAUTH_REDIRECT_READY=true");
  console.info("[RAZON Deriv] OAUTH_REDIRECT_ISSUED=true");
  res.redirect(302, authorizationUrl.toString());
}

export async function getDerivDemoOAuthCallback(req: Request, res: Response) {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const stored = state ? derivOAuthStates.get(state) : null;

  if (!code || !stored) {
    derivDemoReadOnlyClient.updateOAuthDiagnostics({
      oauthCallbackOk: false,
      oauthTokenExchangeOk: false,
      lastError: "OAUTH_CALLBACK: missing or expired OAuth state/code.",
    });
    return res.status(400).json({
      ok: false,
      error: "DERIV_OAUTH_CALLBACK_INVALID",
      message: "Deriv OAuth callback is missing a valid code/state. Start the connector again.",
      liveExecutionEnabled: false,
      orderPlacementAllowed: false,
      secretsExposed: false,
    });
  }

  derivOAuthStates.delete(state);
  derivDemoReadOnlyClient.updateOAuthDiagnostics({ oauthCallbackOk: true });
  console.info("[RAZON Deriv] OAUTH_CALLBACK_OK=true");

  try {
    const clientId = oauthClientId();
    if (!clientId) throw new Error("DERIV_OAUTH_CLIENT_ID or DERIV_APP_ID is required for token exchange.");

    const tokenPayload = await exchangeDerivOAuthCode({
      code,
      codeVerifier: stored.codeVerifier,
      redirectUri: stored.redirectUri,
      clientId,
    });
    derivDemoReadOnlyClient.updateOAuthDiagnostics({ oauthTokenExchangeOk: true, lastError: null });
    console.info("[RAZON Deriv] OAUTH_TOKEN_EXCHANGE_OK=true");

    const expiresAt = typeof tokenPayload.expires_in === "number"
      ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
      : null;
    saveConnectorOAuthSecret(stored.user, "deriv-demo", tokenPayload.access_token!, {
      refreshToken: tokenPayload.refresh_token ?? null,
      expiresAt,
      connected: false,
      accountType: null,
      status: "DISCONNECTED",
    });

    const result = await derivDemoReadOnlyClient.testPersonalToken(tokenPayload.access_token!);
    derivDemoReadOnlyClient.updateOAuthDiagnostics({
      oauthCallbackOk: true,
      oauthTokenExchangeOk: true,
      lastError: result.ok ? null : derivDemoReadOnlyClient.getDiagnostics().lastError,
    });
    markConnectorSecretTest(stored.user, "deriv-demo", {
      connected: result.connected,
      accountType: result.accountType,
      status: result.status,
      source: "PERSONAL_DERIV_DEMO_OAUTH",
      loginid: result.loginid,
      accountId: result.accountId,
    });

    if (!result.ok) {
      return res.status(result.accountType === "REAL" ? 403 : 400).json({
        ok: false,
        error: result.accountType === "REAL" ? "DERIV_REAL_ACCOUNT_REFUSED" : "DERIV_OAUTH_DEMO_TEST_FAILED",
        message: result.message,
        liveExecutionEnabled: false,
        orderPlacementAllowed: false,
        secretsExposed: false,
      });
    }

    const redirectTo = process.env.DERIV_OAUTH_SUCCESS_REDIRECT?.trim() || `${process.env.APP_BASE_URL?.replace(/\/+$/, "") || "/"}`;
    res.redirect(302, redirectTo.includes("?") ? `${redirectTo}&deriv_oauth=connected` : `${redirectTo}?deriv_oauth=connected`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deriv OAuth callback failed.";
    derivDemoReadOnlyClient.updateOAuthDiagnostics({
      oauthTokenExchangeOk: false,
      lastError: `OAUTH_TOKEN_EXCHANGE: ${message}`,
    });
    console.info("[RAZON Deriv] OAUTH_TOKEN_EXCHANGE_OK=false");
    return res.status(400).json({
      ok: false,
      error: "DERIV_OAUTH_CALLBACK_FAILED",
      message,
      liveExecutionEnabled: false,
      orderPlacementAllowed: false,
      secretsExposed: false,
    });
  }
}

function actionFromPath(path: string) {
  if (path.includes("save-secret")) return "SAVE_SECRET";
  if (path.includes("delete-secret")) return "DELETE_SECRET";
  if (path.includes("reconnect")) return "RECONNECT";
  if (path.includes("disconnect")) return "DISCONNECT";
  return "TEST_CONNECTION";
}

function readSecretBody(req: Request) {
  const body = req.body as { secret?: unknown; token?: unknown } | undefined;
  const value = typeof body?.secret === "string" ? body.secret : typeof body?.token === "string" ? body.token : "";
  return value;
}

export async function postConnectorSafeAction(req: Request, res: Response) {
  const connectorId = String(req.params.id ?? "");
  if (!isConnectorId(connectorId)) {
    return res.status(404).json({
      ok: false,
      error: "UNKNOWN_CONNECTOR",
      readOnly: true,
      liveExecutionEnabled: false,
      automaticTradingAllowed: false,
    });
  }

  const user = getCurrentUserScope(req);
  const license = getLicenseSnapshot(user);
  const action = actionFromPath(req.path);

  if (action === "SAVE_SECRET") {
    const metadata = saveConnectorSecret(user, connectorId, readSecretBody(req));
    if (!metadata.saved) {
      return res.status(400).json({
        ok: false,
        action,
        error: "INVALID_SECRET",
        message: "Enter a valid backend-only connector token before saving.",
        readOnly: true,
        liveExecutionEnabled: false,
        automaticTradingAllowed: false,
        orderPlacementAllowed: false,
        secretsExposed: false,
      });
    }
  }

  if (action === "DELETE_SECRET") {
    deleteConnectorSecret(user, connectorId);
    if (connectorId === "deriv-demo") derivDemoReadOnlyClient.disconnect();
  }

  if (action === "DISCONNECT" && connectorId === "deriv-demo") {
    disconnectConnectorSecret(user, connectorId);
    derivDemoReadOnlyClient.disconnect();
  }

  if ((action === "TEST_CONNECTION" || action === "RECONNECT") && connectorId === "deriv-demo") {
    const token = readConnectorSecret(user, connectorId);

    if (!token) {
      markConnectorSecretTest(user, connectorId, {
        connected: false,
        accountType: null,
        status: "DISCONNECTED",
        source: "PERSONAL_DERIV_DEMO_OAUTH",
      });
      return res.status(400).json({
        ok: false,
        action,
        error: "DERIV_TOKEN_MISSING",
        message: "Connect Deriv DEMO with OAuth before testing the read-only connector.",
        readOnly: true,
        liveExecutionEnabled: false,
        automaticTradingAllowed: false,
        orderPlacementAllowed: false,
        secretsExposed: false,
      });
    }

    const result = await derivDemoReadOnlyClient.testPersonalToken(token);
    markConnectorSecretTest(user, connectorId, {
      connected: result.connected,
      accountType: result.accountType,
      status: result.status,
      source: result.source,
      loginid: result.loginid,
      accountId: result.accountId,
    });

    if (!result.ok) {
      return res.status(result.accountType === "REAL" ? 403 : 400).json({
        ok: false,
        action,
        error: result.accountType === "REAL" ? "DERIV_REAL_TOKEN_REFUSED" : "DERIV_DEMO_TEST_FAILED",
        message: result.message,
        readOnly: true,
        liveExecutionEnabled: false,
        automaticTradingAllowed: false,
        orderPlacementAllowed: false,
        secretsExposed: false,
      });
    }
  }

  const connectors = await buildConnectors(user, license);
  const connector = connectors.find(item => item.id === connectorId);

  return sendJson(res, {
    ok: true,
    action,
    ...(connectorId === "deriv-demo" && (action === "TEST_CONNECTION" || action === "RECONNECT")
      ? {
          connected: connector?.connected === true,
          loginid: connector?.loginid ?? null,
          accountType: connector?.accountType ?? null,
          balanceAvailable: derivDemoReadOnlyClient.getDiagnostics().balanceOk,
          tickReceived: derivDemoReadOnlyClient.getDiagnostics().tickReceived,
          source: "PERSONAL_DERIV_DEMO_OAUTH" as const,
          dataQuality: connector?.dataQuality ?? "DISCONNECTED",
        }
      : {}),
    message: connectorId === "deriv-demo" && (action === "TEST_CONNECTION" || action === "RECONNECT")
      ? "Compte Deriv DEMO personnel connecté en lecture seule."
      : "Connector action completed. Secret value was not returned.",
    generatedAt: now(),
    user,
    readOnly: true as const,
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    orderPlacementAllowed: false as const,
    secretsExposed: false as const,
    connector,
  });
}
