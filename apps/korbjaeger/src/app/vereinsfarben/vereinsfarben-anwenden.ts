import {
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  type Signal,
} from '@angular/core';
import type { VereinId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  vereinsfarbenVon,
  type VereinsfarbenWahl,
} from '../auswahl/vereinsfarben-wahl';
import type { FarbschemaTokens } from './farbschema';
import { gleicheFarben, type Vereinsfarben } from './vereinsfarben';

/** How many colour pairs' tokens stay at hand: one a Verein, as many as the Auswahl holds. */
const ZWISCHENSPEICHER_GROESSE = 50;

const zwischenspeicher = new Map<string, Promise<FarbschemaTokens>>();

/**
 * The `--mat-sys-*` tokens of `farben`, computed once a colour pair. The
 * colour maths (`farbschema.ts`, Material's colour library) is a chunk of
 * its own, loaded only once a Verein has colours: most visitors never load
 * it.
 */
export function vereinsfarbenTokens(
  farben: Vereinsfarben
): Promise<FarbschemaTokens> {
  const schluessel = `${farben.primaer} ${farben.zweite ?? ''}`;
  let tokens = zwischenspeicher.get(schluessel);
  if (tokens === undefined) {
    tokens = import('./farbschema').then(({ farbschemaTokens }) =>
      farbschemaTokens(farben)
    );
    // a failed load is tried again next time, unless a newer one took its place
    const diese = tokens;
    tokens.catch(() => {
      if (zwischenspeicher.get(schluessel) === diese) {
        zwischenspeicher.delete(schluessel);
      }
    });
    if (zwischenspeicher.size >= ZWISCHENSPEICHER_GROESSE) {
      const aeltester = zwischenspeicher.keys().next().value;
      if (aeltester !== undefined) {
        zwischenspeicher.delete(aeltester);
      }
    }
    zwischenspeicher.set(schluessel, tokens);
  }
  return tokens;
}

/**
 * Sets the tokens of `farben()` on `element` as custom properties, each a
 * `light-dark()`, so they reach everything inside and a dark scope
 * (`.anzeigetafel`) still turns them; takes them away where there are no
 * colours. A newer choice wins over a load still running.
 */
function farbenAnwenden(
  farben: Signal<Vereinsfarben | undefined>,
  element: HTMLElement
): void {
  let gesetzt: readonly string[] = [];
  effect((onCleanup) => {
    const aktuell = farben();
    let gilt = true;
    onCleanup(() => {
      gilt = false;
    });
    if (aktuell === undefined) {
      entfernen();
      return;
    }
    vereinsfarbenTokens(aktuell).then(
      (tokens) => {
        if (gilt) {
          entfernen();
          for (const [name, wert] of Object.entries(tokens)) {
            element.style.setProperty(name, wert);
          }
          gesetzt = Object.keys(tokens);
        }
      },
      // without the chunk (offline before it was cached), the app's own apply
      () => {
        if (gilt) {
          entfernen();
        }
      }
    );
  });

  function entfernen(): void {
    for (const name of gesetzt) {
      element.style.removeProperty(name);
    }
    gesetzt = [];
  }
}

const gleicheOderKeine = (
  a: Vereinsfarben | undefined,
  b: Vereinsfarben | undefined
): boolean => a === b || (!!a && !!b && gleicheFarben(a, b));

/**
 * Gives the element being created (a component's host, a directive's) the
 * colours an Elternteil picked for the Verein `verein()`
 * (`Auswahl.vereinsfarben`); without any, or without a Verein, the app's
 * own apply. While the colours are not read (at start, and while a sign-in
 * or sign-out switches stores), the last ones stay, so the page does not
 * flash the app's own. Call it in an injection context.
 */
export function vereinsfarbenAnwenden(
  verein: () => VereinId | undefined
): void {
  const auswahl = inject(AUSWAHL);
  const liste = linkedSignal<
    readonly VereinsfarbenWahl[] | undefined,
    readonly VereinsfarbenWahl[] | undefined
  >({
    source: auswahl.vereinsfarben,
    computation: (gelesen, vorher) => gelesen ?? vorher?.value,
  });
  const farben = computed(
    () => {
      const id = verein();
      return id === undefined ? undefined : vereinsfarbenVon(liste(), id);
    },
    { equal: gleicheOderKeine }
  );
  farbenAnwenden(farben, inject(ElementRef<HTMLElement>).nativeElement);
}

/** Gives its element the colours picked for the Verein `korbVereinsfarben`. */
@Directive({ selector: '[korbVereinsfarben]' })
export class VereinsfarbenDirective {
  public readonly korbVereinsfarben = input<VereinId | undefined>();

  public constructor() {
    vereinsfarbenAnwenden(this.korbVereinsfarben);
  }
}

/** Gives its element the colours `korbFarbschema`, as a preview does; none, the app's own. */
@Directive({ selector: '[korbFarbschema]' })
export class FarbschemaDirective {
  public readonly korbFarbschema = input<Vereinsfarben | undefined>();

  public constructor() {
    farbenAnwenden(
      computed(() => this.korbFarbschema(), { equal: gleicheOderKeine }),
      inject(ElementRef<HTMLElement>).nativeElement
    );
  }
}
