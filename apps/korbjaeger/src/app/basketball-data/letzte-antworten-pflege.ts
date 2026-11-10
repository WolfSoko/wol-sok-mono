import { DestroyRef, DOCUMENT, inject, InjectionToken } from '@angular/core';
import {
  antwortenPflegen,
  LokaleLetzteAntworten,
} from '@wolsok/feat-korbjaeger-antworten';
import { geraeteSpeicher } from '../geraete-speicher';
import { SPEICHERBARE_ARTEN } from './proxy-transport';

/**
 * The device's last good answers (`LokaleLetzteAntworten`), kept clear of
 * answers too old and of kinds no longer kept (`antwortenPflegen`: at the
 * start, whenever the page comes back into view, and hourly while it stays
 * open); until the app ends.
 */
export const LETZTE_ANTWORTEN = new InjectionToken<LokaleLetzteAntworten>(
  'LETZTE_ANTWORTEN',
  {
    providedIn: 'root',
    factory: () => {
      const antworten = new LokaleLetzteAntworten(geraeteSpeicher());
      const stoppen = antwortenPflegen(antworten, {
        document: inject(DOCUMENT),
        arten: SPEICHERBARE_ARTEN,
      });
      inject(DestroyRef).onDestroy(stoppen);
      return antworten;
    },
  }
);
