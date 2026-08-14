import React, { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Search, ArrowRight, X } from "lucide-react";
import { Btn } from "../components/ui/Btn";
import { ToolCard } from "../components/ui/ToolCard";
import { HeroMock } from "../components/ui/HeroMock";
import { TOOLS, ToolDef, ToolAccent } from "../config/tools";
import type { AppRoute } from "../types/navigation";

const A: Record<string, { icon: string; bg: string; border: string; dot: string }> = {
  amber: { icon: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25 dark:border-amber-400/20", dot: "bg-amber-500 dark:bg-amber-400" },
  blue:  { icon: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-500/10",  border: "border-blue-500/25 dark:border-blue-400/20",  dot: "bg-blue-500 dark:bg-blue-400" },
  teal:  { icon: "text-teal-600 dark:text-teal-400",   bg: "bg-teal-500/10",  border: "border-teal-500/25 dark:border-teal-400/20",  dot: "bg-teal-500 dark:bg-teal-400" },
};

type FilterCat = "all" | "pdf" | "image" | "file";

export function HomePage({ onSelect, onNav }: { onSelect: (t: ToolDef) => void; onNav: (p: AppRoute) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<FilterCat>("all");
  const filt = TOOLS.filter(t => (!q || t.name.toLowerCase().includes(q.toLowerCase()) || t.description.toLowerCase().includes(q.toLowerCase())) && (cat === "all" || t.category === cat));
  const pdf = filt.filter(t => t.category === "pdf");
  const img = filt.filter(t => t.category === "image");
  const fil = filt.filter(t => t.category === "file");
  const pop = TOOLS.filter(t => t.popular && t.status === "available");

  return (
    <div className="flex-1 bg-background">
      {/* ── Hero ── */}
      <section className="relative pt-28 pb-16 px-5 lg:px-8 overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/3 w-[700px] h-[400px] rounded-full opacity-40" style={{ background: "radial-gradient(ellipse, rgba(217,115,40,0.10) 0%, transparent 70%)", transform: "translateY(-50%)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/[0.07] text-primary text-xs font-medium">
                <Sparkles size={11} /> {TOOLS.length} tools · No account needed · Files deleted after 1 hour
              </div>
              <h1 className="mb-5 text-foreground leading-[1.08] tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.6rem, 5.5vw, 4.5rem)", fontWeight: 600 }}>
                Every file tool<br />you'll <em className="not-italic text-primary" style={{ fontStyle: "italic" }}>ever</em> need.
              </h1>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-md">
                Convert, compress, rename, and edit PDF and image files online. Works in any browser, no software to install.
              </p>
              <div className="flex flex-wrap gap-3">
                <Btn v="primary" sz="lg">Start for free <ArrowRight size={16} /></Btn>
                <Btn v="secondary" sz="lg" onClick={() => onNav("features")}>See how it works</Btn>
              </div>
            </div>
            <div className="hidden lg:block"><HeroMock /></div>
          </div>
        </div>
      </section>

      {/* ── Popular strip ── */}
      {!q && (
        <section className="px-5 lg:px-8 pb-6">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3" style={{ fontFamily: "var(--font-mono)" }}>Most used right now</p>
            <div className="flex flex-wrap gap-2">
              {pop.map(t => {
                const ta = A[t.accent];
                return <button key={t.id} onClick={() => onSelect(t)} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all hover:scale-[1.02] hover:shadow-sm ${ta.bg} ${ta.border} ${ta.icon}`}><t.Icon size={13} />{t.name}</button>;
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Tool browser ── */}
      <section className="px-5 lg:px-8 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 pb-5 border-b border-border">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search tools…" className="w-full pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all" />
              {q && <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={12} /></button>}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {(["all", "pdf", "image", "file"] as FilterCat[]).map(c => (
                <button key={c} onClick={() => setCat(c)} className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${cat === c ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]"}`}>
                  {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
              <span className="ml-2 text-xs text-muted-foreground flex-shrink-0" style={{ fontFamily: "var(--font-mono)" }}>{filt.length} tools</span>
            </div>
          </div>

          {filt.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted mx-auto mb-4 flex items-center justify-center"><Search size={18} className="text-muted-foreground opacity-40" /></div>
              <p className="text-base font-medium text-foreground mb-1">No tools found for "{q}"</p>
              <p className="text-sm text-muted-foreground mb-5">Try a different keyword, or browse by category.</p>
              <div className="flex justify-center gap-2">
                {(["pdf", "image", "file"] as FilterCat[]).map(c => {
                  const ta = A[c === "pdf" ? "amber" : c === "image" ? "blue" : "teal"];
                  return <button key={c} onClick={() => { setQ(""); setCat(c); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${ta.bg} ${ta.border} ${ta.icon}`}><span className={`w-1.5 h-1.5 rounded-full ${ta.dot}`} />Browse {c.toUpperCase()}</button>;
                })}
              </div>
            </div>
          )}

          {[
            { available: pdf.filter(t => t.status !== "coming-soon"), soon: pdf.filter(t => t.status === "coming-soon"), color: "amber" as ToolAccent, label: "PDF" },
            { available: img.filter(t => t.status !== "coming-soon"), soon: img.filter(t => t.status === "coming-soon"), color: "blue" as ToolAccent, label: "Image" },
            { available: fil.filter(t => t.status !== "coming-soon"), soon: fil.filter(t => t.status === "coming-soon"), color: "teal" as ToolAccent, label: "File" },
          ].map(({ available, soon, color, label }) => (available.length > 0 || soon.length > 0) && (
            <div key={label} className="mb-12">
              {cat === "all" && (
                <div className="flex items-center gap-2.5 mb-4">
                  <span className={`w-2 h-2 rounded-full ${A[color].dot}`} />
                  <span className={`text-xs font-bold uppercase tracking-widest ${A[color].icon}`} style={{ fontFamily: "var(--font-mono)" }}>{label}</span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {available.map(t => <ToolCard key={t.id} tool={t} onClick={() => onSelect(t)} />)}
              </div>
              {soon.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground/60 uppercase tracking-widest font-medium mr-1" style={{ fontFamily: "var(--font-mono)" }}>Coming soon</span>
                  {soon.map(t => {
                    const SoonIcon = t.Icon;
                    return (
                      <button key={t.id} onClick={() => toast(`${t.name} is coming soon`, { description: "We're building it — check back soon." })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <SoonIcon size={11} />
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Minimal CTA ── */}
      <section className="px-5 lg:px-8 py-16 border-t border-border bg-card">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-3 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Start with any file, right now.</h2>
          <p className="text-muted-foreground mb-7">No sign-up. No credit card. Free to use.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Btn v="primary" sz="lg">Start for free <ArrowRight size={16} /></Btn>
            <Btn v="secondary" sz="lg" onClick={() => onNav("pricing")}>Compare plans</Btn>
          </div>
        </div>
      </section>
    </div>
  );
}
