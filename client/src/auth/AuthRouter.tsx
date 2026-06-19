import { useCallback, useEffect, useMemo, useState } from "react";
import RazonCockpit from "../../../frontend/app/RazonCockpit";
import type { CockpitPage } from "../../../frontend/app/cockpit.types";
import { FirstPasswordChangePage } from "../../../frontend/auth/FirstPasswordChangePage";
import { ForgotPasswordPage } from "../../../frontend/auth/ForgotPasswordPage";
import { LicenseAccessDeniedPage } from "../../../frontend/auth/LicenseAccessPage";
import { LicenseActivationPage } from "../../../frontend/auth/LicenseActivationPage";
import { LoginPage } from "../../../frontend/auth/LoginPage";
import { LogoutPage } from "../../../frontend/auth/LogoutPage";
import { ResetPasswordPage } from "../../../frontend/auth/ResetPasswordPage";
import { ProfilePage } from "../../../frontend/profile/ProfilePage";
import { useAuth } from "./AuthProvider";

const publicPaths = new Set([
  "/login",
  "/logout",
  "/change-password",
  "/forgot-password",
  "/reset-password",
  "/frontend/auth/login",
  "/frontend/auth/logout",
  "/frontend/auth/change-password",
  "/frontend/auth/forgot-password",
  "/frontend/auth/reset-password",
]);

const pathToPage: Record<string, CockpitPage> = {
  "/": "dashboard",
  "/cockpit": "dashboard",
  "/dashboard": "dashboard",
  "/kalos": "kalos",
  "/chart": "market-chart",
  "/market-chart": "market-chart",
  "/trade-center": "trade-center",
  "/journal": "journal",
  "/connectors": "connectors",
  "/settings": "settings",
  "/risk": "risk",
};

const pageToPath: Record<CockpitPage, string> = {
  dashboard: "/cockpit",
  kalos: "/kalos",
  "market-chart": "/chart",
  "trade-center": "/trade-center",
  connectors: "/connectors",
  journal: "/journal",
  risk: "/risk",
  settings: "/settings",
};

function currentPath() {
  return window.location.pathname || "/";
}

function nextPathFromSearch() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/cockpit";
}

export function AuthRouter() {
  const { loading, session, logout } = useAuth();
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const sync = () => setPath(currentPath());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const navigate = useCallback((nextPath: string, replace = false) => {
    const normalized = nextPath || "/cockpit";
    if (replace) window.history.replaceState(null, "", normalized);
    else window.history.pushState(null, "", normalized);
    setPath(currentPath());
  }, []);

  const nextPath = useMemo(() => nextPathFromSearch(), [path]);

  useEffect(() => {
    if (loading) return;

    if (!session && !publicPaths.has(path)) {
      navigate(`/login?next=${encodeURIComponent(path)}`, true);
      return;
    }

    if (session && (path === "/" || path === "/login" || path === "/frontend/auth/login")) {
      navigate(nextPath, true);
    }
  }, [loading, navigate, nextPath, path, session]);

  useEffect(() => {
    if (loading || !session) return;

    const browserPath = currentPath();
    if (browserPath === "/" || browserPath === "/login" || browserPath === "/frontend/auth/login") {
      navigate(nextPathFromSearch(), true);
      return;
    }

    if (session.user.mustChangePassword && browserPath !== "/change-password" && browserPath !== "/frontend/auth/change-password") {
      navigate("/change-password", true);
      return;
    }

    if (!session.user.mustChangePassword && (browserPath === "/change-password" || browserPath === "/frontend/auth/change-password")) {
      navigate("/cockpit", true);
    }
  }, [loading, navigate, session]);

  if (loading) {
    return (
      <main className="razon-auth-screen">
        <section className="razon-auth-card">
          <div className="razon-auth-loading">Loading secure session...</div>
        </section>
      </main>
    );
  }

  if (!session) {
    if (path === "/forgot-password" || path === "/frontend/auth/forgot-password") return <ForgotPasswordPage onNavigate={navigate} />;
    if (path === "/reset-password" || path === "/frontend/auth/reset-password") return <ResetPasswordPage onNavigate={navigate} />;
    if (path === "/logout" || path === "/frontend/auth/logout") return <LogoutPage onNavigate={navigate} />;
    return <LoginPage nextPath={nextPath} onNavigate={navigate} />;
  }

  if (path === "/logout" || path === "/frontend/auth/logout") return <LogoutPage onNavigate={navigate} />;

  if (session.user.mustChangePassword) return <FirstPasswordChangePage />;

  if (session.license.status === "PENDING" || session.license.status === "MISSING") {
    return <LicenseActivationPage />;
  }

  if (session.license.status === "SUSPENDED" || session.license.status === "REVOKED") {
    return <LicenseAccessDeniedPage />;
  }

  if (path === "/profile" || path === "/frontend/profile") return <ProfilePage onNavigate={navigate} />;

  const activePage = pathToPage[path] ?? "dashboard";
  return (
    <RazonCockpit
      authUser={session.user}
      initialPage={activePage}
      licensePlan={session.plan}
      licenseStatus={session.license.status}
      onLogout={() => void logout().then(() => navigate("/login", true))}
      onNavigateProfile={() => navigate("/profile")}
      onPageChange={page => navigate(pageToPath[page])}
    />
  );
}
