import { ZWISCHENSPEICHER_LEEREN_SCHLUESSEL } from './zwischenspeicher-merker';
import { DestroyRef, DOCUMENT, inject, InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import { geraeteSpeicher, SPEICHER_FREIGEBEN } from '../geraete-speicher';
import type { KontoDienst } from './konto-dienst';
import { KontoSitzung, type AnmeldeMerker } from './konto-sitzung';

/** The key that tells, on the device, that an Elternteil is signed in. */
export const ANGEMELDET_SCHLUESSEL = 'korbjaeger-angemeldet';

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
  speicher: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined,
  fenster?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
): AnmeldeMerker {
  const versuchen = (tun: () => void) => {
    try {
      tun();
    } catch {
      // blocked: the sign-in lasts for this visit, as Auth's session may
    }
  };
  const gelesen = (schluessel: string): boolean => {
    try {
      return speicher?.getItem(schluessel) === '1';
    } catch {
      return false;
    }
  };
  return {
    gesetzt: () => gelesen(ANGEMELDET_SCHLUESSEL),
    aufraeumenOffen: () => gelesen(ZWISCHENSPEICHER_LEEREN_SCHLUESSEL),
    setzen: () =>
      versuchen(() => speicher?.setItem(ANGEMELDET_SCHLUESSEL, '1')),
    loeschen: () =>
      versuchen(() => speicher?.removeItem(ANGEMELDET_SCHLUESSEL)),
    beobachten: (rueckruf) => {
      const beiAenderung = (event: Event) => {
        if (
          event instanceof StorageEvent &&
          (event.key === null || event.key === ANGEMELDET_SCHLUESSEL)
        ) {
          rueckruf();
        }
      };
      fenster?.addEventListener('storage', beiAenderung);
      return () => fenster?.removeEventListener('storage', beiAenderung);
    },
  };
}

/** The Elternteil's account, and with it the `Auswahl` the screens use (`AUSWAHL`). */
export const KONTO_SITZUNG = new InjectionToken<KontoSitzung>('KontoSitzung', {
  providedIn: 'root',
  factory: () => {
    const speicher = geraeteSpeicher();
    const fenster = inject(DOCUMENT).defaultView ?? undefined;
    const lokal = new LokaleAuswahl(
      speicher,
      fenster,
      inject(SPEICHER_FREIGEBEN)
    );
    inject(DestroyRef).onDestroy(() => lokal.beenden());
    const sitzung = new KontoSitzung(
      lokal,
      environment.anmeldung ? kontoDienstLaden : undefined,
      geraeteMerker(speicher, fenster)
    );
    void sitzung.starten();
    return sitzung;
  },
});
