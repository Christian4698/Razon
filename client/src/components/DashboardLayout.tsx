import Sidebar from "./Sidebar";
import RazonModeBanner from "./RazonModeBanner";
import { useRazonApi } from "@/hooks/useRazonApi";
import type { RazonStatus } from "@/lib/api";
import LanguageSelector from "./LanguageSelector";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const status = useRazonApi<RazonStatus>("/api/status");

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {title && (
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
            <div className="container flex flex-col gap-4 py-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{title}</h1>
                {description && <p className="text-muted-foreground mt-1">{description}</p>}
              </div>
              <LanguageSelector compact />
            </div>
          </div>
        )}
        <div className="container py-6">
          <div className="mb-6">
            <RazonModeBanner
              state={status.state}
              mode={status.data?.mode ?? "demo"}
            />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
