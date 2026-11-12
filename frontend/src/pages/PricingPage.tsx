import { useState } from "react";
import { Sparkles, Clock, Check } from "lucide-react";
import { Btn } from "../components/ui/Btn";
import { Badge } from "../components/ui/Badge";
import { GRID_BG } from "../config/accents";
import type { AppRoute } from "../types/navigation";

// Paid plans are shown for the design only; nothing can be purchased yet.
const PLANS = [
  { name: "Free", price: 0, period: "forever", desc: "For occasional personal use.", highlight: false, features: ["10 files per day", "50 MB per file", "PDF compress, merge, split", "Image compress & convert", "Files deleted after 1 hour", "Standard speed"] },
  { name: "Pro", price: 12, period: "per month", desc: "For people who work with files daily.", highlight: true, features: ["Unlimited files", "500 MB per file", "All tools included", "Up to 100 files at once", "Faster processing", "Keep files for 7 days", "No FileCraft watermark", "Email support"] },
  { name: "Business", price: 49, period: "per month", desc: "For teams who need more.", highlight: false, features: ["Everything in Pro", "Up to 10 people", "2 GB per file", "Developer API access", "Keep files for 30 days", "Team login (SSO)", "Priority support"] },
];

const FAQ = [
  { q: "What happens to my files after I'm done?", a: "Your files are automatically deleted from our servers. Free plan files are gone after 1 hour — Pro keeps them for 7 days, Business for 30." },
  { q: "Can I cancel at any time?", a: "Yes — cancel any time from your account. You keep access until the end of the period you paid for, with no questions asked." },
  { q: "Is there a free trial for Pro?", a: "Yes. Every new account gets a 14-day Pro trial, completely free, no card required. You only pay if you decide to keep going." },
];

export function PricingPage({ onNav }: { onNav: (p: AppRoute) => void }) {
  const [annual, setAnnual] = useState(false);
  return (
    <div className="relative min-h-screen bg-background pt-28 pb-24">
      <div className="pointer-events-none fixed inset-0" style={GRID_BG} />
      <div className="relative max-w-5xl mx-auto px-5 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/[0.07] text-primary text-xs font-medium"><Sparkles size={11} /> Simple, honest pricing</div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-foreground mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Pay for what you use.<br /><em style={{ fontStyle: "italic" }}>Nothing more.</em></h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">Every plan includes our privacy promise — your files are deleted automatically.</p>
          <button role="switch" aria-checked={annual} onClick={() => setAnnual(a => !a)} className="inline-flex items-center gap-3 px-4 py-2 rounded-xl border border-border bg-card text-sm">
            <span className={`w-8 h-5 rounded-full transition-colors ${annual ? "bg-primary" : "bg-muted"} relative`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${annual ? "translate-x-3.5" : "translate-x-0.5"}`} /></span>
            <span className="text-foreground font-medium">Pay yearly</span>
            {annual && <Badge variant="success">Save 20%</Badge>}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {PLANS.map(plan => {
            const price = annual && plan.price > 0 ? Math.round(plan.price * 0.8) : plan.price;
            return (
              <div key={plan.name} className={`relative rounded-2xl border p-7 flex flex-col transition-all ${plan.highlight ? "border-primary/40 bg-primary/[0.04] shadow-xl shadow-primary/8" : "border-border bg-card hover:border-foreground/[0.14]"}`}>
                {plan.highlight && <div className="absolute -top-3.5 left-1/2 -translate-x-1/2"><Badge variant="popular">Most Popular</Badge></div>}
                <div className="mb-6">
                  <h2 className="text-base font-semibold text-foreground mb-1">{plan.name}</h2>
                  <p className="text-sm text-muted-foreground mb-5">{plan.desc}</p>
                  <div className="flex items-baseline gap-1.5"><span className="text-4xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>${price}</span><span className="text-sm text-muted-foreground">{plan.period}</span></div>
                </div>
                {plan.price === 0
                  ? <Btn v="secondary" sz="md" className="w-full justify-center mb-6" onClick={() => onNav("home")}>Get started — it's free</Btn>
                  : <div className="mb-6 w-full rounded-xl border border-border bg-muted/60 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground"><Clock size={13} /> Coming soon</div>}
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check size={13} className={`flex-shrink-0 mt-0.5 ${plan.highlight ? "text-primary" : "text-teal-600 dark:text-teal-400"}`} />
                      <span className="text-sm text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground mb-6 text-center" style={{ fontFamily: "var(--font-display)" }}>Common questions</h2>
          {FAQ.map(({ q, a }) => (
            <div key={q} className="border-b border-border py-5">
              <p className="text-sm font-semibold text-foreground mb-2">{q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
