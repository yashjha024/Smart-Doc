import type { LucideIcon } from "lucide-react";

export type AppRoute =
  | "home"
  | "features"
  | "pricing"
  | "blog"
  | "workspace"
  | "convert"
  | "renamer"
  | "compressor"
  | "history"
  | "bulk-renamer"
  | string;

export type NavigationItem = {
  route: AppRoute;
  label: string;
  icon: LucideIcon;
};
