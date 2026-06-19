import { Copy, RefreshCw, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LicenseDuration, LicensePlan, LicenseStatusSnapshot, SafeLicense } from "../app/cockpit.types";
import { StatusPill } from "../components/CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";
import { useAuth } from "@/auth/AuthProvider";
import { API_BASE_URL } from "@/lib/api";

interface AdminLicensesPayload {
  readonly licenses: readonly SafeLicense[];
}

interface CreatedAccountPayload {
  readonly user?: {
    readonly id: string;
    readonly username?: string;
    readonly email: string;
    readonly displayName: string;
  };
  readonly username?: string;
  readonly email?: string;
  readonly temporaryPassword?: string | null;
  readonly oneTimeTemporaryPassword?: string | null;
  readonly warning?: string;
}

interface AdminUsersPayload {
  readonly users: readonly {
    readonly id: string;
    readonly username: string;
    readonly email: string;
    readonly displayName: string;
    readonly role: "OWNER" | "ADMIN" | "USER";
    readonly status: "ACTIVE" | "DISABLED";
    readonly mustChangePassword: boolean;
    readonly firstLoginCompleted: boolean;
    readonly license: SafeLicense | null;
  }[];
}

interface AdminDevicesPayload {
  readonly devices: readonly {
    readonly id: string;
    readonly userId: string;
    readonly licenseId: string;
    readonly label: string;
    readonly lastSeenAt: string;
    readonly revoked: boolean;
  }[];
  readonly sessions: readonly {
    readonly id: string;
    readonly userId: string;
    readonly licenseId: string;
    readonly deviceId: string;
    readonly lastSeenAt: string;
    readonly revoked: boolean;
  }[];
  readonly authActivity?: {
    readonly activeUsers: number;
    readonly activeDevices: number;
    readonly activeSessions: number;
    readonly totalSessions: number;
    readonly activeWindowSeconds: number;
    readonly byUser: readonly AdminUserSessionGroup[];
    readonly secretsExposed: false;
  };
  readonly globalActiveUsers?: number;
  readonly globalActiveDevices?: number;
  readonly globalActiveSessions?: number;
  readonly perUserSessions?: readonly AdminUserSessionGroup[];
}

interface AdminSafeSession {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly email: string;
  readonly licenseId: string | null;
  readonly deviceId: string | null;
  readonly userAgent: string | null;
  readonly ipHash: string | null;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly status: "ACTIVE" | "EXPIRED" | "REVOKED";
}

interface AdminUserSessionGroup {
  readonly userId: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: "OWNER" | "ADMIN" | "USER";
  readonly activeSessions: number;
  readonly totalSessions: number;
  readonly sessions: readonly AdminSafeSession[];
}

interface AdminAuditPayload {
  readonly auditLogs: readonly {
    readonly id: string;
    readonly timestamp: string;
    readonly userId: string;
    readonly licenseId: string | null;
    readonly event: string;
    readonly status: string;
    readonly message: string;
  }[];
}

const planOptions: readonly Exclude<LicensePlan, "NONE">[] = ["STARTER", "PRO", "ELITE", "LIFETIME"];
const durationOptions: readonly LicenseDuration[] = ["1_MONTH", "2_MONTHS", "3_MONTHS", "6_MONTHS", "1_YEAR", "LIFETIME"];

function statusTone(status: string) {
  if (status === "ACTIVE") return "connected";
  if (status === "PENDING") return "demo";
  if (status === "EXPIRED" || status === "SUSPENDED" || status === "REVOKED") return "critical";
  return "MOCK";
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

function limitLabel(active: number, limit: number | null) {
  return `${active} / ${limit ?? "n/a"}`;
}

export function LicenseSettingsPanel({
  license,
  onRefresh,
}: {
  readonly license: LicenseStatusSnapshot | null;
  readonly onRefresh?: () => Promise<void> | void;
}) {
  const { locale, t } = useLanguage();
  const { session } = useAuth();
  const canManageLicenses = Boolean(session?.permissions.canManageLicenses);
  const [adminLicenses, setAdminLicenses] = useState<readonly SafeLicense[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUsersPayload["users"]>([]);
  const [adminDevices, setAdminDevices] = useState<AdminDevicesPayload["devices"]>([]);
  const [adminSessions, setAdminSessions] = useState<AdminDevicesPayload["sessions"]>([]);
  const [globalActiveUsers, setGlobalActiveUsers] = useState(0);
  const [globalActiveDevices, setGlobalActiveDevices] = useState(0);
  const [globalActiveSessions, setGlobalActiveSessions] = useState(0);
  const [perUserSessions, setPerUserSessions] = useState<readonly AdminUserSessionGroup[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditPayload["auditLogs"]>([]);
  const [createUserId, setCreateUserId] = useState("");
  const [createUsername, setCreateUsername] = useState("client");
  const [createEmail, setCreateEmail] = useState("client@example.com");
  const [createDisplayName, setCreateDisplayName] = useState("Client User");
  const [createRole, setCreateRole] = useState<"OWNER" | "ADMIN" | "USER">("USER");
  const [createPlan, setCreatePlan] = useState<Exclude<LicensePlan, "NONE">>("STARTER");
  const [createDuration, setCreateDuration] = useState<LicenseDuration>("1_MONTH");
  const [notice, setNotice] = useState("");
  const [oneTimeKey, setOneTimeKey] = useState("");
  const [createdAccount, setCreatedAccount] = useState<CreatedAccountPayload | null>(null);
  const temporaryPassword = createdAccount?.temporaryPassword ?? createdAccount?.oneTimeTemporaryPassword ?? "";
  const activeLicense = license?.license ?? null;
  const isBlocked = license?.dashboardBlocked ?? true;
  const warningText = useMemo(() => {
    if (!license) return t("license.required");
    if (license.status === "EXPIRED") return t("license.expired");
    if (license.status === "SUSPENDED") return t("license.suspended");
    if (license.status === "REVOKED") return t("license.revoked");
    if (license.status === "MISSING") return t("license.required");
    if (license.warnings.includes("DEVICE LIMIT REACHED")) return t("license.deviceLimitReached");
    if (license.warnings.includes("SESSION LIMIT REACHED")) return t("license.sessionLimitReached");
    return license.message;
  }, [license, t]);

  const refreshAdmin = async () => {
    const [licensesResponse, usersResponse, devicesResponse, auditResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/admin/licenses`, { credentials: "include", headers: { Accept: "application/json" } }),
      fetch(`${API_BASE_URL}/api/admin/users`, { credentials: "include", headers: { Accept: "application/json" } }),
      fetch(`${API_BASE_URL}/api/admin/devices`, { credentials: "include", headers: { Accept: "application/json" } }),
      fetch(`${API_BASE_URL}/api/admin/audit-logs`, { credentials: "include", headers: { Accept: "application/json" } }),
    ]);
    const failed = [licensesResponse, usersResponse, devicesResponse, auditResponse].find(response => !response.ok);
    if (failed) {
      const payload = await failed.json().catch(() => ({}));
      const message = typeof payload.message === "string" ? payload.message : `Admin request failed (${failed.status})`;
      throw new Error(message);
    }
    if (licensesResponse.ok) {
      const payload = (await licensesResponse.json()) as AdminLicensesPayload;
      setAdminLicenses(payload.licenses);
    }
    if (usersResponse.ok) {
      const payload = (await usersResponse.json()) as AdminUsersPayload;
      setAdminUsers(payload.users);
    }
    if (devicesResponse.ok) {
      const payload = (await devicesResponse.json()) as AdminDevicesPayload;
      setAdminDevices(payload.devices);
      setAdminSessions(payload.sessions);
      setGlobalActiveUsers(payload.globalActiveUsers ?? payload.authActivity?.activeUsers ?? 0);
      setGlobalActiveDevices(payload.globalActiveDevices ?? payload.authActivity?.activeDevices ?? 0);
      setGlobalActiveSessions(payload.globalActiveSessions ?? payload.authActivity?.activeSessions ?? 0);
      setPerUserSessions(payload.perUserSessions ?? payload.authActivity?.byUser ?? []);
    }
    if (auditResponse.ok) {
      const payload = (await auditResponse.json()) as AdminAuditPayload;
      setAdminAuditLogs(payload.auditLogs);
    }
  };

  useEffect(() => {
    if (canManageLicenses) {
      void refreshAdmin().catch(error => {
        setNotice(error instanceof Error ? error.message : "Admin data failed to load.");
      });
    }
  }, [canManageLicenses]);

  const postJson = async (url: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      body: JSON.stringify(payload),
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = typeof errorPayload.message === "string" ? errorPayload.message : `Request failed (${response.status})`;
      throw new Error(message);
    }
    return response.json() as Promise<Record<string, unknown>>;
  };

  const createLicense = async () => {
    const payload = await postJson("/api/licenses/create", {
      userId: createUserId.trim() || undefined,
      username: createUsername,
      email: createEmail,
      displayName: createDisplayName,
      role: createRole,
      plan: createPlan,
      duration: createDuration,
    });
    setOneTimeKey(String(payload.oneTimeLicenseKey ?? ""));
    const account = (payload.account ?? null) as CreatedAccountPayload | null;
    setCreatedAccount(account ? {
      ...account,
      temporaryPassword: String(payload.temporaryPassword ?? account.oneTimeTemporaryPassword ?? ""),
    } : null);
    setNotice("User and license created. Copy one-time secrets now.");
    await refreshAdmin();
  };

  const createUser = async () => {
    const payload = await postJson("/api/admin/users", {
      userId: createUserId.trim() || undefined,
      username: createUsername,
      email: createEmail,
      displayName: createDisplayName,
      role: createRole,
      mustChangePassword: true,
    });
    setCreatedAccount({
      user: payload.user as CreatedAccountPayload["user"],
      temporaryPassword: String(payload.temporaryPassword ?? payload.oneTimeTemporaryPassword ?? ""),
      oneTimeTemporaryPassword: String(payload.oneTimeTemporaryPassword ?? payload.temporaryPassword ?? ""),
      warning: String(payload.warning ?? ""),
    });
    setOneTimeKey("");
    setNotice("User created. Temporary password is visible once.");
    await refreshAdmin();
  };

  const copySecret = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setNotice(`${label} copied. It will not be shown again after refresh.`);
  };

  const actOnLicense = async (action: "renew" | "suspend" | "revoke", licenseId: string) => {
    const payload = await postJson(`/api/licenses/${action}`, {
      licenseId,
      duration: createDuration,
      reason: `admin ${action}`,
    });
    setNotice(String(payload.message ?? `${action} completed.`));
    await onRefresh?.();
    await refreshAdmin();
  };

  const actOnUser = async (action: "suspend" | "logout-global" | "reactivate", userId: string) => {
    if (action === "reactivate") {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(userId)}`, {
        body: JSON.stringify({ status: "ACTIVE" }),
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload.message === "string" ? payload.message : `Request failed (${response.status})`;
        throw new Error(message);
      }
      setNotice("User reactivated.");
    } else {
      const payload = await postJson(`/api/admin/users/${encodeURIComponent(userId)}/${action}`, {});
      setNotice(String(payload.message ?? `${action} completed.`));
    }
    await refreshAdmin();
  };

  return (
    <section className="cockpit-panel license-settings-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>{t("license.title")}</h2>
          <p className="cockpit-muted">{t("license.description")}</p>
        </div>
        <StatusPill tone={statusTone(license?.status ?? "MISSING")}>{license?.status ?? "MISSING"}</StatusPill>
      </div>

      <div className="license-warning-row">
        <StatusPill tone={isBlocked ? "critical" : "connected"}>
          {isBlocked ? t("license.limitedReadOnly") : t("license.fullDashboard")}
        </StatusPill>
        <span>{warningText}</span>
      </div>

      <div className="license-grid">
        <span>
          <b>{t("license.currentUser")}</b>
          <strong>{license?.userId ?? "demo-current-user"}</strong>
        </span>
        <span>
          <b>{t("license.plan")}</b>
          <strong>{license?.plan ?? "NONE"}</strong>
        </span>
        <span>
          <b>{t("license.expiration")}</b>
          <strong>{formatDate(license?.expiryDate, locale)}</strong>
        </span>
        <span>
          <b>{t("license.devices")} (current user only)</b>
          <strong>{limitLabel(license?.activeDevices ?? 0, license?.deviceLimit ?? null)}</strong>
        </span>
        <span>
          <b>{t("license.sessions")} (current user only)</b>
          <strong>{limitLabel(license?.activeSessions ?? 0, license?.sessionLimit ?? null)}</strong>
        </span>
        <span>
          <b>LIVE</b>
          <strong>OFF</strong>
        </span>
      </div>

      <div className="license-action-panel">
        <div className="secret-settings-title">
          <span>License status</span>
          <StatusPill tone="live-off">ADMIN ISSUED</StatusPill>
        </div>
        <p className="cockpit-muted">
          RAZON access is issued by an administrator. License assignment is not available as public or self-service onboarding.
        </p>
        <div className="connector-action-row">
          <button onClick={() => void onRefresh?.()} type="button">
            <RefreshCw size={14} aria-hidden="true" />
            {t("license.refreshStatus")}
          </button>
        </div>
      </div>

      {canManageLicenses ? (
        <div className="license-action-panel">
          <div className="secret-settings-title">
            <span>
              <ShieldOff size={14} aria-hidden="true" />
              {t("license.adminPanel")}
            </span>
            <StatusPill tone="demo">{t("license.localAdmin")}</StatusPill>
          </div>
          <div className="license-admin-controls">
            <label>
              <span>{t("license.userId")}</span>
              <input
                onChange={event => setCreateUserId(event.target.value)}
                placeholder="Optional; defaults from username/email"
                value={createUserId}
              />
            </label>
            <label>
              <span>Username</span>
              <input onChange={event => setCreateUsername(event.target.value)} value={createUsername} />
            </label>
            <label>
              <span>User email</span>
              <input onChange={event => setCreateEmail(event.target.value)} value={createEmail} />
            </label>
            <label>
              <span>Display name</span>
              <input onChange={event => setCreateDisplayName(event.target.value)} value={createDisplayName} />
            </label>
            <label>
              <span>Role</span>
              <select onChange={event => setCreateRole(event.target.value as "OWNER" | "ADMIN" | "USER")} value={createRole}>
                <option>USER</option>
                <option>ADMIN</option>
                <option>OWNER</option>
              </select>
            </label>
            <label>
              <span>{t("license.plan")}</span>
              <select onChange={event => setCreatePlan(event.target.value as Exclude<LicensePlan, "NONE">)} value={createPlan}>
                {planOptions.map(plan => <option key={plan}>{plan}</option>)}
              </select>
            </label>
            <label>
              <span>{t("license.duration")}</span>
              <select onChange={event => setCreateDuration(event.target.value as LicenseDuration)} value={createDuration}>
                {durationOptions.map(duration => <option key={duration}>{duration}</option>)}
              </select>
            </label>
            <button onClick={createUser} type="button">Create user only</button>
            <button onClick={createLicense} type="button">Create user + license</button>
          </div>
          {oneTimeKey ? (
            <div className="license-one-time-key">
              <span>{t("license.oneTimeKey")}</span>
              <strong>{oneTimeKey}</strong>
              <button onClick={() => void copySecret(oneTimeKey, "License key")} type="button">
                <Copy size={14} aria-hidden="true" />
                Copy
              </button>
              <small>{t("license.oneTimeHint")}</small>
            </div>
          ) : null}
          {temporaryPassword ? (
            <div className="license-one-time-key">
              <span>Mot de passe temporaire</span>
              <strong>{temporaryPassword}</strong>
              <button onClick={() => void copySecret(temporaryPassword, "Temporary password")} type="button">
                <Copy size={14} aria-hidden="true" />
                Copy
              </button>
              <small>
                Copiez maintenant, il ne sera plus affiché. {createdAccount?.user?.email ?? createEmail} devra le changer au premier login.
              </small>
            </div>
          ) : null}
        </div>
      ) : null}

      {notice ? <p className="connector-action-notice">{notice}</p> : null}

      {canManageLicenses ? <div className="license-admin-list">
        <div>
          <h3>{t("license.licenses")}</h3>
          {adminLicenses.length === 0 ? <p className="cockpit-muted">{t("license.noLicenses")}</p> : null}
          {adminLicenses.slice(0, 6).map(item => (
            <div className="license-admin-row" key={item.id}>
              <span>
                <strong>{item.plan}</strong>
                <small>{item.userId} | {item.licenseKeyPreview} | {t("license.expires")} {formatDate(item.expiresAt, locale)}</small>
              </span>
              <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>
              <button onClick={() => actOnLicense("renew", item.id)} type="button">{t("license.renew")}</button>
              <button onClick={() => actOnLicense("suspend", item.id)} type="button">{t("license.suspend")}</button>
              <button onClick={() => actOnLicense("revoke", item.id)} type="button">{t("license.revoke")}</button>
            </div>
          ))}
        </div>
        <div>
          <h3>{t("license.users")}</h3>
          {adminUsers.length === 0 ? <p className="cockpit-muted">{t("license.noUsers")}</p> : null}
          {adminUsers.slice(0, 6).map(user => (
            <div className="license-admin-row user" key={user.id}>
              <span>
                <strong>{user.displayName}</strong>
                <small>{user.username} | {user.email} | {user.role} | {user.status} | first login {user.firstLoginCompleted ? "done" : "pending"}</small>
              </span>
              <StatusPill tone={statusTone(user.license?.status ?? "MISSING")}>{user.license?.status ?? "MISSING"}</StatusPill>
              <button onClick={() => actOnUser(user.status === "DISABLED" ? "reactivate" : "suspend", user.id)} type="button">
                {user.status === "DISABLED" ? "Reactivate" : "Suspend"}
              </button>
              <button onClick={() => actOnUser("logout-global", user.id)} type="button">Force logout</button>
            </div>
          ))}
        </div>
      </div> : null}

      {canManageLicenses ? <div className="license-admin-list">
        <div>
          <h3>Global active sessions</h3>
          <div className="license-grid compact">
            <span>
              <b>Global active users</b>
              <strong>{globalActiveUsers}</strong>
            </span>
            <span>
              <b>Global active devices</b>
              <strong>{globalActiveDevices}</strong>
            </span>
            <span>
              <b>Global active sessions</b>
              <strong>{globalActiveSessions}</strong>
            </span>
          </div>
          <p className="cockpit-muted">
            Counts are based on authenticated sessions seen in the last 5 minutes. Raw IP addresses are never displayed.
          </p>
        </div>
        <div>
          <h3>Per-user active sessions</h3>
          {perUserSessions.length === 0 ? <p className="cockpit-muted">No authenticated sessions yet.</p> : null}
          {perUserSessions.slice(0, 8).map(group => (
            <div className="license-admin-row user" key={group.userId}>
              <span>
                <strong>{group.displayName}</strong>
                <small>
                  {group.email || group.userId} | {group.role} | active {group.activeSessions} / total {group.totalSessions}
                </small>
                {group.sessions.slice(0, 3).map(item => (
                  <small key={item.id}>
                    {item.status} | device {item.deviceId ? item.deviceId.slice(0, 8) : "n/a"} | {formatDate(item.lastSeenAt, locale)} | {item.userAgent ?? "unknown agent"}
                  </small>
                ))}
              </span>
              <StatusPill tone={group.activeSessions > 0 ? "connected" : "critical"}>
                {group.activeSessions > 0 ? "ACTIVE" : "INACTIVE"}
              </StatusPill>
            </div>
          ))}
        </div>
      </div> : null}

      {canManageLicenses ? <div className="license-admin-list">
        <div>
          <h3>Devices</h3>
          {adminDevices.length === 0 ? <p className="cockpit-muted">No devices yet.</p> : null}
          {adminDevices.slice(0, 6).map(device => (
            <div className="license-admin-row" key={device.id}>
              <span>
                <strong>{device.label}</strong>
                <small>{device.userId} | {formatDate(device.lastSeenAt, locale)} | {device.revoked ? "REVOKED" : "ACTIVE"}</small>
              </span>
              <StatusPill tone={device.revoked ? "critical" : "connected"}>{device.revoked ? "REVOKED" : "ACTIVE"}</StatusPill>
            </div>
          ))}
        </div>
        <div>
          <h3>Sessions</h3>
          {adminSessions.length === 0 ? <p className="cockpit-muted">No sessions yet.</p> : null}
          {adminSessions.slice(0, 6).map(item => (
            <div className="license-admin-row" key={item.id}>
              <span>
                <strong>{item.userId}</strong>
                <small>{item.id} | {formatDate(item.lastSeenAt, locale)}</small>
              </span>
              <StatusPill tone={item.revoked ? "critical" : "connected"}>{item.revoked ? "REVOKED" : "ACTIVE"}</StatusPill>
            </div>
          ))}
        </div>
      </div> : null}

      {canManageLicenses ? <div className="license-admin-list">
        <div>
          <h3>Audit logs</h3>
          {adminAuditLogs.length === 0 ? <p className="cockpit-muted">No audit logs yet.</p> : null}
          {adminAuditLogs.slice(0, 10).map(log => (
            <div className="license-admin-row" key={log.id}>
              <span>
                <strong>{log.event}</strong>
                <small>{formatDate(log.timestamp, locale)} | {log.userId} | {log.message}</small>
              </span>
              <StatusPill tone={statusTone(log.status)}>{log.status}</StatusPill>
            </div>
          ))}
        </div>
      </div> : null}

      <div className="dashboard-safety-row">
        <StatusPill tone="live-off">{t("common.liveOff")}</StatusPill>
        <StatusPill tone="live-off">{t("common.autoExecutionOff")}</StatusPill>
        <StatusPill tone="connected">{t("license.serverVerified")}</StatusPill>
      </div>
    </section>
  );
}
