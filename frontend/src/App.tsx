import React, { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { Navbar } from "./components/ui/Navbar";
import { Footer } from "./components/ui/Footer";
import { HomePage } from "./pages/HomePage";
import { ToolWorkspacePage } from "./pages/ToolWorkspacePage";
import { BulkRenamerPage } from "./pages/BulkRenamerPage";
import { HistoryPage } from "./pages/HistoryPage";
import { RenamerPage } from "./pages/RenamerPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { useHashRoute } from "./hooks/useHashRoute";
import { TOOLS } from "./config/tools";
import type { AppRoute } from "./types/navigation";

// Temporary placeholder pages
function FeaturesPage() {
  return <div className="min-h-screen flex items-center justify-center pt-16"><h1>Features - Coming Soon</h1></div>;
}
function PricingPage() {
  return <div className="min-h-screen flex items-center justify-center pt-16"><h1>Pricing - Coming Soon</h1></div>;
}
function BlogPage() {
  return <div className="min-h-screen flex items-center justify-center pt-16"><h1>Blog - Coming Soon</h1></div>;
}

export function App() {
  const { route, navigate } = useHashRoute();
  
  // Theme logic
  const [isDark, setIsDark] = useState(true);
  
  useEffect(() => {
    const isSysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const stored = localStorage.getItem("fc-theme");
    const d = stored === "dark" || (!stored && isSysDark);
    setIsDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => {
      const n = !prev;
      localStorage.setItem("fc-theme", n ? "dark" : "light");
      document.documentElement.classList.toggle("dark", n);
      return n;
    });
  };

  // Render logic based on route
  const renderPage = () => {
    if (route === "home" || route === "") {
      return <HomePage onSelect={(t) => navigate(`workspace/${t.id}` as any)} onNav={navigate} />;
    } else if (route === "features") {
      return <FeaturesPage />;
    } else if (route === "pricing") {
      return <PricingPage />;
    } else if (route === "blog") {
      return <BlogPage />;
    } else if (route === "history") {
      return <HistoryPage />;
    } else if (route === "renamer") {
      return <RenamerPage />;
    } else if (route === "bulk-renamer") {
      return <BulkRenamerPage />;
    } else if (route === "workspace") {
      return <WorkspacePage />;
    } else if (route.startsWith("workspace/")) {
      const toolId = route.split("/")[1];
      const tool = TOOLS.find(t => t.id === toolId);
      if (tool) {
        if (tool.id === "bulk-rename") return <BulkRenamerPage />;
        if (tool.id === "smart-rename") return <RenamerPage />;
        return <ToolWorkspacePage tool={tool} onNav={navigate} />;
      }
      return <div className="min-h-screen flex items-center justify-center pt-16 text-foreground">Tool not found</div>;
    }
    
    return <HomePage onSelect={(t) => navigate(`workspace/${t.id}` as any)} onNav={navigate} />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar route={route} onNavigate={navigate} isDark={isDark} toggleTheme={toggleTheme} />
      <main className="flex-1 flex flex-col">
        {renderPage()}
      </main>
      <Footer onNavigate={navigate} />
      <Toaster position="bottom-right" theme={isDark ? "dark" : "light"} />
    </div>
  );
}
