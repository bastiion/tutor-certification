/**
 * Tiny dependency-free path router for the tutor SPA.
 *
 * - Resolves a {@link RouteId} from a `window.location.pathname`-like string
 *   under the `/tutor/` mount point. Anything outside the mount or unknown
 *   tail segments collapse to `"404"`.
 * - Provides {@link navigate} and {@link onRouteChange} so React components
 *   can switch pages with `history.pushState` (no full page reload) and
 *   subscribe to back/forward + `<Link>` navigation events.
 *
 * The hook (`useRoute`) lives in the React layer and is intentionally not in
 * this module so the router stays Bun-testable without a DOM.
 */

export type RouteId = "home" | "keys" | "sessions/new" | "print" | "audit" | "404";

const TUTOR_BASE = "/tutor";
const ROUTE_CHANGE_EVENT = "tutor:route-change";

/**
 * Resolve a `RouteId` from a raw pathname.
 *
 * Trailing slashes are tolerated. Paths outside `/tutor/` resolve to `"404"`.
 */
export function resolveRoute(pathname: string): RouteId {
  if (typeof pathname !== "string" || pathname.length === 0) return "404";
  if (pathname !== TUTOR_BASE && !pathname.startsWith(`${TUTOR_BASE}/`)) {
    return "404";
  }
  let tail = pathname === TUTOR_BASE ? "" : pathname.slice(TUTOR_BASE.length + 1);
  while (tail.endsWith("/")) tail = tail.slice(0, -1);
  switch (tail) {
    case "":
      return "home";
    case "keys":
      return "keys";
    case "sessions/new":
      return "sessions/new";
    case "print":
      return "print";
    case "audit":
      return "audit";
    default:
      return "404";
  }
}

/** Map a {@link RouteId} back to its canonical pathname under `/tutor/`. */
export function routePath(route: RouteId): string {
  switch (route) {
    case "home":
      return `${TUTOR_BASE}/`;
    case "keys":
      return `${TUTOR_BASE}/keys`;
    case "sessions/new":
      return `${TUTOR_BASE}/sessions/new`;
    case "print":
      return `${TUTOR_BASE}/print`;
    case "audit":
      return `${TUTOR_BASE}/audit`;
    case "404":
      return `${TUTOR_BASE}/`;
  }
}

/**
 * Navigate to `href` without a full page reload and notify subscribers.
 *
 * Falls back to a no-op if `window` is not present (Bun unit tests).
 */
export function navigate(href: string): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === href) return;
  window.history.pushState({}, "", href);
  window.dispatchEvent(new CustomEvent(ROUTE_CHANGE_EVENT));
}

/**
 * Subscribe to navigation changes (programmatic + browser back/forward).
 *
 * Returns an unsubscribe function. No-op outside of a browser environment.
 */
export function onRouteChange(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(ROUTE_CHANGE_EVENT, listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener(ROUTE_CHANGE_EVENT, listener);
    window.removeEventListener("popstate", listener);
  };
}

export const __ROUTE_CHANGE_EVENT = ROUTE_CHANGE_EVENT;
