import { computed, type Signal } from '@angular/core';
import {
  gleicheListe,
  jedeListe,
  type AuswahlListe,
  type ListenWert,
} from './auswahl-listen';

/** A signal of each list of an `Auswahl`, `U` where it has none to tell. */
export type ListenSignale<U = never> = {
  readonly [L in AuswahlListe]: Signal<readonly ListenWert<L>[] | U>;
};

/**
 * A signal of each list, read by `lesen`, which tells only when the list
 * changed by its descriptor's equality: an equal list read anew changes
 * nothing downstream.
 */
export function listenSignale<U = never>(
  lesen: <L extends AuswahlListe>(
    liste: L
  ) => readonly ListenWert<L>[] | NoInfer<U>
): ListenSignale<U> {
  return jedeListe<ListenSignale<U>>(<L extends AuswahlListe>(liste: L) =>
    computed(() => lesen(liste), {
      equal: (a, b) =>
        a === b ||
        (Array.isArray(a) && Array.isArray(b) && gleicheListe<L>(liste, a, b)),
    })
  );
}
