/**
 * Path router for the participant SPA mounted under `/enroll/`.
 *
 * Kept free of React so it stays Bun-testable (same pattern as the tutor app).
 */

export type ParticipantRoute =
  | { kind: "expired-page" }
  | { kind: "enroll"; token: string }
  | { kind: "bad-enroll-url" };

const ROUTE_CHANGE_EVENT = "participant:route-change";

/** Non-empty base64url / opaque enrollment token segment (URL-decoded). */
const ENROLL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,500}$/;

function isLikelyEnrollToken(token: string): boolean {
  return ENROLL_TOKEN_PATTERN.test(token);
}

/**
 * Resolve routing state from a pathname like `/enroll/<token>` or `/enroll/expired`.
 */
export function resolveParticipantRoute(pathname: string): ParticipantRoute {
  if (typeof pathname !== "string" || pathname.length === 0) {
    return { kind: "bad-enroll-url" };
  }

  const trimmed = pathname.replace(/\/+$/, "");
  const base = "/enroll";

  if (trimmed === base || trimmed === "") {
    return { kind: "bad-enroll-url" };
  }

  if (!trimmed.startsWith(`${base}/`)) {
    return { kind: "bad-enroll-url" };
  }

  const tail = trimmed.slice(`${base}/`.length);
  const segments = tail.split("/").filter(Boolean);
  if (segments.length !== 1) {
    return { kind: "bad-enroll-url" };
  }

  const opaque = segments[0]!;
  if (opaque === "expired") {
    return { kind: "expired-page" };
  }

  let token: string;
  try {
    token = decodeURIComponent(opaque);
  } catch {
    return { kind: "bad-enroll-url" };
  }

  if (!isLikelyEnrollToken(token)) {
    return { kind: "bad-enroll-url" };
  }

  return { kind: "enroll", token };
}

export function navigateParticipant(href: string): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === href) return;
  window.history.pushState({}, "", href);
  window.dispatchEvent(new CustomEvent(ROUTE_CHANGE_EVENT));
}

export function onParticipantRouteChange(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(ROUTE_CHANGE_EVENT, listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener(ROUTE_CHANGE_EVENT, listener);
    window.removeEventListener("popstate", listener);
  };
}

export const __PARTICIPANT_ROUTE_CHANGE_EVENT = ROUTE_CHANGE_EVENT;
