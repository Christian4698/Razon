import type { ReactElement } from "react";
import { BarChart3, BookOpen, Cable, Eye, LineChart, Settings, Shield } from "lucide-react";
import type { CockpitPage } from "../app/cockpit.types";
import type { CockpitPageDefinition } from "../pages/page-registry";
import { useLanguage } from "@/i18n/useLanguage";

const mobileIcons: Record<CockpitPage, ReactElement> = {
  dashboard: <BarChart3 size={18} />,
  "kalos": <Eye size={18} />,
  "market-chart": <LineChart size={18} />,
  connectors: <Cable size={18} />,
  journal: <BookOpen size={18} />,
  risk: <Shield size={18} />,
  settings: <Settings size={18} />,
};

export function MobileBottomNav({
  activePage,
  pages,
  onSelect,
}: {
  activePage: CockpitPage;
  pages: readonly CockpitPageDefinition[];
  onSelect: (page: CockpitPage) => void;
}) {
  const { t } = useLanguage();
  const labelFor = (page: CockpitPage) => {
    if (page === "dashboard") return t("nav.dashboard");
    if (page === "kalos") return t("nav.kalos");
    if (page === "market-chart") return t("nav.marketChart");
    if (page === "connectors") return t("nav.connectors");
    if (page === "journal") return t("nav.journal");
    if (page === "risk") return t("nav.risk");
    return t("nav.settings");
  };

  return (
    <nav className="mobile-bottom-nav" aria-label={t("nav.mobile")}>
      {pages.map(page => (
        <button
          aria-label={labelFor(page.id)}
          className={page.id === activePage ? "is-active" : ""}
          key={page.id}
          onClick={() => onSelect(page.id)}
          type="button"
        >
          {mobileIcons[page.id]}
          <span>{labelFor(page.id).replace(t("nav.marketChart"), t("dashboard.tabs.chart")).replace(t("nav.risk"), t("dashboard.tabs.risk"))}</span>
        </button>
      ))}
    </nav>
  );
}
