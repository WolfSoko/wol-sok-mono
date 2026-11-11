import { DestroyRef, DOCUMENT, inject, InjectionToken } from '@angular/core';
import {
  maintainAnswerCache,
  LocalAnswerCache,
} from '@wolsok/feat-korbjaeger-answers';
import { deviceStorage } from '@wolsok/utils-browser-storage';
import { SPEICHERBARE_ARTEN } from './proxy-transport';

/**
 * The device's last good answers (`LocalAnswerCache`), kept clear of
 * answers too old and of kinds no longer kept (`maintainAnswerCache`: at the
 * start, whenever the page comes back into view, and hourly while it stays
 * open); until the app ends.
 */
export const LETZTE_ANTWORTEN = new InjectionToken<LocalAnswerCache>(
  'LETZTE_ANTWORTEN',
  {
    providedIn: 'root',
    factory: () => {
      const antworten = new LocalAnswerCache(deviceStorage());
      const stoppen = maintainAnswerCache(antworten, {
        document: inject(DOCUMENT),
        kinds: SPEICHERBARE_ARTEN,
      });
      inject(DestroyRef).onDestroy(stoppen);
      return antworten;
    },
  }
);
