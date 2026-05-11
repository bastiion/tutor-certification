import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  __VERIFY_ROUTE_CHANGE_EVENT,
  navigateVerify,
  onVerifyRouteChange,
  resolveVerifyRoute,
} from "./router.ts";

describe("resolveVerifyRoute", () => {
  test("treats /verify/ as drop landing", () => {
    expect(resolveVerifyRoute("/verify/")).toEqual({ kind: "drop" });
    expect(resolveVerifyRoute("/verify")).toEqual({ kind: "drop" });
  });

  test("parses single cert id segment", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(resolveVerifyRoute(`/verify/${id}`)).toEqual({ kind: "by-id", certId: id });
  });

  test("whitespace-only id segment yields by-id for API trim/404 behaviour", () => {
    expect(resolveVerifyRoute("/verify/%20%09")).toEqual({ kind: "by-id", certId: " \t" });
  });

  test("non-verify prefix yields drop", () => {
    expect(resolveVerifyRoute("/tutor/verify/x")).toEqual({ kind: "drop" });
  });

  test("extra path segments yield drop", () => {
    expect(resolveVerifyRoute("/verify/a/b")).toEqual({ kind: "drop" });
  });

  test("invalid decode yields drop", () => {
    expect(resolveVerifyRoute("/verify/%")).toEqual({ kind: "drop" });
  });

  test("empty or non-string path yields drop", () => {
    expect(resolveVerifyRoute("")).toEqual({ kind: "drop" });
    expect(resolveVerifyRoute(undefined as unknown as string)).toEqual({ kind: "drop" });
  });
});

describe("navigateVerify / onVerifyRouteChange (no window)", () => {
  test("navigate is a no-op without window", () => {
    expect(() => navigateVerify("/verify/")).not.toThrow();
  });

  test("onVerifyRouteChange unsubscribe is safe without window", () => {
    const off = onVerifyRouteChange(() => {});
    expect(() => off()).not.toThrow();
  });
});

describe("navigateVerify / onVerifyRouteChange (window stub)", () => {
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
      location: { pathname: "/verify/" },
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
      (globalThis as { CustomEvent?: unknown }).CustomEvent = originalCustomEvent as typeof CustomEvent;
    }
  });

  test("navigate updates history and notifies", () => {
    let n = 0;
    const off = onVerifyRouteChange(() => {
      n += 1;
    });
    navigateVerify("/verify/abc");
    expect(stub.location.pathname).toBe("/verify/abc");
    expect(n).toBe(1);
    stub.dispatchEvent({ type: "popstate" });
    expect(n).toBe(2);
    off();
  });

  test("navigate is idempotent for same path", () => {
    let n = 0;
    onVerifyRouteChange(() => {
      n += 1;
    });
    let pushes = 0;
    stub.history.pushState = (_state, _title, url) => {
      pushes += 1;
      stub.location.pathname = String(url);
    };
    stub.location.pathname = "/verify/abc";
    navigateVerify("/verify/abc");
    expect(pushes).toBe(0);
    expect(n).toBe(0);
  });

  test("custom route event notifies", () => {
    let n = 0;
    onVerifyRouteChange(() => {
      n += 1;
    });
    stub.dispatchEvent({ type: __VERIFY_ROUTE_CHANGE_EVENT });
    expect(n).toBe(1);
  });

  test("unsubscribe clears listeners", () => {
    let calls = 0;
    const off = onVerifyRouteChange(() => {
      calls++;
    });
    off();
    stub.dispatchEvent({ type: __VERIFY_ROUTE_CHANGE_EVENT });
    stub.dispatchEvent({ type: "popstate" });
    expect(calls).toBe(0);
  });
});
