/**
 * React hook around the dependency-free router in `router.ts`.
 *
 * Lives in its own module so the router stays Bun-testable without React.
 */

import { useEffect, useState } from "react";
import { onRouteChange, resolveRoute, type RouteId } from "./router.ts";

function currentPathname(): string {
  if (typeof window === "undefined" || typeof window.location === "undefined") {
    return "/";
  }
  return window.location.pathname;
}

export function useRoute(): RouteId {
  const [route, setRoute] = useState<RouteId>(() => resolveRoute(currentPathname()));
  useEffect(() => {
    return onRouteChange(() => setRoute(resolveRoute(currentPathname())));
  }, []);
  return route;
}
