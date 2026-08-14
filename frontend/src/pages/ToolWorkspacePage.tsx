import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, ChevronRight, Download, RefreshCw, X, Check } from "lucide-react";
import { toast } from "sonner";
import { ToolDef } from "../config/tools";
import { Btn } from "../components/ui/Btn";
import { Badge } from "../components/ui/Badge";
import { FileItem, MockFile } from "../components/ui/FileItem";
import { api } from "../services/api";
import type { AppRoute } from "../types/navigation";
import { formatBytes } from "../utils/format";

type WorkStep = "upload" | "options" | "processing" | "done" | "error";

export function ToolWorkspacePage({ tool, onNav }: { tool: ToolDef; onNav: (p: AppRoute) => void }) {
  const [step, setStep] = useState<WorkStep>("upload");
  const [files, setFiles] = useState<MockFile[]>([]);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  // Initialize config
  useEffect(() => {
    const initConf: Record<string, any> = {};
    tool.options.forEach(o => { initConf[o.id] = o.defaultValue; });
    setConfig(initConf);
    setStep("upload");
    setFiles([]);
    setJobId(null);
    setJobError(null);
  }, [tool]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      addFiles(selected);
    }
    // reset input so same file can be selected again
    e.target.value = '';
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = async (newFiles: File[]) => {
    const newItems: MockFile[] = newFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      name: f.name,
      originalSize: f.size,
      status: "processing",
    }));
    
    setFiles(prev => [...prev, ...newItems]);
    setStep("options");
    
    // Upload files immediately
    for (let i = 0; i < newFiles.length; i++) {
        try {
            const res = await api.uploadFile(newFiles[i]);
            setFiles(prev => prev.map(f => f.id === newItems[i].id ? { ...f, status: "idle", id: res.file_id } : f));
        } catch (err: any) {
            setFiles(prev => prev.map(f => f.id === newItems[i].id ? { ...f, status: "error", errorMsg: "Upload failed" } : f));
        }
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
        const next = prev.filter(f => f.id !== id);
        if (next.length === 0) setStep("upload");
        return next;
    });
  };

  const moveFileUp = (idx: number) => {
    if (idx === 0) return;
    setFiles(prev => {
        const next = [...prev];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        return next;
    });
  };

  const moveFileDown = (idx: number) => {
    if (idx === files.length - 1) return;
    setFiles(prev => {
        const next = [...prev];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
    });
  };

  const startJob = async () => {
    const validFiles = files.filter(f => f.status === "idle" && f.id);
    if (validFiles.length === 0) {
        toast.error("No valid files to process");
        return;
    }
    
    setStep("processing");
    setFiles(prev => prev.map(f => ({ ...f, status: "processing" })));
    setJobError(null);
    
    let finalConfig = { ...config };
    
    // Parse ranges for PDF split
    if (tool.id === "split-pdf" && finalConfig.ranges) {
        const parts = finalConfig.ranges.split(",").map((s: string) => s.trim()).filter(Boolean);
        if (parts.length === 0) {
            toast.error("Please enter a valid page range.");
            return;
        }
        finalConfig.ranges = parts;
    }
    
    try {
        const payload = {
            tool_id: tool.id,
            input_files: validFiles.map(f => f.id),
            configuration: finalConfig
        };
        const job = await api.createJob(payload);
        setJobId(job.id);
    } catch (err: any) {
        setStep("error");
        setJobError(err.message || "Failed to start job");
        setFiles(prev => prev.map(f => ({ ...f, status: "error", errorMsg: "Job failed" })));
    }
  };

  useEffect(() => {
    if (step === "processing" && jobId) {
      const interval = setInterval(async () => {
        try {
            const job = await api.getJob(jobId);
            if (job.status === "completed") {
                clearInterval(interval);
                setStep("done");
                
                // Assuming single output file for simplicity right now unless we have more
                setFiles(prev => prev.map((f, idx) => ({ 
                    ...f, 
                    status: "success", 
                    id: job.output_files[idx] || job.output_files[0] || f.id, 
                    result_metadata: job.result_metadata 
                })));
            } else if (job.status === "failed") {
                clearInterval(interval);
                setStep("error");
                setJobError(job.error_information || "Processing failed");
                setFiles(prev => prev.map(f => ({ ...f, status: "error" })));
            }
        } catch (err) {
            console.error("Polling error", err);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, jobId]);

  const ta = {
    amber: { icon: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25", dot: "bg-amber-500" },
    blue:  { icon: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-500/10",  border: "border-blue-500/25", dot: "bg-blue-500" },
    teal:  { icon: "text-teal-600 dark:text-teal-400",   bg: "bg-teal-500/10",  border: "border-teal-500/25", dot: "bg-teal-500" },
  }[tool.accent];

  const canStart = files.length > 0 && files.every(f => f.status === "idle");
  const overallSavings = files.reduce((acc, f) => acc + (f.result_metadata?.metrics?.savings_bytes || 0), 0);
  const totalOriginal = files.reduce((acc, f) => acc + f.originalSize, 0);
  const overallPct = totalOriginal > 0 ? ((overallSavings / totalOriginal) * 100).toFixed(0) : 0;

  return (
    <div className="flex-1 bg-background pt-[64px] min-h-screen flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto px-5 lg:px-8 py-10 flex-1 flex flex-col">
        {/* Header */}
        <input type="file" ref={fileInputRef} className="hidden" style={{ display: 'none' }} multiple accept={tool.accepts} onChange={handleFileChange} />
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => onNav("home")} className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-all">
              <ChevronRight size={18} className="rotate-180" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${ta.dot}`} />
                <h1 className="text-xl font-semibold text-foreground tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{tool.name}</h1>
                {tool.status === "beta" && <Badge variant="beta">Beta</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{tool.longDescription}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          {/* Main Area */}
          <div className="lg:col-span-8 flex flex-col">
            {step === "upload" ? (
              <div 
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                className={`flex-1 min-h-[400px] border-2 border-dashed border-primary/30 rounded-3xl flex flex-col items-center justify-center p-8 text-center bg-primary/[0.02] hover:bg-primary/[0.04] transition-colors`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border ${ta.bg} ${ta.border}`}>
                  <tool.Icon size={28} className={ta.icon} />
                </div>
                <h3 className="text-2xl font-semibold text-foreground tracking-tight mb-2" style={{ fontFamily: "var(--font-display)" }}>Drop files here</h3>
                <p className="text-muted-foreground mb-8 max-w-sm">We accept {tool.accepts.replace(/,/g, ", ")}. Your files are secure and deleted after 1 hour.</p>
                <Btn v="primary" sz="lg" onClick={handleUploadClick}><Upload size={18} /> Select Files</Btn>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-6">
                <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-foreground/[0.02]">
                    <h3 className="font-semibold text-foreground tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Files ({files.length})</h3>
                    {step === "options" && <button onClick={handleUploadClick} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"><Upload size={12}/> Add more</button>}
                  </div>
                  <div className="flex flex-col">
                    <AnimatePresence>
                      {files.map((f, idx) => (
                        <FileItem key={f.id} file={f} tool={tool} onRemove={step === "options" ? removeFile : undefined} showResult={step === "done"} progress={f.status === "processing" ? 75 : undefined} showReorder={tool.id === "merge-pdf" && step === "options" && files.length > 1} onMoveUp={idx > 0 ? () => moveFileUp(idx) : undefined} onMoveDown={idx < files.length - 1 ? () => moveFileDown(idx) : undefined} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {step === "done" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-2xl bg-teal-500/10 border border-teal-500/25 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3"><Check size={24} /></div>
                    <h3 className="text-xl font-semibold text-foreground mb-1" style={{ fontFamily: "var(--font-display)" }}>All done!</h3>
                    <p className="text-sm text-teal-700 dark:text-teal-300 mb-6">
                        {overallSavings > 0 ? `Saved ${formatBytes(overallSavings)} (${overallPct}% smaller). ` : ""}
                        Your files are ready to download.
                    </p>
                    <div className="flex gap-3">
                      <Btn v="primary" sz="md" onClick={() => {
                        // For simplicity, download first file if single, or zip if multiple
                        const f = files[0];
                        if (f && f.id) window.location.href = api.downloadFile(f.id);
                      }}><Download size={16} /> Download {files[0]?.result_metadata?.tool_specific?.output_format === "zip" ? "ZIP" : "File"}</Btn>
                      <Btn v="secondary" sz="md" onClick={() => setStep("upload")}><RefreshCw size={16} /> Start over</Btn>
                    </div>
                  </motion.div>
                )}
                
                {step === "error" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-2xl bg-destructive/10 border border-destructive/25 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-destructive/20 text-destructive flex items-center justify-center mb-3"><X size={24} /></div>
                    <h3 className="text-xl font-semibold text-foreground mb-1" style={{ fontFamily: "var(--font-display)" }}>Processing Failed</h3>
                    <p className="text-sm text-destructive mb-6">{jobError}</p>
                    <Btn v="secondary" sz="md" onClick={() => setStep("upload")}><RefreshCw size={16} /> Try again</Btn>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar / Options */}
          <div className="lg:col-span-4">
            <div className={`p-5 rounded-2xl border ${step === "upload" ? "border-border/50 bg-foreground/[0.01] opacity-50 pointer-events-none" : "border-border bg-card shadow-sm"} transition-all duration-300 sticky top-24`}>
              <h3 className="font-semibold text-foreground mb-4 pb-3 border-b border-border tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Settings</h3>
              {tool.options.length === 0 ? (
                <p className="text-sm text-muted-foreground italic mb-6">No options available for this tool.</p>
              ) : (
                <div className="space-y-6 mb-6">
                  {tool.options.map(opt => (
                    <div key={opt.id}>
                      <label className="block text-sm font-medium text-foreground mb-2">{opt.label}</label>
                      {opt.type === "radio" && opt.choices && (
                        <div className="grid grid-cols-1 gap-2">
                          {opt.choices.map(c => {
                            const isSel = config[opt.id] === c.value;
                            return (
                              <button key={c.value} onClick={() => setConfig(p => ({ ...p, [opt.id]: c.value }))}
                                className={`flex flex-col items-start px-3 py-2 border rounded-lg transition-all ${isSel ? `border-primary bg-primary/5` : `border-border bg-background hover:border-foreground/20`}`}>
                                <span className={`text-sm font-medium ${isSel ? "text-primary" : "text-foreground"}`}>{c.label}</span>
                                {c.hint && <span className="text-xs text-muted-foreground mt-0.5">{c.hint}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {opt.type === "slider" && (
                        <div className="px-1">
                          <input type="range" min={opt.min} max={opt.max} step={opt.step} value={config[opt.id]} onChange={e => setConfig(p => ({ ...p, [opt.id]: parseInt(e.target.value) }))} className="w-full accent-primary" />
                          <div className="flex justify-between mt-1 text-xs text-muted-foreground font-mono">
                            <span>{config[opt.id]}{opt.unit}</span>
                          </div>
                        </div>
                      )}
                      {opt.type === "text" && (
                        <div>
                          <input type="text" value={config[opt.id] || ""} onChange={e => setConfig(p => ({ ...p, [opt.id]: e.target.value }))} className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20" placeholder={opt.label.includes("e.g.") ? opt.label.match(/\((.*?)\)/)?.[1] : ""} />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {tool.id === "image-compress" && (
                      <div className="pt-2">
                        <label className="block text-sm font-medium text-foreground mb-2">Target Size (KB) <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
                        <input type="number" min={1} placeholder="e.g. 500" value={config.target_size_kb || ""} onChange={e => setConfig(p => ({ ...p, target_size_kb: e.target.value ? parseInt(e.target.value) : undefined }))} className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20" />
                      </div>
                  )}
                </div>
              )}

              {step === "options" && <Btn v="primary" className="w-full justify-center" sz="lg" disabled={!canStart} onClick={startJob}>Process Files <ChevronRight size={16} /></Btn>}
              {step === "processing" && <Btn v="secondary" className="w-full justify-center" sz="lg" disabled><svg className="w-4 h-4 animate-spin mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg> Processing…</Btn>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
