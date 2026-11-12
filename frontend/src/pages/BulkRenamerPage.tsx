import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, Lock, Wand2, Download, Home, ChevronRight, CheckCircle2, AlertCircle, ArrowRight, Info, ScanText } from "lucide-react";
import { toast } from "sonner";
import { ToolDef } from "../config/tools";
import { ACCENTS, GRID_BG } from "../config/accents";
import { Btn } from "../components/ui/Btn";
import { api } from "../services/api";
import type { BulkRenameItemResult, DocumentRecord } from "../types/api";
import type { AppRoute } from "../types/navigation";
import { formatBytes } from "../utils/format";

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const SESSION_KEY = "fc-bulk-rename-docs";
// Must match the identifier labels in backend/app/services/identifier_service.py
const PLACEHOLDERS = ["{account_number}", "{certificate_number}", "{invoice_number}", "{receipt_number}", "{membership_id}", "{registration_number}"];
const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 transition-colors disabled:opacity-60";

/** Only show documents uploaded in this browser tab (the server lists everyone's). */
function loadSessionIds(): number[] {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]"); } catch { return []; }
}
function saveSessionIds(ids: number[]) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(ids)); } catch { /* storage blocked */ }
}

export function BulkRenamerPage({ tool, onNav }: { tool: ToolDef; onNav: (p: AppRoute) => void }) {
  const ta = ACCENTS[tool.accent];
  const [sessionIds, setSessionIds] = useState<number[]>(loadSessionIds);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [template, setTemplate] = useState("{account_number}");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [busy, setBusy] = useState<null | "upload" | "rename" | "download">(null);
  const [results, setResults] = useState<Map<number, BulkRenameItemResult>>(new Map());
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async (ids = sessionIds) => {
    if (ids.length === 0) { setDocuments([]); return; }
    try {
      const mine = await api.listDocuments(ids);
      setDocuments(mine);
      // Drop ids the cleanup has already removed.
      if (mine.length !== ids.length) {
        const alive = mine.map(d => d.id);
        setSessionIds(alive);
        saveSessionIds(alive);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load your documents");
    }
  };

  useEffect(() => { void refresh(); }, []);

  const upload = async (files: File[]) => {
    const ok = files.filter(f => ACCEPT.split(",").some(ext => f.name.toLowerCase().endsWith(ext)));
    if (ok.length < files.length) toast.error(`${files.length - ok.length} file(s) skipped — use PDF, JPG or PNG`);
    if (ok.length === 0) return;
    setBusy("upload");
    const added: number[] = [];
    for (const file of ok) {
      try { added.push((await api.uploadRenameDocument(file)).id); }
      catch (err) { toast.error(err instanceof Error ? err.message : `${file.name} failed to upload`); }
    }
    const ids = [...sessionIds, ...added];
    setSessionIds(ids);
    saveSessionIds(ids);
    setSelected(prev => new Set([...prev, ...added]));
    await refresh(ids);
    setBusy(null);
  };

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allSelected = documents.length > 0 && selected.size === documents.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(documents.map(d => d.id)));

  const rename = async () => {
    if (!template.trim()) { toast.error("Enter a naming template"); return; }
    setBusy("rename");
    try {
      const res = await api.bulkRename(Array.from(selected), template, prefix, suffix);
      setResults(prev => { const next = new Map(prev); res.results.forEach(r => next.set(r.document_id, r)); return next; });
      if (res.failed === 0) toast.success(`${res.successful} file${res.successful !== 1 ? "s" : ""} renamed`);
      else toast.error(`${res.successful} renamed, ${res.failed} failed — see the list for details`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk rename failed");
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy("download");
    for (const doc of documents.filter(d => selected.has(d.id))) {
      try { await api.saveDocument(doc.id, doc.stored_filename); }
      catch { toast.error(`${doc.original_filename} is no longer available`); }
    }
    setBusy(null);
  };

  const ocrMissing = Array.from(results.values()).some(r => r.error?.includes("PaddleOCR is not installed"));
  const example = `${prefix}${template || "{account_number}"}${suffix}.pdf`;

  return (
    <div className="flex-1 bg-background">
      <div className="pointer-events-none fixed inset-0 opacity-60" style={GRID_BG} />
      <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ""; if (f.length) void upload(f); }} />
      <div className="relative pt-[64px]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 pb-24">
          <nav className="flex items-center gap-2 py-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <button onClick={() => onNav("home")} className="hover:text-foreground transition-colors flex items-center gap-1"><Home size={13} /> All tools</button>
            <ChevronRight size={12} />
            <span className={`font-medium ${ta.icon}`}>{tool.name}</span>
          </nav>

          <div className="flex items-start gap-4 mb-8 pb-8 border-b border-border">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${ta.bg} ${ta.border}`}><tool.Icon size={20} className={ta.icon} /></div>
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{tool.name}</h1>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${ta.bg} ${ta.border} ${ta.icon}`}>{tool.category}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">Upload documents, and we read each one to fill a naming template — for example <span className="font-mono text-foreground">{"{account_number}"}</span> — then rename them all at once.</p>
            </div>
          </div>

          {ocrMissing && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06]">
              <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">OCR isn't installed on the server</p>
                <p className="text-muted-foreground mt-0.5">Text-based PDFs still work. For scans and photos, install it in the backend: <code className="font-mono text-foreground">pip install -r requirements-ocr.txt</code></p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: upload + settings */}
            <div className="lg:col-span-2 space-y-4">
              <div role="button" tabIndex={0} aria-label="Choose documents to rename"
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); const f = Array.from(e.dataTransfer.files); if (f.length) void upload(f); }}
                className={`flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${drag ? "border-primary/60 bg-primary/[0.04]" : "border-border hover:border-foreground/[0.20] hover:bg-foreground/[0.015]"}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${drag ? `${ta.bg} ${ta.border}` : "bg-muted border-border"}`}><Upload size={20} className={drag ? ta.icon : "text-muted-foreground"} /></div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground mb-0.5">{busy === "upload" ? "Uploading…" : drag ? "Release to upload" : "Drop documents here"}</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>
                <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-muted" style={{ fontFamily: "var(--font-mono)" }}>{ACCEPT}</span>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70"><Lock size={10} /> Deleted automatically after 1 hour</div>
              </div>

              <div className="p-5 rounded-xl border border-border bg-card space-y-4">
                <div>
                  <label htmlFor="br-template" className="text-sm font-semibold text-foreground block mb-1.5">Naming template</label>
                  <p className="text-xs text-muted-foreground mb-2">Placeholders are filled from what we read in each document.</p>
                  <input id="br-template" value={template} onChange={e => setTemplate(e.target.value)} disabled={!!busy} placeholder="{account_number}" className={inputClass} style={{ fontFamily: "var(--font-mono)" }} />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {PLACEHOLDERS.map(p => (
                      <button key={p} type="button" onClick={() => setTemplate(t => t + p)} disabled={!!busy} className="text-[11px] px-2 py-0.5 rounded-md border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors" style={{ fontFamily: "var(--font-mono)" }}>{p}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="br-prefix" className="text-xs font-semibold text-foreground block mb-1.5">Prefix</label>
                    <input id="br-prefix" value={prefix} onChange={e => setPrefix(e.target.value)} disabled={!!busy} placeholder="Cert1_" className={inputClass} style={{ fontFamily: "var(--font-mono)" }} />
                  </div>
                  <div>
                    <label htmlFor="br-suffix" className="text-xs font-semibold text-foreground block mb-1.5">Suffix</label>
                    <input id="br-suffix" value={suffix} onChange={e => setSuffix(e.target.value)} disabled={!!busy} placeholder="_2025" className={inputClass} style={{ fontFamily: "var(--font-mono)" }} />
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border px-3.5 py-2.5">
                  <p className="text-[11px] text-muted-foreground mb-0.5" style={{ fontFamily: "var(--font-mono)" }}>Example output</p>
                  <p className="text-sm font-medium text-teal-600 dark:text-teal-400 truncate" style={{ fontFamily: "var(--font-mono)" }}>{example}</p>
                </div>
              </div>
            </div>

            {/* Right: queue */}
            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-muted/30">
                  <span className="text-xs font-medium text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{documents.length} document{documents.length !== 1 ? "s" : ""} · {selected.size} selected</span>
                  {documents.length > 0 && <button onClick={toggleAll} disabled={!!busy} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{allSelected ? "Deselect all" : "Select all"}</button>}
                </div>
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-14 text-center px-6">
                    <ScanText size={24} className="text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">No documents yet. Upload some to get started.</p>
                  </div>
                ) : (
                  <ul>
                    <AnimatePresence>
                      {documents.map(doc => {
                        const r = results.get(doc.id);
                        const renamed = doc.stored_filename !== doc.original_filename && doc.status.includes("rename");
                        return (
                          <motion.li key={doc.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="border-b border-border/50 last:border-b-0">
                            <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-foreground/[0.02] transition-colors">
                              <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggle(doc.id)} disabled={!!busy} className="mt-1 accent-primary" />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${renamed ? "text-muted-foreground line-through text-xs" : "text-foreground"}`}>{doc.original_filename}</p>
                                {renamed && (
                                  <p className="text-xs font-medium text-teal-600 dark:text-teal-400 truncate mt-0.5 flex items-center gap-1" style={{ fontFamily: "var(--font-mono)" }}><ArrowRight size={10} className="flex-shrink-0" /> {doc.stored_filename}</p>
                                )}
                                <p className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>{formatBytes(doc.file_size_bytes)}</p>
                                {r?.status === "failed" && r.error && <p className="text-xs text-destructive mt-1">{r.error}</p>}
                              </div>
                              {r?.status === "success" || renamed ? <CheckCircle2 size={14} className="text-teal-600 dark:text-teal-400 mt-1 flex-shrink-0" />
                                : r?.status === "failed" ? <AlertCircle size={14} className="text-destructive mt-1 flex-shrink-0" /> : null}
                            </label>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </div>

              {busy === "rename" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                  <Info size={12} /> Reading documents and renaming — this can take a minute for scans.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Btn v="secondary" disabled={!!busy || selected.size === 0} onClick={download}><Download size={14} /> {busy === "download" ? "Downloading…" : "Download selected"}</Btn>
                <Btn v="primary" disabled={!!busy || selected.size === 0} onClick={rename}><Wand2 size={14} /> {busy === "rename" ? "Renaming…" : `Rename ${selected.size || ""} selected`.replace("  ", " ")}</Btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
