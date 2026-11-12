import { motion } from "motion/react";
import { ToolDef } from "../../config/tools";
import { ACCENTS } from "../../config/accents";
import { Badge } from "./Badge";

export function ToolCard({ tool, onClick }: { tool: ToolDef; onClick: () => void }) {
  const ta = ACCENTS[tool.accent];
  return (
    <motion.button type="button" onClick={onClick} whileHover={{ y: -2, scale: 1.01 }} transition={{ duration: 0.12 }}
      className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-border bg-card hover:border-foreground/[0.14] hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/20 cursor-pointer text-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
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
    </motion.button>
  );
}
