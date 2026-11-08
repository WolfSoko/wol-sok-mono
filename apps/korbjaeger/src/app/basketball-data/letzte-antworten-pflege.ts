import { DestroyRef, DOCUMENT, inject, InjectionToken } from '@angular/core';
import { geraeteSpeicher } from '../geraete-speicher';
import { LokaleLetzteAntworten } from './letzte-antworten';
import { SPEICHERBARE_ARTEN } from './proxy-transport';

/** How often an open page clears answers too old: at most hourly. */
const PFLEGE_TAKT_MS = 60 * 60_000;

/**
 * The device's last good answers (`LokaleLetzteAntworten`), cleared of
 * answers too old and of kinds no longer kept (`aufraeumen`): at the
 * start, whenever the page comes back into view, and hourly while it
 * stays open; until the app ends.
 */
export const LETZTE_ANTWORTEN = new InjectionToken<LokaleLetzteAntworten>(
  'LETZTE_ANTWORTEN',
  {
    providedIn: 'root',
    factory: () => {
      const antworten = new LokaleLetzteAntworten(geraeteSpeicher());
      const aufraeumen = (): void =>
        antworten.aufraeumen(Date.now(), SPEICHERBARE_ARTEN);
      aufraeumen();
      const document = inject(DOCUMENT);
      const beiSichtbar = (): void => {
        if (document.visibilityState === 'visible') {
          aufraeumen();
        }
      };
      document.addEventListener('visibilitychange', beiSichtbar);
      const takt = setInterval(aufraeumen, PFLEGE_TAKT_MS);
      inject(DestroyRef).onDestroy(() => {
        document.removeEventListener('visibilitychange', beiSichtbar);
        clearInterval(takt);
      });
      return antworten;
    },
  }
);
