import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, BarChart3, TrendingUp, AlertCircle, Wallet, Settings, BarChart2, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: "RAZON Dashboard", href: "/dashboard", icon: <BarChart3 className="w-5 h-5" /> },
  { label: "RAZON Signals", href: "/signals", icon: <TrendingUp className="w-5 h-5" /> },
  { label: "RAZON Analysis", href: "/analysis", icon: <BarChart2 className="w-5 h-5" /> },
  { label: "RAZON Positions", href: "/positions", icon: <Wallet className="w-5 h-5" /> },
  { label: "RAZON Protect", href: "/protect", icon: <AlertCircle className="w-5 h-5" /> },
  { label: "RAZON Analytics", href: "/analytics", icon: <PieChart className="w-5 h-5" /> },
  { label: "RAZON Settings", href: "/settings", icon: <Settings className="w-5 h-5" /> },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("/dashboard");

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-card border border-border hover:bg-secondary transition-colors"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 z-40",
          "flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-sidebar-border">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center">
                <span className="text-sm font-bold text-accent-foreground">R</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground group-hover:text-accent transition-colors">
                  RAZON
                </h1>
                <p className="text-xs text-muted-foreground">AI Trading Analysis Platform</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                onClick={() => {
                  setCurrentPath(item.href);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  currentPath === item.href
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="flex-1 font-medium text-sm">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-1 text-xs rounded-full bg-accent/20 text-accent">
                    {item.badge}
                  </span>
                )}
              </a>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="p-3 rounded-lg bg-sidebar-accent/10 border border-sidebar-accent/20">
            <p className="text-xs text-muted-foreground mb-2">Powered by</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-sidebar-foreground">General Tech Consult</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Main Content Offset */}
      <div className="hidden md:block w-64" />
    </>
  );
}
