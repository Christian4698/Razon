import { useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { AuthShell } from "./AuthShell";

export function LogoutPage({ onNavigate }: { readonly onNavigate: (path: string) => void }) {
  const { logout } = useAuth();

  useEffect(() => {
    let cancelled = false;
    logout().finally(() => {
      if (!cancelled) onNavigate("/login");
    });

    return () => {
      cancelled = true;
    };
  }, [logout, onNavigate]);

  return (
    <AuthShell title="Signing out" description="Your RAZON session is being closed on this device.">
      <div className="razon-auth-loading">Closing secure session...</div>
    </AuthShell>
  );
}
