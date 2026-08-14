import React from "react";
import { motion } from "motion/react";
import { ToolDef } from "../../config/tools";
import { Badge } from "./Badge";

const A: Record<string, { icon: string; bg: string; border: string; dot: string }> = {
  amber: { icon: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25 dark:border-amber-400/20", dot: "bg-amber-500 dark:bg-amber-400" },
  blue:  { icon: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-500/10",  border: "border-blue-500/25 dark:border-blue-400/20",  dot: "bg-blue-500 dark:bg-blue-400" },
  teal:  { icon: "text-teal-600 dark:text-teal-400",   bg: "bg-teal-500/10",  border: "border-teal-500/25 dark:border-teal-400/20",  dot: "bg-teal-500 dark:bg-teal-400" },
};

export function ToolCard({ tool, onClick }: { tool: ToolDef; onClick: () => void }) {
  const ta = A[tool.accent];
  return (
    <motion.div onClick={onClick} whileHover={{ y: -2, scale: 1.01 }} transition={{ duration: 0.12 }}
      className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-border bg-card hover:border-foreground/[0.14] hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/20 cursor-pointer text-center transition-all duration-200">
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${ta.bg} ${ta.border}`}>
        <tool.Icon size={18} className={ta.icon} />
      </div>
      <div className="w-full">
        <div className="flex items-center justify-center gap-1.5 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-foreground leading-tight">{tool.name}</span>
          {tool.popular && <Badge variant="popular">Popular</Badge>}
          {tool.status === "beta" && <Badge variant="beta">Beta</Badge>}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{tool.description}</p>
      </div>
    </motion.div>
  );
}
