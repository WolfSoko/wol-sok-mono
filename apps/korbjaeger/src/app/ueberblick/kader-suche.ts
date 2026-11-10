import { inject, Injector } from '@angular/core';
import {
  kaderSuchen,
  type KaderFunde,
  type KaderSucheAuftrag,
} from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DatenResource,
} from '../basketball-data/basketball-data-resource';
import { gleicheFolge } from '@wolsok/feat-korbjaeger-auswahl';

/**
 * How many of a Team's last played Spiele the overview looks into for the
 * marked Kinder (`zuletztGespielt`). A Kind missing from all of them
 * leaves the Team among the Teams without a Kind.
 */
export const KADER_SUCHE_SPIELE = 5;

/**
 * A resource running `kaderSuchen` for the order `auftrag` gives, none
 * while it gives none; a new order cancels the last. Created in an
 * injection context, or on `injector`.
 */
export function kaderSucheResource(
  auftrag: () => KaderSucheAuftrag | undefined,
  injector: Injector = inject(Injector)
): DatenResource<KaderFunde | undefined> {
  return basketballDataResource(auftrag, kaderSuchen, injector);
}

/**
 * Whether the search for `b` need not run again after the one for `a`:
 * the same Team and Spiele, and Kinder `a` looked for already. A Kind
 * unmarked thus starts no search; the finds of the others stay as they
 * are, those of the Kind unmarked unused.
 */
export function gleicherAuftrag(
  a: KaderSucheAuftrag | undefined,
  b: KaderSucheAuftrag | undefined
): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }
  return (
    a.team === b.team &&
    gleicheFolge(
      a.spiele.map(({ id }) => id),
      b.spiele.map(({ id }) => id)
    ) &&
    b.kinder.length > 0 &&
    b.kinder.every((person) => a.kinder.includes(person))
  );
}
