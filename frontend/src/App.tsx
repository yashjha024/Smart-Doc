import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { Navbar } from "./components/ui/Navbar";
import { Footer } from "./components/ui/Footer";
import { HomePage } from "./pages/HomePage";
import { ToolWorkspacePage } from "./pages/ToolWorkspacePage";
import { BulkRenamerPage } from "./pages/BulkRenamerPage";
import { FeaturesPage } from "./pages/FeaturesPage";
import { PricingPage } from "./pages/PricingPage";
import { BlogPage, BlogPostPage } from "./pages/BlogPage";
import { useHashRoute } from "./hooks/useHashRoute";
import { TOOLS } from "./config/tools";

export function App() {
  const { route, navigate } = useHashRoute();

  // Theme: index.html sets the .dark class before first paint; read it from there.
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    setIsDark(prev => {
      const n = !prev;
      try { localStorage.setItem("fc-theme", n ? "dark" : "light"); } catch { /* storage blocked */ }
      document.documentElement.classList.toggle("dark", n);
      return n;
    });
  };

  // New page → start at the top (hash navigation doesn't do this on its own).
  useEffect(() => { window.scrollTo(0, 0); }, [route]);

  const isWorkspace = route.startsWith("workspace/");

  const renderPage = () => {
    if (route === "features") return <FeaturesPage onNav={navigate} />;
    if (route === "pricing") return <PricingPage onNav={navigate} />;
    if (route === "blog") return <BlogPage onNav={navigate} />;
    if (route.startsWith("blog/")) return <BlogPostPage postId={route.slice("blog/".length)} onNav={navigate} />;
    if (isWorkspace) {
      const tool = TOOLS.find(t => t.id === route.slice("workspace/".length));
      if (!tool) return <div className="min-h-screen flex items-center justify-center pt-16 text-foreground">Tool not found</div>;
      if (tool.id === "bulk-rename") return <BulkRenamerPage tool={tool} onNav={navigate} />;
      return <ToolWorkspacePage tool={tool} onNav={navigate} />;
    }
    return <HomePage onSelect={(t) => navigate(`workspace/${t.id}`)} onNav={navigate} />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <a href="#main" onClick={e => { e.preventDefault(); document.getElementById("main")?.focus(); }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-3 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground">Skip to content</a>
      <Navbar route={route} onNavigate={navigate} isDark={isDark} toggleTheme={toggleTheme} />
      <main id="main" tabIndex={-1} className="flex-1 flex flex-col focus:outline-none">
        {renderPage()}
      </main>
      {!isWorkspace && <Footer onNavigate={navigate} />}
      <Toaster position="bottom-right" theme={isDark ? "dark" : "light"} />
    </div>
  );
}
