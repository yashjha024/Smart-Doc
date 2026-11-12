import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload, ChevronRight, ChevronLeft, Download, RotateCcw, Check, AlertCircle, ArrowRight,
  Lock, Settings, Zap, CheckCircle2, Clock, Shield, Home, Hourglass,
} from "lucide-react";
import { toast } from "sonner";
import { ToolDef } from "../config/tools";
import { ACCENTS, GRID_BG } from "../config/accents";
import { Btn } from "../components/ui/Btn";
import { Badge } from "../components/ui/Badge";
import { FileItem, MockFile } from "../components/ui/FileItem";
import { api, ExpiredFileError } from "../services/api";
import type { AppRoute } from "../types/navigation";
import { formatBytes } from "../utils/format";

type WorkStep = "upload" | "options" | "processing" | "done" | "error" | "expired";

const STEPS: { id: WorkStep; label: string }[] = [
  { id: "upload", label: "Upload" }, { id: "options", label: "Settings" }, { id: "processing", label: "Process" }, { id: "done", label: "Done" },
];

const CONVERSIONS: Record<string, [string, string]> = { "pdf-to-jpg": ["PDF", "JPG"], "image-convert": ["IMG", "WEBP"], "pdf-to-word": ["PDF", "DOCX"] };

const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 transition-colors";

function StepBar({ step }: { step: WorkStep }) {
  const normalized = step === "error" ? "processing" : step === "expired" ? "done" : step;
  const idx = STEPS.findIndex(s => s.id === normalized);
  const isErr = step === "error";
  return (
    <ol className="flex items-center" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < idx; const active = i === idx; const errActive = active && isErr;
        return (
          <li key={s.id} className="flex items-center" aria-current={active ? "step" : undefined}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${errActive ? "bg-destructive/10 border-destructive text-destructive" : done ? "bg-primary border-primary text-white" : active ? "bg-primary/10 border-primary text-primary" : "bg-transparent border-border text-muted-foreground"}`}>
                {done ? <Check size={11} /> : errActive ? <AlertCircle size={11} /> : i + 1}
              </div>
              <span className={`hidden sm:block text-xs font-medium ${errActive ? "text-destructive" : active ? "text-foreground" : done ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`w-6 sm:w-14 h-px mx-2 transition-all ${i < idx ? "bg-primary" : "bg-border"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

export function ToolWorkspacePage({ tool, onNav }: { tool: ToolDef; onNav: (p: AppRoute) => void }) {
  const ta = ACCENTS[tool.accent];
  const combines = !!tool.combinesFiles;
  const minFiles = tool.id === "merge-pdf" ? 2 : 1;
  const COMBINED_LABELS: Record<string, { name: string; done: (n: number) => string; button: string; list: string }> = {
    "merge-pdf": { name: "merged.pdf", done: n => `${n} PDFs merged into one`, button: "Download merged PDF", list: "Merged from" },
    "zip-files": { name: "files.zip", done: n => `${n} file${n !== 1 ? "s" : ""} zipped into one archive`, button: "Download ZIP", list: "Zipped files" },
    "image-to-pdf": { name: "images.pdf", done: n => `${n} image${n !== 1 ? "s" : ""} combined into one PDF`, button: "Download PDF", list: "Pages, in order" },
  };
  const combined = COMBINED_LABELS[tool.id] ?? COMBINED_LABELS["merge-pdf"];
  const isCompress = tool.id.includes("compress");
  const comingSoon = tool.status === "coming-soon";

  const defaultConfig = () => Object.fromEntries(tool.options.map(o => [o.id, o.defaultValue])) as Record<string, any>;

  const [step, setStep] = useState<WorkStep>("upload");
  const [files, setFiles] = useState<MockFile[]>([]);
  const [config, setConfig] = useState<Record<string, any>>(defaultConfig);
  const [mergeResult, setMergeResult] = useState<{ outputRef: string; name: string } | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [pct, setPct] = useState(0);
  const filesRef = useRef<MockFile[]>(files);
  filesRef.current = files;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset everything when switching tools.
  useEffect(() => {
    setConfig(defaultConfig());
    setStep("upload");
    setFiles([]);
    setMergeResult(null);
    setJobError(null);
  }, [tool]);

  // ─── Files ────────────────────────────────────────────────────────────────
  const openPicker = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) addFiles(selected);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files));
  };

  const addFiles = async (incoming: File[]) => {
    // Dropped files bypass the input's accept filter, so check extensions here too.
    const allowed = tool.accepts === "*" ? null : tool.accepts.split(",").map(s => s.trim().toLowerCase());
    const accepted = allowed ? incoming.filter(f => allowed.some(ext => f.name.toLowerCase().endsWith(ext))) : incoming;
    const rejected = incoming.length - accepted.length;
    if (rejected > 0) toast.error(`${rejected} file${rejected > 1 ? "s" : ""} skipped — ${tool.name} accepts ${tool.accepts.replace(/,/g, ", ")}`);
    if (accepted.length === 0) return;

    const newItems: MockFile[] = accepted.map(f => ({
      id: Math.random().toString(36).substring(2, 10),
      name: f.name,
      originalSize: f.size,
      status: "processing",
    }));
    setFiles(prev => [...prev, ...newItems]);

    for (let i = 0; i < accepted.length; i++) {
      try {
        const res = await api.uploadFile(accepted[i]);
        setFiles(prev => prev.map(f => f.id === newItems[i].id ? { ...f, status: "idle", fileRef: res.file_id } : f));
      } catch (err: any) {
        setFiles(prev => prev.map(f => f.id === newItems[i].id ? { ...f, status: "error", errorMsg: err?.message || "Upload failed" } : f));
      }
    }
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const moveFile = (idx: number, dir: -1 | 1) => setFiles(prev => {
    const target = idx + dir;
    if (target < 0 || target >= prev.length) return prev;
    const next = [...prev];
    [next[idx], next[target]] = [next[target], next[idx]];
    return next;
  });

  const resetWorkspace = () => {
    setFiles([]);
    setMergeResult(null);
    setJobError(null);
    setConfig(defaultConfig());
    setStep("upload");
  };

  // Retry with the same uploads (they stay on the server for 60 minutes).
  const retry = () => {
    setFiles(prev => prev.filter(f => f.fileRef).map(f => ({ ...f, status: "idle", errorMsg: undefined, jobId: undefined, outputRef: undefined, result_metadata: undefined, outputs: undefined })));
    setMergeResult(null);
    setJobError(null);
    setStep("options");
  };

  // ─── Jobs ─────────────────────────────────────────────────────────────────
  const failAll = (message: string) => {
    setJobError(message);
    setFiles(prev => prev.map(f => ({ ...f, status: "error", errorMsg: undefined })));
    setStep("error");
  };

  const startJob = async () => {
    const ready = files.filter(f => f.status === "idle" && f.fileRef);
    if (ready.length === 0) { toast.error("No valid files to process"); return; }
    if (ready.length < minFiles) { toast.error(`Add at least ${minFiles} files.`); return; }

    // Validate options before switching to the processing state.
    const finalConfig: Record<string, any> = {};
    for (const opt of visibleOptions) {
      const v = config[opt.id];
      if (v !== "" && v !== undefined && v !== null) finalConfig[opt.id] = v;
    }
    if (config.target_size_kb) finalConfig.target_size_kb = config.target_size_kb;
    if (tool.id === "split-pdf") {
      const parts = String(finalConfig.ranges || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      if (parts.length === 0) { toast.error("Enter the pages to keep, e.g. 1-3, 5"); return; }
      finalConfig.ranges = parts;
    }

    setJobError(null);
    setMergeResult(null);
    setPct(0);
    setStep("processing");
    // Files that failed to upload can't be processed.
    setFiles(prev => prev.filter(f => f.status !== "error").map(f => ({ ...f, status: "processing", errorMsg: undefined })));

    const create = (inputRefs: string[]) => api.createJob({ tool_id: tool.id, input_files: inputRefs, configuration: finalConfig });

    if (combines) {
      try {
        const job = await create(ready.map(f => f.fileRef!));
        setFiles(prev => prev.map(f => ({ ...f, jobId: job.id })));
      } catch (err: any) {
        failAll(err?.message || "Failed to start job");
      }
      return;
    }

    // Single-file tools: one job per file so each gets its own result.
    await Promise.all(ready.map(async f => {
      try {
        const job = await create([f.fileRef!]);
        setFiles(prev => prev.map(p => p.id === f.id ? { ...p, jobId: job.id } : p));
      } catch (err: any) {
        setFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: "error", errorMsg: err?.message || "Failed to start" } : p));
      }
    }));
  };

  // Poll every pending job until it finishes, with an overall timeout.
  useEffect(() => {
    if (step !== "processing") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000;
    let consecutiveErrors = 0;

    const tick = async () => {
      if (cancelled) return;
      const pendingJobIds = [...new Set(filesRef.current.filter(f => f.status === "processing" && f.jobId).map(f => f.jobId!))];

      if (pendingJobIds.length > 0) {
        try {
          const jobs = await Promise.all(pendingJobIds.map(id => api.getJob(id)));
          consecutiveErrors = 0;
          if (cancelled) return;
          for (const job of jobs) {
            if (job.status === "completed") {
              if (combines) setMergeResult({ outputRef: job.output_files[0], name: combined.name });
              setFiles(prev => prev.map(f => f.jobId === job.id ? {
                ...f, status: "success", outputRef: combines ? undefined : job.output_files[0], result_metadata: job.result_metadata,
                outputs: job.result_metadata?.tool_specific?.outputs,
              } : f));
            } else if (job.status === "failed") {
              const msg = job.error_information || "Processing failed";
              if (combines) { failAll(msg); return; }
              setFiles(prev => prev.map(f => f.jobId === job.id ? { ...f, status: "error", errorMsg: msg } : f));
            }
          }
        } catch {
          consecutiveErrors += 1;
          if (consecutiveErrors >= 5) { failAll("Lost connection to the server. Please try again."); return; }
        }
      }

      if (Date.now() - startedAt > TIMEOUT_MS) {
        failAll("This is taking too long. Please try again with a smaller file.");
        return;
      }
      timer = setTimeout(tick, 1000);
    };

    timer = setTimeout(tick, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [step, combines]);

  // Progress ring: real share of finished files, plus a slow creep so a single long job still moves.
  useEffect(() => {
    if (step !== "processing") return;
    const started = Date.now();
    const id = setInterval(() => {
      const current = filesRef.current;
      const total = Math.max(current.length, 1);
      const finished = current.filter(f => f.status === "success" || f.status === "error").length;
      const creep = 90 * (1 - Math.exp(-(Date.now() - started) / 8000)); // approaches 90%
      const share = (finished / total) * 100;
      setPct(Math.max(share, Math.min(creep, share + 100 / total * 0.9)));
    }, 200);
    return () => clearInterval(id);
  }, [step]);

  // Move to done/error once nothing is processing any more.
  useEffect(() => {
    if (step !== "processing" || files.length === 0) return;
    if (files.some(f => f.status === "processing")) return;
    const succeeded = files.filter(f => f.status === "success").length;
    if (succeeded > 0) {
      setPct(100);
      setTimeout(() => setStep("done"), 300);
    } else {
      setJobError(files.find(f => f.errorMsg)?.errorMsg || "Processing failed");
      setStep("error");
    }
  }, [files, step]);

  // ─── Downloads ────────────────────────────────────────────────────────────
  const saveOutput = async (outputRef: string | undefined, fallbackName: string) => {
    if (!outputRef) return;
    try {
      await api.saveFile(outputRef, fallbackName);
    } catch (err: any) {
      if (err instanceof ExpiredFileError) { setStep("expired"); return; }
      toast.error(err?.message || "Download failed");
    }
  };

  const downloadAll = async () => {
    if (mergeResult) { await saveOutput(mergeResult.outputRef, mergeResult.name); return; }
    for (const f of files.filter(f => f.status === "success")) {
      if (f.outputs) {
        for (const o of f.outputs) await saveOutput(o.ref, o.name.split("/").pop() || o.name);
      } else if (f.outputRef) {
        await saveOutput(f.outputRef, f.name);
      }
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const visibleOptions = tool.options.filter(o => !o.showIf || o.showIf.values.includes(String(config[o.showIf.option])));
  const uploading = files.some(f => f.status === "processing");
  const readyCount = files.filter(f => f.status === "idle").length;
  const canContinue = !uploading && readyCount >= minFiles;
  const successFiles = files.filter(f => f.status === "success");
  const extractedCount = successFiles.reduce((n, f) => n + (f.outputs?.length ?? 0), 0);
  const failedFiles = files.filter(f => f.status === "error");
  const outputFormat = successFiles[0]?.result_metadata?.tool_specific?.output_format;

  const origTotal = successFiles.reduce((s, f) => s + f.originalSize, 0);
  const procTotal = successFiles.reduce((s, f) => s + (f.result_metadata?.metrics?.compressed_size_bytes ?? f.originalSize), 0);
  const hasMetrics = successFiles.some(f => f.result_metadata?.metrics);
  const savedPct = origTotal > 0 ? (1 - procTotal / origTotal) * 100 : 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 bg-background">
      <div className="pointer-events-none fixed inset-0 opacity-60" style={GRID_BG} />
      <input type="file" ref={fileInputRef} className="hidden" multiple accept={tool.accepts === "*" ? undefined : tool.accepts} onChange={handleFileChange} />
      <div className="relative pt-[64px]">
        <div className="max-w-4xl mx-auto px-5 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 py-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <button onClick={() => onNav("home")} className="hover:text-foreground transition-colors flex items-center gap-1"><Home size={13} /> All tools</button>
            <ChevronRight size={12} />
            <span className={`font-medium ${ta.icon}`}>{tool.name}</span>
          </nav>

          {/* Header */}
          <div className="flex items-start gap-4 mb-8 pb-8 border-b border-border">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${ta.bg} ${ta.border}`}><tool.Icon size={20} className={ta.icon} /></div>
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{tool.name}</h1>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${ta.bg} ${ta.border} ${ta.icon}`}>{tool.category}</span>
                {tool.status === "beta" && <Badge variant="beta">Beta</Badge>}
                {comingSoon && <Badge variant="coming-soon">Coming soon</Badge>}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{tool.longDescription}</p>
            </div>
          </div>

          {comingSoon ? (
            <div className="flex flex-col items-center py-16 gap-6 text-center pb-24">
              <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center"><Hourglass size={26} className="text-muted-foreground" /></div>
              <div className="max-w-sm">
                <h2 className="text-lg font-semibold text-foreground mb-2">This tool is on the way</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{tool.name} isn't ready yet. In the meantime, the other tools work right now.</p>
              </div>
              <Btn v="primary" onClick={() => onNav("home")}><ChevronLeft size={13} /> Browse working tools</Btn>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-8">
                <StepBar step={step} />
                <span className="text-xs text-muted-foreground hidden sm:block" style={{ fontFamily: "var(--font-mono)" }}>{files.length} file{files.length !== 1 ? "s" : ""} queued</span>
              </div>

              {/* Steps swap immediately (no exit animation to wait on), then fade in. */}
                <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="pb-24">

                  {/* ─── Upload ─── */}
                  {step === "upload" && (
                    <div className="space-y-4">
                      {CONVERSIONS[tool.id] && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                          <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${ta.bg} ${ta.border} ${ta.icon}`} style={{ fontFamily: "var(--font-mono)" }}>{CONVERSIONS[tool.id][0]}</div>
                          <ArrowRight size={14} className="text-muted-foreground" />
                          <div className="px-3 py-1.5 rounded-lg text-xs font-bold border border-primary/20 bg-primary/10 text-primary" style={{ fontFamily: "var(--font-mono)" }}>{CONVERSIONS[tool.id][1]}</div>
                          <span className="text-xs text-muted-foreground">You can change the format in the next step</span>
                        </div>
                      )}
                      <div
                        role="button" tabIndex={0} aria-label={`Choose files for ${tool.name}`}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); } }}
                        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={handleDrop} onClick={openPicker}
                        className={`relative flex flex-col items-center justify-center gap-4 p-12 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${drag ? "border-primary/60 bg-primary/[0.04] scale-[1.005]" : "border-border hover:border-foreground/[0.20] hover:bg-foreground/[0.015]"}`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${drag ? `${ta.bg} ${ta.border}` : "bg-muted border-border"}`}><Upload size={22} className={drag ? ta.icon : "text-muted-foreground"} /></div>
                        <div className="text-center">
                          <p className="text-base font-semibold text-foreground mb-1">{drag ? "Release to upload" : combines ? "Drop multiple files here" : "Drop files here"}</p>
                          <p className="text-sm text-muted-foreground">or click to browse your computer</p>
                        </div>
                        <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-muted" style={{ fontFamily: "var(--font-mono)" }}>{tool.accepts === "*" ? "Any file type" : tool.accepts}</span>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 mt-1"><Lock size={10} /> Files are automatically deleted after 1 hour</div>
                      </div>

                      <AnimatePresence>
                        {files.length > 0 && (
                          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border overflow-hidden bg-card">
                            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-muted/30">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{files.length} file{files.length !== 1 ? "s" : ""}</span>
                                {tool.orderMatters && files.length > 1 && <span className="text-xs text-muted-foreground">· use the arrows to set the order</span>}
                              </div>
                              <button onClick={() => setFiles([])} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Clear all</button>
                            </div>
                            <ul>
                              {files.map((f, i) => (
                                <li key={f.id}>
                                  <FileItem file={f} tool={tool} onRemove={removeFile} showReorder={!!tool.orderMatters && files.length > 1}
                                    onMoveUp={i > 0 ? () => moveFile(i, -1) : undefined} onMoveDown={i < files.length - 1 ? () => moveFile(i, 1) : undefined} />
                                </li>
                              ))}
                            </ul>
                            <div className="px-4 py-2.5 border-t border-border">
                              <button onClick={openPicker} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"><span className="w-4 h-4 rounded-md bg-primary/10 flex items-center justify-center text-[11px]">+</span>Add more files</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {files.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-end gap-3">
                          {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
                          {!uploading && readyCount < minFiles && <span className="text-xs text-muted-foreground">Add at least {minFiles} files</span>}
                          <Btn v="primary" disabled={!canContinue} onClick={() => setStep("options")}>Continue <ChevronRight size={15} /></Btn>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* ─── Settings ─── */}
                  {step === "options" && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      <div className="lg:col-span-2 space-y-3">
                        <div className="rounded-xl border border-border overflow-hidden bg-card">
                          <div className="px-4 py-2.5 border-b border-border bg-muted/30"><span className="text-xs font-medium text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{readyCount} file{readyCount !== 1 ? "s" : ""} selected</span></div>
                          <ul>
                            {files.filter(f => f.status === "idle").map(f => (
                              <li key={f.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-b-0">
                                <tool.Icon size={12} className={`flex-shrink-0 ${ta.icon}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                                  <p className="text-[11px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{formatBytes(f.originalSize)}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {isCompress && <EstimateCard tool={tool} config={config} total={files.filter(f => f.status === "idle").reduce((s, f) => s + f.originalSize, 0)} />}
                      </div>

                      <div className="lg:col-span-3 space-y-4">
                        {tool.options.length === 0 && tool.id !== "image-compress" ? (
                          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center border border-dashed border-border rounded-xl">
                            <Settings size={24} className="text-muted-foreground opacity-30" />
                            <p className="text-sm text-muted-foreground">No setup needed — we'll use the best settings automatically.</p>
                          </div>
                        ) : (
                          visibleOptions.map(opt => (
                            <fieldset key={opt.id} className="p-5 rounded-xl border border-border bg-card">
                              {opt.type === "text" || opt.type === "number" ? (
                                <>
                                  <label htmlFor={`opt-${opt.id}`} className="text-sm font-semibold text-foreground block mb-1.5">{opt.label.replace(/\s*\(.*\)/, "")}</label>
                                  {tool.id === "split-pdf" && <p className="text-xs text-muted-foreground mb-3">Separate ranges with commas. Use a hyphen for a range of pages.</p>}
                                  <div className="relative">
                                    <input id={`opt-${opt.id}`} type={opt.type} inputMode={opt.type === "number" ? "numeric" : undefined} min={opt.min} max={opt.max}
                                      value={config[opt.id] ?? ""}
                                      onChange={e => setConfig(p => ({ ...p, [opt.id]: opt.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value }))}
                                      placeholder={opt.placeholder ?? (opt.label.match(/\((?:e\.g\.\s*)?(.*?)\)/)?.[1] ? `e.g. ${opt.label.match(/\((?:e\.g\.\s*)?(.*?)\)/)![1]}` : "")}
                                      className={`${inputClass} ${opt.unit ? "pr-10" : ""}`} style={{ fontFamily: "var(--font-mono)" }} />
                                    {opt.unit && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none" style={{ fontFamily: "var(--font-mono)" }}>{opt.unit}</span>}
                                  </div>
                                </>
                              ) : (
                                <legend className="text-sm font-semibold text-foreground mb-4 float-left w-full">{opt.label}</legend>
                              )}
                              {opt.type === "radio" && opt.choices && (
                                <div className="space-y-2 clear-both">
                                  {opt.choices.map(c => {
                                    const sel = config[opt.id] === c.value;
                                    return (
                                      <label key={c.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${sel ? `${ta.border} ${ta.bg}` : "border-border hover:border-foreground/[0.14] hover:bg-foreground/[0.02]"}`}>
                                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${sel ? "border-primary bg-primary" : "border-muted-foreground"}`}>{sel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}</div>
                                        <input type="radio" className="sr-only" name={opt.id} value={c.value} checked={sel} onChange={() => setConfig(p => ({ ...p, [opt.id]: c.value }))} />
                                        <div><span className="text-sm font-medium text-foreground">{c.label}</span>{c.hint && <span className="text-xs text-muted-foreground ml-2">{c.hint}</span>}</div>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              {opt.type === "slider" && (
                                <div className="space-y-3 clear-both">
                                  <div className="flex justify-between text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                                    <span>{opt.min}{opt.unit}</span><span className={`font-bold text-sm ${ta.icon}`}>{config[opt.id] ?? opt.defaultValue}{opt.unit}</span><span>{opt.max}{opt.unit}</span>
                                  </div>
                                  <input type="range" aria-label={opt.label} min={opt.min} max={opt.max} step={opt.step ?? 1} value={config[opt.id] ?? opt.defaultValue}
                                    onChange={e => setConfig(p => ({ ...p, [opt.id]: Number(e.target.value) }))} className="w-full h-1 appearance-none rounded-full bg-muted cursor-pointer accent-primary" />
                                </div>
                              )}
                            </fieldset>
                          ))
                        )}

                        {tool.id === "image-compress" && (
                          <div className="p-5 rounded-xl border border-border bg-card">
                            <label htmlFor="opt-target-size" className="text-sm font-semibold text-foreground block mb-1.5">Target size <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
                            <p className="text-xs text-muted-foreground mb-3">We'll find the best quality that fits under this size, in KB.</p>
                            <input id="opt-target-size" type="number" min={1} placeholder="e.g. 500" value={config.target_size_kb ?? ""}
                              onChange={e => setConfig(p => ({ ...p, target_size_kb: e.target.value ? parseInt(e.target.value) : undefined }))}
                              className={inputClass} style={{ fontFamily: "var(--font-mono)" }} />
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <Btn v="ghost" onClick={() => setStep("upload")}><ChevronLeft size={15} /> Back</Btn>
                          <Btn v="primary" onClick={startJob}><Zap size={14} /> Start</Btn>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Processing ─── */}
                  {step === "processing" && <ProcessingView tool={tool} files={files} pct={pct} />}

                  {/* ─── Done ─── */}
                  {step === "done" && (
                    <div className="space-y-5">
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 rounded-2xl bg-teal-500/[0.07] border border-teal-500/20">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0"><CheckCircle2 size={18} className="text-teal-600 dark:text-teal-400" /></div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {mergeResult ? combined.done(successFiles.length) : extractedCount > 0 ? `${extractedCount} file${extractedCount !== 1 ? "s" : ""} extracted` : `${successFiles.length} file${successFiles.length !== 1 ? "s" : ""} ready to download`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Files are deleted in 60 min
                            {failedFiles.length > 0 && <span className="text-destructive"> · {failedFiles.length} file{failedFiles.length > 1 ? "s" : ""} could not be processed</span>}
                          </p>
                        </div>
                        <Btn v="primary" sz="sm" onClick={downloadAll}>
                          <Download size={14} /> {mergeResult ? combined.button : extractedCount > 1 ? `Download all (${extractedCount})` : successFiles.length > 1 ? `Download all (${successFiles.length})` : outputFormat === "zip" ? "Download ZIP" : "Download"}
                        </Btn>
                      </motion.div>

                      {isCompress && hasMetrics && savedPct > 0 && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="grid grid-cols-3 gap-3">
                          {[
                            { label: "Original", value: formatBytes(origTotal), sub: null, accent: false },
                            { label: "Compressed", value: formatBytes(procTotal), sub: null, accent: false },
                            { label: "Saved", value: `${savedPct.toFixed(1)}%`, sub: formatBytes(origTotal - procTotal), accent: true },
                          ].map(({ label, value, sub, accent }) => (
                            <div key={label} className={`rounded-xl border p-4 text-center ${accent ? "bg-teal-500/[0.06] border-teal-500/20" : "bg-card border-border"}`}>
                              <p className="text-[11px] text-muted-foreground mb-1" style={{ fontFamily: "var(--font-mono)" }}>{label}</p>
                              <p className={`text-lg font-bold ${accent ? "text-teal-600 dark:text-teal-400" : "text-foreground"}`} style={{ fontFamily: "var(--font-mono)" }}>{value}</p>
                              {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>{sub} smaller</p>}
                            </div>
                          ))}
                        </motion.div>
                      )}

                      <div className="rounded-xl border border-border overflow-hidden bg-card">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/30"><span className="text-xs font-medium text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{mergeResult ? combined.list : "Your results"}</span></div>
                        <ul>
                          {files.map((f, i) => (
                            <motion.li key={f.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                              <FileItem file={f} tool={tool} showResult onDownload={f.outputRef && !f.outputs ? () => saveOutput(f.outputRef, f.name) : undefined} />
                              {f.outputs && (
                                <ul className="border-t border-border/50 bg-muted/20">
                                  {f.outputs.map(o => (
                                    <li key={o.ref} className="flex items-center gap-3 pl-10 pr-4 py-2 border-b border-border/40 last:border-b-0">
                                      <span className="flex-1 min-w-0 text-xs text-foreground truncate" style={{ fontFamily: "var(--font-mono)" }}>{o.name}</span>
                                      <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{formatBytes(o.size)}</span>
                                      <button onClick={() => saveOutput(o.ref, o.name.split("/").pop() || o.name)} aria-label={`Download ${o.name}`} className="h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1 text-primary hover:bg-primary/10 transition-colors"><Download size={12} /> Save</button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-3 pt-1">
                        <Btn v="secondary" onClick={resetWorkspace}><RotateCcw size={13} /> Do more files</Btn>
                        <Btn v="ghost" onClick={() => onNav("home")}><ChevronLeft size={13} /> All tools</Btn>
                      </div>
                    </div>
                  )}

                  {/* ─── Error ─── */}
                  {step === "error" && (
                    <div className="flex flex-col items-center py-16 gap-6 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-destructive/8 border border-destructive/20 flex items-center justify-center"><AlertCircle size={26} className="text-destructive" /></div>
                      <div className="max-w-sm"><h2 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h2><p className="text-sm text-muted-foreground leading-relaxed">{jobError}</p></div>
                      <div className="w-full max-w-sm p-4 rounded-xl bg-card border border-border text-left">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2.5" style={{ fontFamily: "var(--font-mono)" }}>Things to try</p>
                        <ul className="space-y-1.5">
                          {["Make sure the file isn't password protected", "Check the file opens correctly on your device", "Try a different file to see if the problem persists"].map(tip => (
                            <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground"><span className="text-primary mt-0.5 flex-shrink-0">·</span>{tip}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        <Btn v="primary" onClick={retry}><RotateCcw size={13} /> Try again</Btn>
                        <Btn v="secondary" onClick={resetWorkspace}><Upload size={13} /> Use a different file</Btn>
                      </div>
                    </div>
                  )}

                  {/* ─── Expired ─── */}
                  {step === "expired" && (
                    <div className="flex flex-col items-center py-16 gap-6 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center"><Clock size={26} className="text-muted-foreground" /></div>
                      <div className="max-w-sm"><h2 className="text-lg font-semibold text-foreground mb-2">Your download link has expired</h2><p className="text-sm text-muted-foreground leading-relaxed">For your privacy, processed files are automatically deleted after <span className="text-foreground font-medium">60 minutes</span>. Just upload your file again — it only takes a moment.</p></div>
                      <div className="w-full max-w-sm p-4 rounded-xl bg-card border border-border flex items-start gap-3"><Shield size={15} className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-muted-foreground text-left leading-relaxed">Your original file was deleted too. Nothing is kept after the timer runs out.</p></div>
                      <div className="flex gap-3">
                        <Btn v="primary" onClick={resetWorkspace}><Upload size={13} /> Start over</Btn>
                        <Btn v="ghost" onClick={() => onNav("home")}><ChevronLeft size={13} /> All tools</Btn>
                      </div>
                    </div>
                  )}
                </motion.div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EstimateCard({ tool, config, total }: { tool: ToolDef; config: Record<string, any>; total: number }) {
  // Rough guide only; real savings depend on the file's content.
  let reduction: number;
  if (tool.id === "compress-pdf") reduction = config.mode === "high" ? 0.75 : config.mode === "low" ? 0.15 : 0.55;
  else { const q = Number(config.quality ?? 80); reduction = q <= 30 ? 0.75 : q <= 60 ? 0.55 : q <= 85 ? 0.35 : 0.15; }
  const out = Math.round(total * (1 - reduction));
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3" style={{ fontFamily: "var(--font-mono)" }}>Estimated result</p>
      <div className="space-y-1.5" style={{ fontFamily: "var(--font-mono)" }}>
        {[["Original size", formatBytes(total), "text-foreground"], ["After compression", `~${formatBytes(out)}`, "text-teal-600 dark:text-teal-400"], ["Space saved", `~${Math.round(reduction * 100)}%`, "text-teal-600 dark:text-teal-400 font-bold"]].map(([l, v, c]) => (
          <div key={l} className="flex justify-between text-xs"><span className="text-muted-foreground">{l}</span><span className={c}>{v}</span></div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/60 mt-3">Actual savings depend on file content. This is an estimate.</p>
    </div>
  );
}

function ProcessingView({ tool, files, pct }: { tool: ToolDef; files: MockFile[]; pct: number }) {
  const msgs = ["Getting your file ready…", "Working on it…", "Almost done…", "Wrapping up…"];
  const msg = msgs[Math.min(Math.floor((pct / 100) * msgs.length), msgs.length - 1)];
  const C = 2 * Math.PI * 42;
  return (
    <div className="flex flex-col items-center py-14 gap-8" role="status" aria-live="polite">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" className="stroke-foreground/[0.08]" strokeWidth="7" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} style={{ transition: "stroke-dashoffset 0.3s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{Math.round(pct)}%</span></div>
      </div>
      <div className="text-center"><h2 className="text-lg font-semibold text-foreground mb-1">Working on your files</h2><p className="text-sm text-muted-foreground">{msg}</p></div>
      <ul className="w-full max-w-sm rounded-xl border border-border overflow-hidden bg-card">
        {files.map(f => <li key={f.id}><FileItem file={f} tool={tool} /></li>)}
      </ul>
    </div>
  );
}
