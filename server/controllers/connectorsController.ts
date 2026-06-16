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
  type ConnectorId,
  type ConnectorSecretStatus,
  type CurrentUserScope,
  type LicenseSnapshot,
} from "../services/connectors/connectorSecretsRepository";
import { sendJson } from "../utils/http";

function now() {
  return new Date().toISOString();
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
  readonly source: "DEMO" | "MOCK" | "LIVE" | "PERSONAL_DERIV_DEMO";
  readonly readonlyByDefault: true;
  readonly saved?: boolean;
  readonly connected?: boolean;
  readonly lastTestAt?: string | null;
  readonly accountType?: "DEMO" | "REAL" | "UNKNOWN" | null;
  readonly status?: "CONNECTED" | "DISCONNECTED";
  readonly personalSource?: "PERSONAL_DERIV_DEMO" | null;
  readonly loginid?: string | null;
  readonly brokerLoginId?: string | null;
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
    source: personalConnected ? "PERSONAL_DERIV_DEMO" : "DEMO",
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
        source: "PERSONAL_DERIV_DEMO",
      });
      return res.status(400).json({
        ok: false,
        action,
        error: "DERIV_TOKEN_MISSING",
        message: "Save your personal Deriv DEMO token before testing the read-only connector.",
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
      source: "PERSONAL_DERIV_DEMO",
      loginid: result.loginid,
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
