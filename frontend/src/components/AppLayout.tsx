import { ArchiveRestore, Copy, FileCog, Gauge, History, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AppRoute, NavigationItem } from "../types/navigation";

const navigation: NavigationItem[] = [
  { route: "dashboard", label: "Dashboard", icon: Gauge },
  { route: "renamer", label: "Renamer", icon: FileCog },
  { route: "bulk-renamer", label: "Bulk Operations", icon: Copy },
  { route: "compressor", label: "Compressor", icon: ArchiveRestore },
  { route: "history", label: "History", icon: History },
];

type AppLayoutProps = {
  activeRoute: AppRoute;
  brandIcon: ReactNode;
  children: ReactNode;
  onNavigate: (route: AppRoute) => void;
};

export function AppLayout({ activeRoute, brandIcon, children, onNavigate }: AppLayoutProps) {
  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark">{brandIcon}</div>
          <div>
            <strong>DocRename</strong>
            <span>Local workspace</span>
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
