/**
 * Router for the verify SPA (`/verify/` drop landing and `/verify/<cert_id>` id-only flow).
 */

export type VerifyRoute = { kind: "drop" } | { kind: "by-id"; certId: string };

const ROUTE_CHANGE_EVENT = "verify:route-change";

const VERIFY_BASE = "/verify";

export function resolveVerifyRoute(pathname: string): VerifyRoute {
  if (typeof pathname !== "string" || pathname.length === 0) {
    return { kind: "drop" };
  }

  const trimmed = pathname.replace(/\/+$/, "");
  if (trimmed === VERIFY_BASE) {
    return { kind: "drop" };
  }

  if (!trimmed.startsWith(`${VERIFY_BASE}/`)) {
    return { kind: "drop" };
  }

  const tail = trimmed.slice(`${VERIFY_BASE}/`.length);
  const segments = tail.split("/").filter(Boolean);
  if (segments.length !== 1) {
    return { kind: "drop" };
  }

  let certId: string;
  try {
    certId = decodeURIComponent(segments[0]!);
  } catch {
    return { kind: "drop" };
  }

  if (certId.length === 0) {
    return { kind: "drop" };
  }

  return { kind: "by-id", certId };
}

export function navigateVerify(href: string): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === href) return;
  window.history.pushState({}, "", href);
  window.dispatchEvent(new CustomEvent(ROUTE_CHANGE_EVENT));
}

export function onVerifyRouteChange(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(ROUTE_CHANGE_EVENT, listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener(ROUTE_CHANGE_EVENT, listener);
    window.removeEventListener("popstate", listener);
  };
}

export const __VERIFY_ROUTE_CHANGE_EVENT = ROUTE_CHANGE_EVENT;
