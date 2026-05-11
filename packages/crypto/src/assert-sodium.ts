/** Shared precondition for primitives that rely on WASM-backed libsodium. */

import { isSodiumInitialised } from "./sodium-gate.ts";

export function assertSodiumReady(): void {
  if (!isSodiumInitialised) {
    throw new Error("@ikwsd/crypto: await ready() before using this API");
  }
}
