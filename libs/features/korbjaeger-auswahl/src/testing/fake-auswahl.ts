import { signal } from '@angular/core';
import type { Auswahl } from '../lib/auswahl';

/**
 * An `Auswahl` for a spec that needs one to behave in a way no adapter
 * does (a change failing, nothing read yet): `teile` as given, the rest
 * with nothing followed or marked and every change resolving.
 */
export function fakeAuswahl(teile: Partial<Auswahl> = {}): Auswahl {
  return {
    teams: signal([]),
    kinder: signal([]),
    nichtLesbar: signal(false),
    quelle: signal('fake'),
    folgen: () => Promise.resolve(),
    entfolgen: () => Promise.resolve(undefined),
    markieren: () => Promise.resolve(),
    spitznameSetzen: () => Promise.resolve(),
    entmarkieren: () => Promise.resolve(),
    vereinsfarben: signal([]),
    vereinsfarbenSetzen: () => Promise.resolve(),
    vereinsfarbenZuruecksetzen: () => Promise.resolve(),
    ...teile,
  };
}
