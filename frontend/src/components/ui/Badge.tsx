import React from "react";

export function Badge({ variant, children }: { variant: "popular" | "beta" | "coming-soon" | "success" | "new"; children: React.ReactNode }) {
  const s = {
    popular: "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25 dark:border-amber-400/20",
    beta: "text-violet-700 dark:text-violet-300 bg-violet-500/10 border-violet-500/25 dark:border-violet-400/20",
    "coming-soon": "text-foreground/40 bg-foreground/[0.04] border-foreground/[0.08]",
    success: "text-teal-700 dark:text-teal-300 bg-teal-500/10 border-teal-500/25 dark:border-teal-400/20",
    new: "text-primary bg-primary/10 border-primary/20",
  };
  return <span className={`inline-flex items-center gap-1 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider rounded-full border ${s[variant]}`}>{children}</span>;
}
