import { DestroyRef, DOCUMENT, inject, InjectionToken } from '@angular/core';
import {
  maintainAnswerCache,
  LocalAnswerCache,
} from '@wolsok/feat-korbjaeger-answers';
import { deviceStorage } from '@wolsok/utils-browser-storage';
import { STORABLE_KINDS } from './proxy-transport';

/**
 * The device's last good answers (`LocalAnswerCache`), kept clear of
 * answers too old and of kinds no longer kept (`maintainAnswerCache`: at the
 * start, whenever the page comes back into view, and hourly while it stays
 * open); until the app ends.
 */
export const ANSWER_CACHE = new InjectionToken<LocalAnswerCache>(
  'ANSWER_CACHE',
  {
    providedIn: 'root',
    factory: () => {
      const answers = new LocalAnswerCache(deviceStorage());
      const stopMaintenance = maintainAnswerCache(answers, {
        document: inject(DOCUMENT),
        kinds: STORABLE_KINDS,
      });
      inject(DestroyRef).onDestroy(stopMaintenance);
      return answers;
    },
  }
);
