import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { API_BASE_URL } from "@/lib/api";

export type AuthLicenseStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED" | "MISSING";
export type AuthLicensePlan = "STARTER" | "PRO" | "ELITE" | "LIFETIME" | "NONE";

export interface AuthUser {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: "OWNER" | "ADMIN" | "USER";
  readonly status: "ACTIVE" | "DISABLED";
  readonly mustChangePassword: boolean;
  readonly firstLoginCompleted: boolean;
}

export interface AuthSession {
  readonly authenticated: true;
  readonly user: AuthUser;
  readonly license: {
    readonly status: AuthLicenseStatus;
    readonly plan: AuthLicensePlan;
    readonly message: string;
    readonly expiryDate: string | null;
    readonly deviceLimit: number | null;
    readonly activeDevices: number;
    readonly sessionLimit: number | null;
    readonly activeSessions: number;
    readonly warnings: readonly string[];
    readonly dashboardBlocked: boolean;
    readonly limitedReadOnly: boolean;
  };
  readonly plan: AuthLicensePlan;
  readonly devices: readonly unknown[];
  readonly sessions: readonly unknown[];
  readonly permissions: {
    readonly dashboardAccess: "FULL" | "LIMITED_READ_ONLY" | "ACTIVATION_REQUIRED" | "DENIED";
    readonly canManageLicenses: boolean;
    readonly canManageUsers: boolean;
    readonly canManageConnectors: boolean;
    readonly canReadMarket: boolean;
    readonly canReadJournal: boolean;
    readonly liveExecutionEnabled: false;
    readonly automaticTradingAllowed: false;
  };
  readonly session: {
    readonly id: string;
    readonly expiresAt: string;
    readonly refreshExpiresAt: string;
    readonly mustRefreshAt: string;
  };
  readonly readOnly: true;
  readonly liveExecutionEnabled: false;
  readonly automaticTradingAllowed: false;
  readonly secretsExposed: false;
}

interface AuthContextValue {
  readonly loading: boolean;
  readonly session: AuthSession | null;
  readonly refreshMe: () => Promise<AuthSession | null>;
  readonly login: (input: { identifier: string; password: string; rememberMe: boolean }) => Promise<AuthSession>;
  readonly logout: () => Promise<void>;
  readonly logoutGlobal: () => Promise<void>;
  readonly changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<AuthSession | null>;
  readonly forgotPassword: (identifier: string) => Promise<string>;
  readonly resetPassword: (input: { token: string; newPassword: string }) => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEVICE_ID_STORAGE_KEY = "razon_device_id";

function randomDeviceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getDeviceId() {
  if (typeof window === "undefined") return "server-device";
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const next = randomDeviceId();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
  return next;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    body: JSON.stringify(body),
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Razon-Device-Id": getDeviceId() },
    method: "POST",
  });
  return parseResponse<T>(response);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);

  const refreshMe = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/me`, { credentials: "include", headers: { Accept: "application/json" } });
    if (response.status === 401) {
      setSession(null);
      return null;
    }

    const payload = await parseResponse<AuthSession>(response);
    setSession(payload);
    return payload;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refreshMe()
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  useEffect(() => {
    if (!session) return undefined;

    const heartbeat = () => {
      void fetch(`${API_BASE_URL}/api/sessions/heartbeat`, {
        credentials: "include",
        headers: { Accept: "application/json", "X-Razon-Device-Id": getDeviceId() },
        method: "POST",
      }).catch(() => undefined);
    };

    heartbeat();
    const timer = window.setInterval(heartbeat, 45000);
    return () => window.clearInterval(timer);
  }, [session]);

  const login = useCallback(async (input: { identifier: string; password: string; rememberMe: boolean }) => {
    const payload = await postJson<AuthSession>("/api/auth/login", input);
    setSession(payload);
    return payload;
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { credentials: "include", method: "POST" }).catch(() => undefined);
    setSession(null);
  }, []);

  const logoutGlobal = useCallback(async () => {
    await fetch(`${API_BASE_URL}/api/auth/logout-global`, { credentials: "include", method: "POST" }).catch(() => undefined);
    setSession(null);
  }, []);

  const changePassword = useCallback(async (input: { currentPassword: string; newPassword: string }) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      body: JSON.stringify(input),
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      method: "POST",
    });
    await parseResponse<{ ok: true }>(response);
    return refreshMe();
  }, [refreshMe]);

  const forgotPassword = useCallback(async (identifier: string) => {
    const payload = await postJson<{ message: string }>("/api/auth/forgot-password", { identifier });
    return payload.message;
  }, []);

  const resetPassword = useCallback(async (input: { token: string; newPassword: string }) => {
    const payload = await postJson<{ message: string }>("/api/auth/reset-password", input);
    setSession(null);
    return payload.message;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      refreshMe,
      login,
      logout,
      logoutGlobal,
      changePassword,
      forgotPassword,
      resetPassword,
    }),
    [changePassword, forgotPassword, loading, login, logout, logoutGlobal, refreshMe, resetPassword, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
