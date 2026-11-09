/**
 * Runs `tun` alone among this device's tabs, under the lock `name`;
 * resolves with what it returns.
 */
export type GeraeteSperre = <T>(tun: () => T | Promise<T>) => Promise<T>;

/** The lock of the device's `Auswahl`: its writes, and a sign-in taking it over. */
export const AUSWAHL_SPERRE = 'korbjaeger-auswahl';

/** The part of the Web Locks API (`navigator.locks`) the lock takes. */
export type Schloesser = Pick<LockManager, 'request'>;

/**
 * The lock `name` on the device, through the Web Locks API, so tabs of the
 * app take turns; where the browser has none, `tun` runs at once, as two
 * tabs did before.
 */
export function geraeteSperre(
  name: string,
  schloesser: Schloesser | undefined = globalThis.navigator?.locks
): GeraeteSperre {
  return async (tun) =>
    schloesser === undefined
      ? tun()
      : (schloesser.request(name, () => tun()) as Promise<
          Awaited<ReturnType<typeof tun>>
        >);
}
