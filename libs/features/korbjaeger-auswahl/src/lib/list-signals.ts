import { computed, type Signal } from '@angular/core';
import {
  equalLists,
  everyList,
  type AuswahlListe,
  type ListValue,
} from './selection-lists';

/** A signal of each list of an `Auswahl`, `U` where it has none to tell. */
export type ListSignals<U = never> = {
  readonly [L in AuswahlListe]: Signal<readonly ListValue<L>[] | U>;
};

/**
 * A signal of each list, read by `lesen`, which tells only when the list
 * changed by its descriptor's equality: an equal list read anew changes
 * nothing downstream.
 */
export function listSignals<U = never>(
  read: <L extends AuswahlListe>(
    list: L
  ) => readonly ListValue<L>[] | NoInfer<U>
): ListSignals<U> {
  return everyList<ListSignals<U>>(<L extends AuswahlListe>(list: L) =>
    computed(() => read(list), {
      equal: (a, b) =>
        a === b ||
        (Array.isArray(a) && Array.isArray(b) && equalLists<L>(list, a, b)),
    })
  );
}
