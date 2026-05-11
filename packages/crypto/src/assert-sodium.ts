/** Shared precondition for primitives that rely on WASM-backed libsodium. */

import { isSodiumInitialised } from "./sodium-gate.ts";

export function assertSodiumReady(): void {
  if (!isSodiumInitialised) {
    throw new Error("@bastiion/crypto: await ready() before using this API");
  }
}
