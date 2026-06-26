import type { LucideIcon } from "lucide-react";

export type AppRoute = "dashboard" | "renamer" | "compressor" | "history" | "bulk-renamer";

export type NavigationItem = {
  route: AppRoute;
  label: string;
  icon: LucideIcon;
};
