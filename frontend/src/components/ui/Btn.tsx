import React from "react";

export function Btn({ v = "primary", sz = "md", onClick, disabled, children, className = "" }: { v?: "primary" | "secondary" | "ghost" | "danger"; sz?: "sm" | "md" | "lg"; onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  const base = "inline-flex items-center gap-2 font-medium rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const vs = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 active:scale-[0.98]",
    secondary: "bg-card text-foreground border border-border hover:bg-foreground/[0.04] hover:border-foreground/[0.14]",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]",
    danger: "bg-destructive/8 text-destructive border border-destructive/20 hover:bg-destructive/15",
  };
  const szs = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${vs[v]} ${szs[sz]} ${className}`}>{children}</button>;
}
