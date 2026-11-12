import { useCallback, useEffect, useState } from "react";
import type { AppRoute } from "../types/navigation";

const routes = new Set<string>(["home", "features", "pricing", "blog"]);
const prefixes = ["workspace/", "blog/"];

function readRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const candidate = hash.split("?")[0];
  if (routes.has(candidate) || prefixes.some(p => candidate.startsWith(p))) return candidate;
  return "home";
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
