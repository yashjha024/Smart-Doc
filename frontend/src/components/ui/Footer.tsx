import React from "react";
import { Layers, Globe } from "lucide-react";
import { TOOLS } from "../../config/tools";
import type { AppRoute } from "../../types/navigation";

export function Footer({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const pdfTools = TOOLS.filter(t => t.category === "pdf" && t.status === "available");
  const imgTools = TOOLS.filter(t => t.category === "image" && t.status === "available");
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center"><Layers size={13} className="text-white" /></div>
              <span className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-sans)" }}>FileCraft</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px] mb-5" style={{ fontFamily: "var(--font-sans)" }}>Easy file tools for everyone. Free to start, no account needed.</p>
            <div className="flex gap-2.5">
              {[Globe].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/[0.2] transition-all"><Icon size={14} /></a>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-4">PDF</p>
            <ul className="space-y-2.5">{pdfTools.map(t => <li key={t.id}><button onClick={() => onNavigate(`workspace/${t.id}` as any)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.name}</button></li>)}</ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4">Image</p>
            <ul className="space-y-2.5">{imgTools.map(t => <li key={t.id}><button onClick={() => onNavigate(`workspace/${t.id}` as any)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.name}</button></li>)}</ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400 mb-4">Company</p>
            <ul className="space-y-2.5">
              {(["Features", "Pricing", "Blog", "Help", "Privacy", "Terms"] as const).map(l => (
                <li key={l}><button onClick={l === "Pricing" ? () => onNavigate("pricing") : l === "Features" ? () => onNavigate("features") : l === "Blog" ? () => onNavigate("blog") : undefined} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</button></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>© 2026 FileCraft — Your files, your control.</p>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-sans)" }}>Files deleted after 60 minutes · <span className="text-teal-600 dark:text-teal-400">●</span> All systems running</p>
        </div>
      </div>
    </footer>
  );
}
