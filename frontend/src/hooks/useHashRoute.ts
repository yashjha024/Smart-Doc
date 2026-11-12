import { useCallback, useEffect, useState } from "react";
import type { AppRoute } from "../types/navigation";

const routes = new Set<AppRoute>(["home", "features", "pricing", "blog", "workspace", "renamer", "history", "bulk-renamer"]);

function readRoute(): { route: AppRoute; docId?: number } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [candidate, queryString] = hash.split("?");
  const params = new URLSearchParams(queryString);
  const docId = params.get("id") ? Number(params.get("id")) : undefined;
  
  let route = "home" as AppRoute;
  if (candidate && candidate.startsWith("workspace/")) {
      route = candidate as AppRoute;
  } else if (routes.has(candidate as AppRoute)) {
      route = candidate as AppRoute;
  }
  
  return { route, docId };
}

export function useHashRoute() {
  const [routeState, setRouteState] = useState(() => readRoute());

  useEffect(() => {
    const handleHashChange = () => setRouteState(readRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute, docId?: number) => {
    const hash = docId ? `/${nextRoute}?id=${docId}` : `/${nextRoute}`;
    window.location.hash = hash;
    setRouteState({ route: nextRoute, docId });
  }, []);

  return { route: routeState.route, docId: routeState.docId, navigate };
}
