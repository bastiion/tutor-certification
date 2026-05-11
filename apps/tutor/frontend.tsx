/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `apps/tutor/index.html`.
 *
 * `cryptoReady()` is awaited eagerly so that any `useEffect` calling into
 * `@bastiion/crypto` (Keys page fingerprint, CreateSession builder, …) is
 * guaranteed to find libsodium initialised.
 */

import { createRoot } from "react-dom/client";
import { ready as cryptoReady } from "@bastiion/crypto";
import { App } from "./App";

function start() {
  void cryptoReady();
  const root = createRoot(document.getElementById("root")!);
  root.render(<App />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
