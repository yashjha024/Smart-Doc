import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Sun, Moon, Layers } from "lucide-react";
import { Btn } from "./Btn";
import type { AppRoute } from "../../types/navigation";

export function Navbar({ route, onNavigate, isDark, toggleTheme }: { route: AppRoute; onNavigate: (p: AppRoute) => void; isDark: boolean; toggleTheme: () => void }) {
  const [mob, setMob] = useState(false);
  const isActive = (p: AppRoute) => route === p || route.startsWith(`${p}/`) || (p === "home" && route.startsWith("workspace/"));
  
  // Mapping the old legacy routes (if any) or new routes
  // The new routes expected by the Figma design are home, features, pricing, blog
  const navLinks: [AppRoute, string][] = [
    ["home", "Tools"], 
    ["features", "Features"], 
    ["pricing", "Pricing"], 
    ["blog", "Blog"]
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border" style={{ background: "var(--nav-bg)", backdropFilter: "blur(16px)" }}>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-[64px] flex items-center gap-5">
        {/* Logo */}
        <button onClick={() => onNavigate("home")} aria-label="FileCraft home" className="flex items-center gap-2.5 select-none shrink-0 group">
          <div className="w-[30px] h-[30px] rounded-[9px] bg-primary flex items-center justify-center shadow-sm shadow-primary/35 group-hover:shadow-primary/50 transition-shadow">
            <Layers size={15} className="text-white" />
          </div>
          <span className="text-[15px] font-bold text-foreground tracking-tight" style={{ fontFamily: "var(--font-sans)" }}>FileCraft</span>
        </button>

        {/* Logo / nav divider */}
        <div className="hidden md:block w-px h-5 bg-border shrink-0" />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1">
          {navLinks.map(([p, label]) => {
            const active = isActive(p);
            return (
              <button key={p} onClick={() => onNavigate(p)}
                className={`relative px-3.5 py-1.5 text-sm rounded-lg transition-all duration-150 ${active ? "text-foreground font-semibold bg-primary/[0.07] dark:bg-primary/[0.13]" : "text-muted-foreground font-normal hover:text-foreground hover:bg-foreground/[0.05]"}`}
                style={{ fontFamily: "var(--font-sans)" }}>
                {label}
                {active && <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-primary opacity-70" />}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Divider before auth actions */}
          <div className="hidden sm:block w-px h-5 bg-border mx-1.5 shrink-0" />

          <button disabled title="Accounts are coming soon" aria-label="Sign in (coming soon)" className="hidden sm:block text-sm font-medium text-muted-foreground/50 cursor-not-allowed px-3 py-1.5 rounded-lg" style={{ fontFamily: "var(--font-sans)" }}>
            Sign in
          </button>
          <Btn v="primary" sz="sm" onClick={() => onNavigate("pricing")}>Get started</Btn>
          <button onClick={() => setMob(o => !o)} aria-label={mob ? "Close menu" : "Open menu"} aria-expanded={mob} className="md:hidden ml-1 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-colors">
            {mob ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {mob && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16 }} className="md:hidden overflow-hidden border-t border-border" style={{ background: "var(--nav-bg)" }}>
            <div className="px-4 py-3 space-y-0.5">
              {navLinks.map(([p, label]) => {
                const active = isActive(p);
                return (
                  <button key={p} onClick={() => { onNavigate(p); setMob(false); }}
                    className={`w-full text-left px-3.5 py-2.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${active ? "text-foreground font-semibold bg-primary/[0.07] dark:bg-primary/[0.12]" : "text-muted-foreground font-normal hover:text-foreground hover:bg-foreground/[0.05]"}`}
                    style={{ fontFamily: "var(--font-sans)" }}>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    {label}
                  </button>
                );
              })}
              <div className="pt-2 mt-2 border-t border-border flex items-center gap-2 px-1">
                <button disabled title="Accounts are coming soon" aria-label="Sign in (coming soon)" className="flex-1 text-sm font-medium text-muted-foreground/50 cursor-not-allowed px-3 py-2 rounded-lg text-center" style={{ fontFamily: "var(--font-sans)" }}>Sign in</button>
                <Btn v="primary" sz="sm" onClick={() => { onNavigate("pricing"); setMob(false); }} className="flex-1">Get started</Btn>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
