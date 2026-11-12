import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { TOOLS } from "../../config/tools";
import type { AppRoute } from "../../types/navigation";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

/** Pings the backend so the status dot reflects reality. */
function useServerStatus() {
  const [status, setStatus] = useState<"checking" | "up" | "down">("checking");
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
        if (!cancelled) setStatus(res.ok ? "up" : "down");
      } catch {
        if (!cancelled) setStatus("down");
      }
    };
    void check();
    const id = setInterval(check, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return status;
}

export function Footer({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const status = useServerStatus();
  const pdfTools = TOOLS.filter(t => t.category === "pdf" && t.status !== "coming-soon");
  const imgTools = TOOLS.filter(t => t.category === "image" && t.status !== "coming-soon");
  const fileTools = TOOLS.filter(t => t.category === "file" && t.status !== "coming-soon");
  const columns: [string, string, typeof TOOLS][] = [
    ["PDF", "text-amber-600 dark:text-amber-400", pdfTools],
    ["Image", "text-blue-600 dark:text-blue-400", imgTools],
    ["File", "text-teal-600 dark:text-teal-400", fileTools],
  ];

  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center"><Layers size={13} className="text-white" /></div>
              <span className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-sans)" }}>FileCraft</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]" style={{ fontFamily: "var(--font-sans)" }}>Easy file tools for everyone. Free to start, no account needed.</p>
          </div>
          {columns.map(([title, color, tools]) => (
            <div key={title}>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${color}`}>{title}</p>
              <ul className="space-y-2.5">{tools.map(t => <li key={t.id}><button onClick={() => onNavigate(`workspace/${t.id}`)} className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left">{t.name}</button></li>)}</ul>
            </div>
          ))}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Company</p>
            <ul className="space-y-2.5">
              {([["features", "Features"], ["pricing", "Pricing"], ["blog", "Blog"]] as const).map(([route, label]) => (
                <li key={route}><button onClick={() => onNavigate(route)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</button></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>© {new Date().getFullYear()} FileCraft — Your files, your control.</p>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-sans)" }} role="status">
            Files deleted after 60 minutes ·{" "}
            {status === "up" && <><span className="text-teal-600 dark:text-teal-400">●</span> All systems running</>}
            {status === "down" && <><span className="text-destructive">●</span> Server offline</>}
            {status === "checking" && <><span className="text-muted-foreground/50">●</span> Checking server…</>}
          </p>
        </div>
      </div>
    </footer>
  );
}
