import React from "react";
import { motion } from "motion/react";
import { CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown, Download } from "lucide-react";
import { ToolDef } from "../../config/tools";
import { Badge } from "./Badge";
import { formatBytes } from "../../utils/format";

const A: Record<string, { icon: string; bg: string; border: string; dot: string }> = {
  amber: { icon: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25 dark:border-amber-400/20", dot: "bg-amber-500 dark:bg-amber-400" },
  blue:  { icon: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-500/10",  border: "border-blue-500/25 dark:border-blue-400/20",  dot: "bg-blue-500 dark:bg-blue-400" },
  teal:  { icon: "text-teal-600 dark:text-teal-400",   bg: "bg-teal-500/10",  border: "border-teal-500/25 dark:border-teal-400/20",  dot: "bg-teal-500 dark:bg-teal-400" },
};

export type FileItemStatus = "idle" | "processing" | "success" | "error";

export interface MockFile {
  /** Local id for React keys; never sent to the server. */
  id: string; name: string; originalSize: number;
  processedSize?: number; status: FileItemStatus; errorMsg?: string;
  result_metadata?: any;
  /** Server reference returned by upload. */
  fileRef?: string;
  jobId?: string;
  /** Server reference of the processed result. */
  outputRef?: string;
}

export function FileItem({ file, tool, onRemove, showResult, progress, onMoveUp, onMoveDown, showReorder, onDownload }: { file: MockFile; tool: ToolDef; onRemove?: (id: string) => void; showResult?: boolean; progress?: number; onMoveUp?: () => void; onMoveDown?: () => void; showReorder?: boolean; onDownload?: () => void }) {
  const fileExt = (name: string) => name.split(".").pop()?.toUpperCase() ?? "FILE";
  const ext = fileExt(file.name);
  const ta = A[tool.accent];
  
  let processed = file.processedSize ?? file.originalSize;
  let pct = null;
  if (file.result_metadata?.metrics) {
      processed = file.result_metadata.metrics.compressed_size_bytes;
      pct = file.result_metadata.metrics.savings_percent;
  } else if (file.processedSize) {
      pct = ((1 - file.processedSize / file.originalSize) * 100).toFixed(0);
  }
  
  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 8 }}
      className={`group flex items-center gap-3 px-4 py-3 border-b border-border/60 last:border-b-0 hover:bg-foreground/[0.02] transition-colors ${file.status === "error" ? "bg-destructive/4" : ""}`}>
      {showReorder && (
        <div className="flex flex-col gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onMoveUp} disabled={!onMoveUp} aria-label={`Move ${file.name} up`} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp size={12} /></button>
          <button onClick={onMoveDown} disabled={!onMoveDown} aria-label={`Move ${file.name} down`} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown size={12} /></button>
        </div>
      )}
      <div className={`flex-shrink-0 h-8 px-2 rounded-md flex items-center text-[10px] font-bold tracking-wide border ${ta.bg} ${ta.border} ${ta.icon}`}>{ext.slice(0, 4)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
          <span className="text-xs text-muted-foreground">{formatBytes(file.originalSize)}</span>
          {showResult && (file.result_metadata?.metrics || file.processedSize !== undefined) && (<><span className="text-muted-foreground/40 text-xs">→</span><span className="text-xs text-teal-600 dark:text-teal-400">{formatBytes(processed)}</span>{Number(pct) > 0 && <Badge variant="success">-{pct}%</Badge>}</>)}
          {file.status === "error" && <span className="text-xs text-destructive">{file.errorMsg}</span>}
        </div>
        {file.status === "processing" && progress !== undefined && (
          <div className="mt-1.5 h-0.5 bg-muted rounded-full overflow-hidden w-full max-w-[180px]">
            <motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {file.status === "processing" && <svg className="w-4 h-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>}
        {file.status === "success" && <CheckCircle2 size={14} className="text-teal-600 dark:text-teal-400" />}
        {file.status === "success" && onDownload && (
          <button onClick={onDownload} aria-label={`Download ${file.name}`} className="ml-1 h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1 text-primary hover:bg-primary/10 transition-colors"><Download size={12} /> Save</button>
        )}
        {file.status === "error" && <AlertCircle size={14} className="text-destructive" />}
        {onRemove && file.status !== "processing" && (
          <button onClick={() => onRemove(file.id)} aria-label={`Remove ${file.name}`} className="w-6 h-6 rounded-md hover:bg-foreground/[0.07] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"><X size={11} /></button>
        )}
      </div>
    </motion.div>
  );
}
