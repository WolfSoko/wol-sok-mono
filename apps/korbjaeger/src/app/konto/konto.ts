import { DestroyRef, DOCUMENT, inject, InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';
import { LocalSelection } from '@wolsok/feat-korbjaeger-selection';
import {
  deviceStorage,
  KeyValueStorage,
  StorageEventTarget,
  watchStored,
} from '@wolsok/utils-browser-storage';
import {
  SIGNED_IN_KEY,
  isFlagSet,
  setFlag,
  FREE_STORAGE,
  CLEAR_CACHE_KEY,
} from '../device-storage';
import type { KontoDienst } from './konto-dienst';
import { KontoSitzung, type AnmeldeMerker } from './konto-sitzung';

export { SIGNED_IN_KEY } from '../device-storage';

/**
 * Loads Firebase for the account: its own chunk, fetched only to sign in
 * or to open the account of an Elternteil signed in before.
 */
function kontoDienstLaden(): Promise<KontoDienst> {
  return import('./firebase-konto-dienst').then(({ firebaseKontoDienst }) =>
    firebaseKontoDienst(environment)
  );
}

/**
 * Remembers the sign-in in the device's storage, where it may; hears of
 * other tabs' through `fenster`'s `storage` event.
 */
export function geraeteMerker(
  speicher: KeyValueStorage | undefined,
  fenster?: StorageEventTarget
): AnmeldeMerker {
  return {
    // blocked: the sign-in lasts for this visit, as Auth's session may
    gesetzt: () => isFlagSet(speicher, SIGNED_IN_KEY),
    aufraeumenOffen: () => isFlagSet(speicher, CLEAR_CACHE_KEY),
    setzen: () => setFlag(speicher, SIGNED_IN_KEY, true),
    loeschen: () => setFlag(speicher, SIGNED_IN_KEY, false),
    beobachten: (rueckruf) => watchStored(SIGNED_IN_KEY, rueckruf, fenster),
  };
}

/** The Elternteil's account, and with it the `Selection` the screens use (`AUSWAHL`). */
export const KONTO_SITZUNG = new InjectionToken<KontoSitzung>('KontoSitzung', {
  providedIn: 'root',
  factory: () => {
    const speicher = deviceStorage();
    const fenster = inject(DOCUMENT).defaultView ?? undefined;
    const lokal = new LocalSelection(speicher, fenster, inject(FREE_STORAGE));
    inject(DestroyRef).onDestroy(() => lokal.stop());
    const sitzung = new KontoSitzung(
      lokal,
      environment.signIn ? kontoDienstLaden : undefined,
      geraeteMerker(speicher, fenster)
    );
    void sitzung.starten();
    return sitzung;
  },
});
