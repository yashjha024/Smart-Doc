import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { FileText, Image, Check } from "lucide-react";

export function HeroMock() {
  const [pct, setPct] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let start = 0;
    let pause: ReturnType<typeof setTimeout> | undefined;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(((ts - start) / 2800) * 100, 100);
      setPct(p);
      if (p < 100) { rafRef.current = requestAnimationFrame(tick); }
      else { pause = setTimeout(() => { start = 0; setPct(0); rafRef.current = requestAnimationFrame(tick); }, 1600); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(pause); };
  }, []);

  const jobs = [
    { name: "Annual Report.pdf", saving: 46, Icon: FileText },
    { name: "Banner Image.jpg", saving: 68, Icon: Image },
    { name: "Presentation.pdf", saving: 32, Icon: FileText },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-3xl bg-primary/6 blur-2xl pointer-events-none" />
      <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/15 dark:shadow-black/40" style={{ background: "#1e1c1a", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: "rgba(0,0,0,0.25)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex gap-1.5">{["#FF5F57", "#FEBC2E", "#28C840"].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}</div>
          <span className="ml-2 text-xs" style={{ fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.35)" }}>FileCraft</span>
        </div>
        <div className="p-4 space-y-3">
          {jobs.map((job, i) => {
            const delay = i * 28;
            const lp = Math.min(100, Math.max(0, (pct - delay) * (100 / (100 - delay))));
            const done = lp >= 100;
            return (
              <div key={job.name} className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all" style={{ background: done ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.07)" }}>
                    {done ? <Check size={14} style={{ color: "#34d399" }} /> : <job.Icon size={14} style={{ color: "rgba(255,255,255,0.45)" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.85)" }}>{job.name}</p>
                    <p className="text-xs" style={{ fontFamily: "var(--font-sans)", color: done ? "#34d399" : "rgba(255,255,255,0.35)" }}>{done ? `${job.saving}% smaller — ready to download` : "Working on it…"}</p>
                  </div>
                  {done && <div className="flex-shrink-0 px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}><span className="text-[10px] font-semibold" style={{ color: "#34d399" }}>Done</span></div>}
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <motion.div className="h-full rounded-full" style={{ background: done ? "#34d399" : "#d97328" }} animate={{ width: `${lp}%` }} transition={{ duration: 0.25 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
