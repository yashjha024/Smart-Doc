import { ArchiveRestore, Copy, FileCog, Gauge, History, ShieldCheck, Sun, Moon, type LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import type { AppRoute, NavigationItem } from "../types/navigation";

const navigation: NavigationItem[] = [
  { route: "workspace", label: "Workspace", icon: Gauge },
  { route: "convert", label: "Convert", icon: FileCog },
  { route: "compressor", label: "Compress", icon: ArchiveRestore },
  { route: "renamer", label: "Rename", icon: FileCog },
  { route: "bulk-renamer", label: "Bulk Operations", icon: Copy },
  { route: "history", label: "History", icon: History },
];

type AppLayoutProps = {
  activeRoute: AppRoute;
  brandIcon: ReactNode;
  children: ReactNode;
  onNavigate: (route: AppRoute) => void;
};

export function AppLayout({ activeRoute, brandIcon, children, onNavigate }: AppLayoutProps) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("theme") as "light" | "dark") || "dark";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark">{brandIcon}</div>
          <div>
            <strong>DocRename</strong>
            <span>Privacy-first workspace</span>
          </div>
        </div>

        <nav className="nav-list">
          {navigation.map((item) => (
            <NavButton
              key={item.route}
              icon={item.icon}
              isActive={activeRoute === item.route}
              label={item.label}
              onClick={() => onNavigate(item.route)}
            />
          ))}
        </nav>
        
        <div className="sidebar-footer">
          <div className="theme-switch">
            <button
              className={`theme-switch-btn ${theme === "light" ? "active" : ""}`}
              type="button"
              onClick={() => setTheme("light")}
              title="Light Mode"
            >
              <Sun size={14} /> Light
            </button>
            <button
              className={`theme-switch-btn ${theme === "dark" ? "active" : ""}`}
              type="button"
              onClick={() => setTheme("dark")}
              title="Dark Mode"
            >
              <Moon size={14} /> Dark
            </button>
          </div>
          <div className="sidebar-badge">
            <ShieldCheck aria-hidden="true" size={14} />
            <span>Privacy-first processing</span>
          </div>
        </div>
      </aside>

      <main className="main-panel">{children}</main>
    </div>
  );
}

type NavButtonProps = {
  icon: LucideIcon;
  isActive: boolean;
  label: string;
  onClick: () => void;
};

function NavButton({ icon: Icon, isActive, label, onClick }: NavButtonProps) {
  return (
    <button className={isActive ? "nav-item active" : "nav-item"} type="button" onClick={onClick}>
      <Icon aria-hidden="true" size={18} />
      <span>{label}</span>
    </button>
  );
}
