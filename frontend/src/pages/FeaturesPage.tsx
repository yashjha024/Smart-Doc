import { Sparkles, Zap, Shield, Globe, Layers, Lock, RefreshCw, Upload, Sliders, Download, Clock, ChevronRight, ArrowRight } from "lucide-react";
import { Btn } from "../components/ui/Btn";
import { GRID_BG } from "../config/accents";
import { TOOLS } from "../config/tools";
import type { AppRoute } from "../types/navigation";

export function FeaturesPage({ onNav }: { onNav: (p: AppRoute) => void }) {
  const working = TOOLS.filter(t => t.status !== "coming-soon").length;
  const features = [
    { Icon: Zap, title: "Done in seconds", desc: "Most files are ready before you've switched tabs. No waiting, no queues.", c: "text-primary", bg: "bg-primary/8", b: "border-primary/15" },
    { Icon: Shield, title: "Your files stay private", desc: "Everything you upload is deleted automatically after 60 minutes.", c: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/8", b: "border-teal-500/15 dark:border-teal-400/15" },
    { Icon: Globe, title: "No download needed", desc: "Works in your browser — any phone, laptop, or tablet. Nothing to install.", c: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/8", b: "border-blue-500/15 dark:border-blue-400/15" },
    { Icon: Layers, title: "Handle many files at once", desc: "Drop in a whole batch — the same settings are applied to every file.", c: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/8", b: "border-violet-500/15 dark:border-violet-400/15" },
    { Icon: Lock, title: "No account required", desc: "Just open FileCraft and start working. No email, no password, no sign-up friction.", c: "text-primary", bg: "bg-primary/8", b: "border-primary/15" },
    { Icon: RefreshCw, title: `${working} tools in one place`, desc: "PDF, image, and file tools all in one tab. No more hunting for the right converter.", c: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/8", b: "border-teal-500/15 dark:border-teal-400/15" },
  ];

  return (
    <div className="relative min-h-screen bg-background pt-24 pb-24">
      <div className="pointer-events-none fixed inset-0" style={GRID_BG} />

      <section className="relative px-5 lg:px-8 pt-8 pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/[0.07] text-primary text-xs font-medium"><Sparkles size={11} /> Designed for real people</div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-foreground mb-5 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Simple tools,<br /><em style={{ fontStyle: "italic" }}>powerful results.</em>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">FileCraft handles the hard parts so you don't have to. Upload a file, choose what you want, download the result.</p>
        </div>
      </section>

      <section className="relative px-5 lg:px-8 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ Icon, title, desc, c, bg, b }) => (
            <div key={title} className="flex flex-col gap-4 p-6 rounded-2xl bg-card border border-border hover:border-foreground/[0.14] transition-colors">
              <div className={`w-10 h-10 rounded-xl ${bg} border ${b} flex items-center justify-center`}><Icon size={17} className={c} /></div>
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-1.5">{title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative px-5 lg:px-8 py-20 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3" style={{ fontFamily: "var(--font-mono)" }}>How it works</p>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Three steps. <em style={{ fontStyle: "italic" }}>That's it.</em></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
            {[
              { n: "01", Icon: Upload, t: "Pick your file", d: "Drag it onto the page, or click to browse. Works with PDFs and images." },
              { n: "02", Icon: Sliders, t: "Choose your settings", d: "We set smart defaults — skip this entirely, or tweak things to your liking." },
              { n: "03", Icon: Download, t: "Download your result", d: "Your file is ready in seconds. Save each one, or grab everything at once." },
            ].map(({ n, Icon, t, d }) => (
              <div key={n} className="bg-card p-8">
                <span className="text-xs font-bold text-primary/50 tracking-widest block mb-4" style={{ fontFamily: "var(--font-mono)" }}>{n}</span>
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5"><Icon size={17} className="text-primary" /></div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-5 lg:px-8 py-20 border-t border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border border-teal-500/25 bg-teal-500/8 text-teal-600 dark:text-teal-400 text-xs font-medium"><Shield size={11} /> Privacy first</div>
            <h2 className="text-3xl font-semibold text-foreground mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Your files are yours alone.</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">We don't analyse or share your files. They're processed without being saved permanently, and deleted automatically on a timer.</p>
            <Btn v="secondary" onClick={() => onNav("pricing")}>See pricing <ChevronRight size={14} /></Btn>
          </div>
          <div className="space-y-3">
            {[
              { Icon: Lock, label: "No account, no tracking", desc: "There's nothing to sign up for, and no analytics run on your files." },
              { Icon: Clock, label: "Auto-deleted in 60 minutes", desc: "Uploads and results disappear automatically after an hour." },
              { Icon: Shield, label: "Never analysed or shared", desc: "We don't read your files, run analytics on them, or sell your data." },
            ].map(({ Icon, label, desc }) => (
              <div key={label} className="flex gap-3 p-4 rounded-xl bg-card border border-border">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0"><Icon size={14} className="text-teal-600 dark:text-teal-400" /></div>
                <div><p className="text-sm font-semibold text-foreground">{label}</p><p className="text-xs text-muted-foreground mt-0.5">{desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-5 lg:px-8 pt-4 pb-8">
        <div className="max-w-2xl mx-auto text-center p-10 rounded-3xl bg-primary/[0.06] border border-primary/20">
          <h2 className="text-2xl font-semibold text-foreground mb-3" style={{ fontFamily: "var(--font-display)" }}>Ready to try it?</h2>
          <p className="text-muted-foreground mb-7">No account. No card. Start with any file right now.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Btn v="primary" sz="lg" onClick={() => onNav("home")}>Browse all tools <ArrowRight size={16} /></Btn>
            <Btn v="secondary" sz="lg" onClick={() => onNav("pricing")}>See pricing</Btn>
          </div>
        </div>
      </section>
    </div>
  );
}
