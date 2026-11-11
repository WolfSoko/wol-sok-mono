import {
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import type { ClubId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  clubColorsFor,
  type ClubColorsChoice,
  sameColors,
  type ClubColors,
} from '@wolsok/feat-korbjaeger-selection';
import { vereinsfarbenTokens } from './vereinsfarben-tokens';

const gleicheOderKeine = (
  a: ClubColors | undefined,
  b: ClubColors | undefined
): boolean => a === b || (!!a && !!b && sameColors(a, b));

/**
 * Sets the tokens of `farben()` on the element being created as custom
 * properties, each a `light-dark()`, so they reach everything inside and a
 * dark scope (`.anzeigetafel`) still turns them; takes them away where
 * there are no colours, or their chunk could not load (the app's own apply
 * then). A newer choice wins over a load still running. Call it in an
 * injection context.
 */
function farbenAnwenden(farben: () => ClubColors | undefined): void {
  const element = inject(ElementRef<HTMLElement>).nativeElement;
  const aktuell = computed(farben, { equal: gleicheOderKeine });
  let gesetzt: readonly string[] = [];
  const entfernen = (): void => {
    for (const name of gesetzt) {
      element.style.removeProperty(name);
    }
    gesetzt = [];
  };
  effect((onCleanup) => {
    const gewaehlt = aktuell();
    let gilt = true;
    onCleanup(() => {
      gilt = false;
    });
    if (gewaehlt === undefined) {
      entfernen();
      return;
    }
    void vereinsfarbenTokens(gewaehlt)
      .catch(() => undefined)
      .then((tokens) => {
        if (!gilt) {
          return;
        }
        if (tokens === undefined) {
          entfernen();
          return;
        }
        // the same names every time: overwritten, not taken away first
        for (const [name, wert] of Object.entries(tokens)) {
          element.style.setProperty(name, wert);
        }
        gesetzt = Object.keys(tokens);
      });
  });
}

/**
 * Gives the element being created (a component's host) the colours an
 * Elternteil picked for the Verein `verein()` (`Auswahl.vereinsfarben`);
 * without any, or without a Verein, the app's own apply. While the colours
 * are not read (at start, and while a sign-in or sign-out switches
 * stores), the last ones stay, so the page does not flash the app's own.
 * Call it in an injection context.
 */
export function vereinsfarbenAnwenden(verein: () => ClubId | undefined): void {
  const auswahl = inject(AUSWAHL);
  const liste = linkedSignal<
    readonly ClubColorsChoice[] | undefined,
    readonly ClubColorsChoice[] | undefined
  >({
    source: auswahl.clubColors,
    computation: (gelesen, vorher) => gelesen ?? vorher?.value,
  });
  farbenAnwenden(() => {
    const id = verein();
    return id === undefined ? undefined : clubColorsFor(liste(), id);
  });
}

/** Gives its element the colours `korbFarbschema`, as a preview does; none, the app's own. */
@Directive({ selector: '[korbFarbschema]' })
export class FarbschemaDirective {
  public readonly korbFarbschema = input<ClubColors | undefined>();

  public constructor() {
    farbenAnwenden(this.korbFarbschema);
  }
}
