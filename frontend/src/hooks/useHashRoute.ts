import { useCallback, useEffect, useState } from "react";
import type { AppRoute } from "../types/navigation";

const routes = new Set<AppRoute>(["dashboard", "renamer", "compressor", "history", "bulk-renamer"]);

function readRoute(): { route: AppRoute; docId?: number } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [candidate, queryString] = hash.split("?");
  const params = new URLSearchParams(queryString);
  const docId = params.get("id") ? Number(params.get("id")) : undefined;
  const route = routes.has(candidate as AppRoute) ? (candidate as AppRoute) : "dashboard";
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
