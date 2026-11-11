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
  ANGEMELDET_SCHLUESSEL,
  flagGesetzt,
  flagSetzen,
  SPEICHER_FREIGEBEN,
  ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
} from '../geraete-speicher';
import type { KontoDienst } from './konto-dienst';
import { KontoSitzung, type AnmeldeMerker } from './konto-sitzung';

export { ANGEMELDET_SCHLUESSEL } from '../geraete-speicher';

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
    gesetzt: () => flagGesetzt(speicher, ANGEMELDET_SCHLUESSEL),
    aufraeumenOffen: () =>
      flagGesetzt(speicher, ZWISCHENSPEICHER_LEEREN_SCHLUESSEL),
    setzen: () => flagSetzen(speicher, ANGEMELDET_SCHLUESSEL, true),
    loeschen: () => flagSetzen(speicher, ANGEMELDET_SCHLUESSEL, false),
    beobachten: (rueckruf) =>
      watchStored(ANGEMELDET_SCHLUESSEL, rueckruf, fenster),
  };
}

/** The Elternteil's account, and with it the `Selection` the screens use (`AUSWAHL`). */
export const KONTO_SITZUNG = new InjectionToken<KontoSitzung>('KontoSitzung', {
  providedIn: 'root',
  factory: () => {
    const speicher = deviceStorage();
    const fenster = inject(DOCUMENT).defaultView ?? undefined;
    const lokal = new LocalSelection(
      speicher,
      fenster,
      inject(SPEICHER_FREIGEBEN)
    );
    inject(DestroyRef).onDestroy(() => lokal.stop());
    const sitzung = new KontoSitzung(
      lokal,
      environment.anmeldung ? kontoDienstLaden : undefined,
      geraeteMerker(speicher, fenster)
    );
    void sitzung.starten();
    return sitzung;
  },
});
