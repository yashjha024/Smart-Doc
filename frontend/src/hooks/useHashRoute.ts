import { useCallback, useEffect, useState } from "react";
import type { AppRoute } from "../types/navigation";

const routes = new Set<AppRoute>(["dashboard", "renamer", "compressor", "history"]);

function readRoute(): AppRoute {
  const candidate = window.location.hash.replace(/^#\/?/, "") as AppRoute;
  return routes.has(candidate) ? candidate : "dashboard";
}

export function useHashRoute() {
  const [route, setRoute] = useState<AppRoute>(() => readRoute());

  useEffect(() => {
    const handleHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute) => {
    window.location.hash = `/${nextRoute}`;
    setRoute(nextRoute);
  }, []);

  return { route, navigate };
}
