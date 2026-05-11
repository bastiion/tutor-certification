import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  __PARTICIPANT_ROUTE_CHANGE_EVENT,
  navigateParticipant,
  onParticipantRouteChange,
  resolveParticipantRoute,
} from "./router.ts";

describe("resolveParticipantRoute", () => {
  test.each([
    ["/enroll/abc12345", { kind: "enroll", token: "abc12345" }],
    ["/enroll/abc12345/", { kind: "enroll", token: "abc12345" }],
    ["/enroll/expired", { kind: "expired-page" }],
    ["/enroll/expired/", { kind: "expired-page" }],
    ["/enroll/", { kind: "bad-enroll-url" }],
    ["/enroll", { kind: "bad-enroll-url" }],
    ["/enroll/a/b", { kind: "bad-enroll-url" }],
    ["/tutor/foo", { kind: "bad-enroll-url" }],
  ] as const)("maps %s → %j", (path, expected) => {
    expect(resolveParticipantRoute(path)).toEqual(expected);
  });

  test("decodes percent-encoding in token segment", () => {
    expect(resolveParticipantRoute("/enroll/te%73t12345678")).toEqual({
      kind: "enroll",
      token: "test12345678",
    });
  });

  test("invalid URI sequence in token yields bad URL", () => {
    expect(resolveParticipantRoute("/enroll/%")).toEqual({ kind: "bad-enroll-url" });
  });

  test("empty string pathname is bad URL", () => {
    expect(resolveParticipantRoute("")).toEqual({ kind: "bad-enroll-url" });
  });

  test("non-string pathname is bad URL", () => {
    expect(resolveParticipantRoute(undefined as unknown as string)).toEqual({ kind: "bad-enroll-url" });
    expect(resolveParticipantRoute(null as unknown as string)).toEqual({ kind: "bad-enroll-url" });
    expect(resolveParticipantRoute(42 as unknown as string)).toEqual({ kind: "bad-enroll-url" });
  });

  test("only-slashes pathname collapses to bad URL", () => {
    expect(resolveParticipantRoute("///")).toEqual({ kind: "bad-enroll-url" });
  });

  test("token segment shorter than 8 safe characters is rejected", () => {
    expect(resolveParticipantRoute("/enroll/short")).toEqual({ kind: "bad-enroll-url" });
  });
});

describe("navigateParticipant / onParticipantRouteChange (no window)", () => {

  test("navigate is a no-op without window", () => {
    expect(() => navigateParticipant("/enroll/expired")).not.toThrow();
  });

  test("onParticipantRouteChange unsubscribe no-op without window", () => {
    const off = onParticipantRouteChange(() => {});
    expect(() => off()).not.toThrow();
  });
});

describe("navigateParticipant / onParticipantRouteChange (window stub)", () => {
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
      location: { pathname: "/enroll/abc12345678" },
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
    (globalThis as unknown as { CustomEvent: new (type: string) => { type: string } }).CustomEvent = class {
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

  test("navigate updates pathname and notifies", () => {
    let calls = 0;
    const off = onParticipantRouteChange(() => {
      calls++;
    });
    navigateParticipant("/enroll/expired");
    expect(stub.location.pathname).toBe("/enroll/expired");
    expect(calls).toBe(1);
    off();
  });

  test("navigate is idempotent for same path", () => {
    let calls = 0;
    const off = onParticipantRouteChange(() => {
      calls++;
    });
    navigateParticipant("/enroll/abc12345678");
    expect(calls).toBe(0);
    off();
  });

  test("popstate notifies", () => {
    let calls = 0;
    const off = onParticipantRouteChange(() => {
      calls++;
    });
    stub.dispatchEvent({ type: "popstate" });
    expect(calls).toBe(1);
    off();
  });

  test("unsubscribe clears listeners", () => {
    let calls = 0;
    const off = onParticipantRouteChange(() => {
      calls++;
    });
    off();
    stub.dispatchEvent({ type: __PARTICIPANT_ROUTE_CHANGE_EVENT });
    stub.dispatchEvent({ type: "popstate" });
    expect(calls).toBe(0);
  });
});
