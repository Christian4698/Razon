import { PostgresSaasRepository } from "./postgres-saas.repository";
import { setSaasPersistenceScheduler, suspendSaasPersistenceNotifications } from "./persistence-bus";
import type { SaasPersistenceSnapshot } from "./saas-persistence.types";

let initialized = false;
let active = false;
let flushTimer: NodeJS.Timeout | null = null;
let flushPromise: Promise<void> | null = null;
let lastError: string | null = null;
const repository = new PostgresSaasRepository();

function persistenceErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function saasPersistenceStatus() {
  return {
    enabled: active,
    provider: active ? "postgres" : "memory",
    configuredProvider: repository.enabled ? "postgres" : "memory",
    initialized,
    lastError,
  };
}

export async function initializeSaasPersistence() {
  if (initialized) return saasPersistenceStatus();

  if (!repository.enabled) {
    initialized = true;
    active = false;
    console.info("[RAZON SaaS Persistence] provider=memory durable=false");
    return saasPersistenceStatus();
  }

  const { authSessionService } = await import("../security/auth-session.service");
  const { licenseEngineService } = await import("../licenses");
  const { usersService } = await import("../users");
  const connectorSecretsRepository = await import("../../../../server/services/connectors/connectorSecretsRepository").catch(() => null);

  try {
    await repository.initialize();
    const snapshot = await repository.loadSnapshot();
    if (snapshot && hasPersistentRows(snapshot)) {
      suspendSaasPersistenceNotifications(() => {
        usersService.importPersistence(snapshot.users);
        authSessionService.importPersistence({
          passwords: snapshot.passwords,
          refreshTokens: snapshot.refreshTokens,
          resetTokens: snapshot.resetTokens,
        });
        licenseEngineService.importPersistence({
          licenses: snapshot.licenses,
          subscriptions: snapshot.subscriptions,
          devices: snapshot.devices,
          licenseSessions: snapshot.licenseSessions,
          auditLogs: snapshot.auditLogs,
        });
        connectorSecretsRepository?.importConnectorSecretsPersistence(snapshot.connectorSecrets);
      });
      const ownerCreated = authSessionService.ensureFirstOwner();
      if (ownerCreated) {
        await repository.saveSnapshot(collectSnapshot(usersService, authSessionService, licenseEngineService, connectorSecretsRepository));
      }
      console.info(`[RAZON SaaS Persistence] provider=postgres hydrated=true users=${snapshot.users.length}`);
    } else {
      authSessionService.ensureFirstOwner();
      await repository.saveSnapshot(collectSnapshot(usersService, authSessionService, licenseEngineService, connectorSecretsRepository));
      console.info("[RAZON SaaS Persistence] provider=postgres hydrated=false seeded=true");
    }

    setSaasPersistenceScheduler(reason => scheduleFlush(reason));
    initialized = true;
    active = true;
    lastError = null;
  } catch (error) {
    lastError = persistenceErrorMessage(error, "Postgres persistence unavailable.");
    initialized = true;
    active = false;
    console.warn(`[RAZON SaaS Persistence] provider=postgres unavailable fallback=memory reason=${lastError}`);
  }

  return saasPersistenceStatus();
}

export async function flushSaasPersistence() {
  if (!repository.enabled || flushPromise) return flushPromise;
  const { authSessionService } = await import("../security/auth-session.service");
  const { licenseEngineService } = await import("../licenses");
  const { usersService } = await import("../users");
  const connectorSecretsRepository = await import("../../../../server/services/connectors/connectorSecretsRepository").catch(() => null);

  flushPromise = repository.saveSnapshot(collectSnapshot(usersService, authSessionService, licenseEngineService, connectorSecretsRepository))
    .then(() => {
      lastError = null;
    })
    .catch(error => {
      lastError = persistenceErrorMessage(error, "Unknown persistence flush error");
      console.warn(`[RAZON SaaS Persistence] flush failed reason=${lastError}`);
    })
    .finally(() => {
      flushPromise = null;
    });

  return flushPromise;
}

function scheduleFlush(_reason: string) {
  if (!repository.enabled || !initialized) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushSaasPersistence();
  }, Number(process.env.SAAS_PERSISTENCE_FLUSH_DEBOUNCE_MS ?? 75));
}

function hasPersistentRows(snapshot: SaasPersistenceSnapshot) {
  return snapshot.users.length > 0 || snapshot.licenses.length > 0 || snapshot.subscriptions.length > 0;
}

function collectSnapshot(
  usersService: typeof import("../users").usersService,
  authSessionService: typeof import("../security/auth-session.service").authSessionService,
  licenseEngineService: typeof import("../licenses").licenseEngineService,
  connectorSecretsRepository: typeof import("../../../../server/services/connectors/connectorSecretsRepository") | null,
): SaasPersistenceSnapshot {
  const licenseSnapshot = licenseEngineService.exportPersistence();
  const authSnapshot = authSessionService.exportPersistence();

  return {
    users: usersService.exportPersistence(),
    passwords: authSnapshot.passwords,
    refreshTokens: authSnapshot.refreshTokens,
    resetTokens: authSnapshot.resetTokens,
    licenses: licenseSnapshot.licenses,
    subscriptions: licenseSnapshot.subscriptions,
    devices: licenseSnapshot.devices,
    licenseSessions: licenseSnapshot.licenseSessions,
    auditLogs: licenseSnapshot.auditLogs,
    connectorSecrets: connectorSecretsRepository?.exportConnectorSecretsPersistence() ?? [],
  };
}
