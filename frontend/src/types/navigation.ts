import type { LucideIcon } from "lucide-react";

export type AppRoute = "workspace" | "convert" | "compressor" | "renamer" | "bulk-renamer" | "history";

export type NavigationItem = {
  route: AppRoute;
  label: string;
  icon: LucideIcon;
};
