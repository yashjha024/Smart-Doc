import { useState } from "react";
import { BookOpen, ArrowUpRight, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "../components/ui/Btn";
import { GRID_BG } from "../config/accents";
import { BLOG_POSTS } from "../config/tools";
import { BLOG_ARTICLES } from "../config/blog";
import type { AppRoute } from "../types/navigation";

const TAG_COLOR: Record<string, string> = {
  PDF: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25 dark:border-amber-400/20",
  Images: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/25 dark:border-blue-400/20",
  Files: "text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/25 dark:border-teal-400/20",
};

export function BlogPage({ onNav }: { onNav: (p: AppRoute) => void }) {
  const [email, setEmail] = useState("");
  const [featured, ...rest] = BLOG_POSTS;
  const FeaturedIcon = featured.Icon;
  const open = (id: string) => onNav(`blog/${id}`);

  return (
    <div className="relative min-h-screen bg-background pt-24 pb-24">
      <div className="pointer-events-none fixed inset-0" style={GRID_BG} />
      <div className="relative max-w-5xl mx-auto px-5 lg:px-8">
        <div className="pt-8 pb-14">
          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/[0.07] text-primary text-xs font-medium"><BookOpen size={11} /> Tips & Guides</div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-foreground tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Learn to work<br /><em style={{ fontStyle: "italic" }}>smarter with files.</em>
          </h1>
        </div>

        <button onClick={() => open(featured.id)} className="w-full text-left group mb-6">
          <div className="p-8 rounded-2xl bg-card border border-border hover:border-foreground/[0.14] hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/20 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TAG_COLOR[featured.tag]}`}>{featured.tag}</span>
                  <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{featured.readTime}</span>
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-display)" }}>{featured.title}</h2>
                <p className="text-muted-foreground leading-relaxed max-w-2xl">{featured.excerpt}</p>
              </div>
              <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center flex-shrink-0"><FeaturedIcon size={24} className="text-primary" /></div>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-primary">Read article <ArrowUpRight size={14} /></div>
          </div>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {rest.map(post => {
            const PostIcon = post.Icon;
            return (
              <button key={post.id} onClick={() => open(post.id)} className="text-left group p-6 rounded-2xl bg-card border border-border hover:border-foreground/[0.14] hover:shadow-md hover:shadow-black/[0.04] dark:hover:shadow-black/20 transition-all">
                <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center mb-4"><PostIcon size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" /></div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TAG_COLOR[post.tag]}`}>{post.tag}</span>
                <h2 className="text-sm font-semibold text-foreground mt-3 mb-2 group-hover:text-primary transition-colors leading-snug" style={{ fontFamily: "var(--font-display)" }}>{post.title}</h2>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{post.excerpt}</p>
                <p className="text-xs text-muted-foreground mt-3" style={{ fontFamily: "var(--font-mono)" }}>{post.readTime}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-16 p-8 rounded-2xl bg-card border border-border text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2" style={{ fontFamily: "var(--font-display)" }}>Get new guides in your inbox</h2>
          <p className="text-sm text-muted-foreground mb-5">Short, practical tips about working with files — no spam, unsubscribe anytime.</p>
          <form className="flex gap-2 max-w-sm mx-auto" onSubmit={e => { e.preventDefault(); setEmail(""); toast("The newsletter is coming soon — nothing was saved."); }}>
            <label htmlFor="newsletter-email" className="sr-only">Email address</label>
            <input id="newsletter-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="flex-1 min-w-0 px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all" />
            <Btn v="primary">Subscribe</Btn>
          </form>
        </div>
      </div>
    </div>
  );
}

export function BlogPostPage({ postId, onNav }: { postId: string; onNav: (p: AppRoute) => void }) {
  const post = BLOG_POSTS.find(p => p.id === postId);
  const article = post ? BLOG_ARTICLES[post.id] : undefined;

  if (!post || !article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 pt-16 text-center px-5">
        <p className="text-foreground font-semibold">Article not found</p>
        <Btn v="secondary" onClick={() => onNav("blog")}><ChevronLeft size={14} /> Back to Blog</Btn>
      </div>
    );
  }

  const related = BLOG_POSTS.filter(p => p.id !== post.id).slice(0, 2);
  return (
    <div className="relative min-h-screen bg-background pt-24 pb-24">
      <div className="pointer-events-none fixed inset-0" style={GRID_BG} />
      <article className="relative max-w-2xl mx-auto px-5 lg:px-8 pt-8">
        <button onClick={() => onNav("blog")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"><ChevronLeft size={14} /> Back to Blog</button>

        <header className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TAG_COLOR[post.tag]}`}>{post.tag}</span>
            <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{post.date} · {post.readTime}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight mb-5 leading-snug" style={{ fontFamily: "var(--font-display)" }}>{post.title}</h1>
        </header>

        <div className="space-y-8">
          {article.sections.map(s => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold text-foreground mb-3">{s.heading}</h2>
              <p className="text-muted-foreground leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-primary/[0.06] border border-primary/20">
          <p className="text-sm font-semibold text-foreground mb-1">Try it yourself</p>
          <p className="text-sm text-muted-foreground mb-4">FileCraft handles this in a few clicks.</p>
          <Btn v="primary" sz="sm" onClick={() => onNav(`workspace/${article.toolId}`)}>{article.toolCta} <ArrowRight size={14} /></Btn>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm font-semibold text-foreground mb-4">More guides</p>
          <div className="space-y-3">
            {related.map(p => {
              const RelatedIcon = p.Icon;
              return (
                <button key={p.id} onClick={() => onNav(`blog/${p.id}`)} className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/[0.03] transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><RelatedIcon size={14} className="text-muted-foreground" /></div>
                  <span className="text-sm text-foreground group-hover:text-primary transition-colors">{p.title}</span>
                  <ChevronRight size={14} className="ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                </button>
              );
            })}
          </div>
        </div>
      </article>
    </div>
  );
}
