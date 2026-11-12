import type { CSSProperties } from "react";

/** Category accent classes (PDF = amber, Image = blue, File = teal), shared by tool UIs. */
export const ACCENTS: Record<string, { icon: string; bg: string; border: string; dot: string }> = {
  amber: { icon: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25 dark:border-amber-400/20", dot: "bg-amber-500 dark:bg-amber-400" },
  blue:  { icon: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-500/10",  border: "border-blue-500/25 dark:border-blue-400/20",  dot: "bg-blue-500 dark:bg-blue-400" },
  teal:  { icon: "text-teal-600 dark:text-teal-400",   bg: "bg-teal-500/10",  border: "border-teal-500/25 dark:border-teal-400/20",  dot: "bg-teal-500 dark:bg-teal-400" },
};

/** The 48px background grid used behind pages in the Figma design. */
export const GRID_BG: CSSProperties = {
  backgroundImage: "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
  backgroundSize: "48px 48px",
};
