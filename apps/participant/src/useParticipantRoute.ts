/**
 * React hook for {@link resolveParticipantRoute} + browser navigation updates.
 */

import { useEffect, useState } from "react";
import {
  onParticipantRouteChange,
  resolveParticipantRoute,
  type ParticipantRoute,
} from "./router.ts";

function currentPathname(): string {
  if (typeof window === "undefined" || typeof window.location === "undefined") {
    return "/";
  }
  return window.location.pathname;
}

export function useParticipantRoute(): ParticipantRoute {
  const [route, setRoute] = useState<ParticipantRoute>(() => resolveParticipantRoute(currentPathname()));
  useEffect(() => {
    return onParticipantRouteChange(() => setRoute(resolveParticipantRoute(currentPathname())));
  }, []);
  return route;
}
