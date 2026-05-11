import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  __ROUTE_CHANGE_EVENT,
  navigate,
  onRouteChange,
  resolveRoute,
  routePath,
  type RouteId,
} from "./router.ts";

describe("resolveRoute", () => {
  const cases: Array<[string, RouteId]> = [
    ["/tutor", "home"],
    ["/tutor/", "home"],
    ["/tutor/keys", "keys"],
    ["/tutor/keys/", "keys"],
    ["/tutor/sessions/new", "sessions/new"],
    ["/tutor/sessions/new/", "sessions/new"],
    ["/tutor/print", "print"],
    ["/tutor/audit", "audit"],
    ["/tutor/unknown", "404"],
    ["/tutor/sessions", "404"],
    ["/enroll/", "404"],
    ["/", "404"],
    ["", "404"],
  ];

  for (const [path, expected] of cases) {
    test(`${JSON.stringify(path)} → ${expected}`, () => {
      expect(resolveRoute(path)).toBe(expected);
    });
  }

  test("non-string input collapses to 404", () => {
    expect(resolveRoute(undefined as unknown as string)).toBe("404");
    expect(resolveRoute(null as unknown as string)).toBe("404");
    expect(resolveRoute(42 as unknown as string)).toBe("404");
  });
});

describe("routePath", () => {
  test("round-trips every known route id", () => {
    const ids: RouteId[] = ["home", "keys", "sessions/new", "print", "audit"];
    for (const id of ids) {
      expect(resolveRoute(routePath(id))).toBe(id);
    }
  });

  test("404 falls back to the home path", () => {
    expect(routePath("404")).toBe("/tutor/");
  });
});

describe("navigate / onRouteChange (no-op without window)", () => {
  test("navigate returns silently when window is undefined", () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(() => navigate("/tutor/keys")).not.toThrow();
  });

  test("onRouteChange returns a no-op unsubscribe when window is undefined", () => {
    const off = onRouteChange(() => {});
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
  });
});

describe("navigate / onRouteChange (with window stub)", () => {
  type EventListener = (...args: unknown[]) => void;
  type WindowStub = {
    location: { pathname: string };
    history: { pushState: (state: unknown, title: string, url: string) => void };
    listeners: Map<string, Set<EventListener>>;
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
    dispatchEvent: (event: { type: string }) => void;
  };

  let originalWindow: unknown;
  let originalCustomEvent: unknown;
  let stub: WindowStub;

  beforeEach(() => {
    originalWindow = (globalThis as { window?: unknown }).window;
    originalCustomEvent = (globalThis as { CustomEvent?: unknown }).CustomEvent;

    stub = {
      location: { pathname: "/tutor/" },
      history: {
        pushState: (_state, _title, url) => {
          stub.location.pathname = String(url);
        },
      },
      listeners: new Map(),
      addEventListener(type, listener) {
        const set = stub.listeners.get(type) ?? new Set<EventListener>();
        set.add(listener);
        stub.listeners.set(type, set);
      },
      removeEventListener(type, listener) {
        stub.listeners.get(type)?.delete(listener);
      },
      dispatchEvent(event) {
        for (const listener of stub.listeners.get(event.type) ?? new Set()) {
          listener(event);
        }
      },
    };

    (globalThis as unknown as { window: WindowStub }).window = stub;
    (globalThis as unknown as { CustomEvent: new (type: string) => { type: string } }).CustomEvent =
      class {
        type: string;
        constructor(type: string) {
          this.type = type;
        }
      };
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
    if (originalCustomEvent === undefined) {
      delete (globalThis as { CustomEvent?: unknown }).CustomEvent;
    } else {
      (globalThis as { CustomEvent?: unknown }).CustomEvent = originalCustomEvent;
    }
  });

  test("navigate updates pathname and dispatches a route-change event", () => {
    let calls = 0;
    const off = onRouteChange(() => {
      calls++;
    });
    navigate("/tutor/keys");
    expect(stub.location.pathname).toBe("/tutor/keys");
    expect(calls).toBe(1);
    off();
  });

  test("navigate is idempotent for the current pathname", () => {
    let calls = 0;
    const off = onRouteChange(() => {
      calls++;
    });
    navigate("/tutor/");
    expect(calls).toBe(0);
    off();
  });

  test("popstate also notifies subscribers", () => {
    let calls = 0;
    const off = onRouteChange(() => {
      calls++;
    });
    stub.dispatchEvent({ type: "popstate" });
    expect(calls).toBe(1);
    off();
  });

  test("unsubscribe removes listeners for both event types", () => {
    let calls = 0;
    const off = onRouteChange(() => {
      calls++;
    });
    off();
    stub.dispatchEvent({ type: __ROUTE_CHANGE_EVENT });
    stub.dispatchEvent({ type: "popstate" });
    expect(calls).toBe(0);
  });
});
