/** Internal flag toggled by {@link ../index#ready}; kept isolated so tests can reset state. */

export let isSodiumInitialised = false;

export function setSodiumInitialised(value: boolean): void {
  isSodiumInitialised = value;
}
