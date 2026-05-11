import { useEffect, useState } from "react";
import { onVerifyRouteChange, resolveVerifyRoute, type VerifyRoute } from "./router.ts";

function currentPathname(): string {
  if (typeof window === "undefined" || typeof window.location === "undefined") {
    return "/";
  }
  return window.location.pathname;
}

export function useVerifyRoute(): VerifyRoute {
  const [route, setRoute] = useState<VerifyRoute>(() => resolveVerifyRoute(currentPathname()));
  useEffect(() => {
    return onVerifyRouteChange(() => setRoute(resolveVerifyRoute(currentPathname())));
  }, []);
  return route;
}
