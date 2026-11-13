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
import { clubColorTokens } from './club-color-tokens';

const sameOrNone = (
  a: ClubColors | undefined,
  b: ClubColors | undefined
): boolean => a === b || (!!a && !!b && sameColors(a, b));

/**
 * Sets the tokens of `colors()` on the element being created as custom
 * properties, each a `light-dark()`, so they reach everything inside and a
 * dark scope (`.anzeigetafel`) still turns them; takes them away where
 * there are no colours, or their chunk could not load (the app's own apply
 * then). A newer choice wins over a load still running. Call it in an
 * injection context.
 */
function applyColors(colors: () => ClubColors | undefined): void {
  const element = inject(ElementRef<HTMLElement>).nativeElement;
  const current = computed(colors, { equal: sameOrNone });
  let set: readonly string[] = [];
  const remove = (): void => {
    for (const name of set) {
      element.style.removeProperty(name);
    }
    set = [];
  };
  effect((onCleanup) => {
    const chosen = current();
    let applies = true;
    onCleanup(() => {
      applies = false;
    });
    if (chosen === undefined) {
      remove();
      return;
    }
    void clubColorTokens(chosen)
      .catch(() => undefined)
      .then((tokens) => {
        if (!applies) {
          return;
        }
        if (tokens === undefined) {
          remove();
          return;
        }
        // the same names every time: overwritten, not taken away first
        for (const [name, value] of Object.entries(tokens)) {
          element.style.setProperty(name, value);
        }
        set = Object.keys(tokens);
      });
  });
}

/**
 * Gives the element being created (a component's host) the colours an
 * Elternteil picked for the Verein `club()` (`Selection.clubColors`);
 * without any, or without a Verein, the app's own apply. While the colours
 * are not read (at start, and while a sign-in or sign-out switches
 * stores), the last ones stay, so the page does not flash the app's own.
 * Call it in an injection context.
 */
export function applyClubColors(club: () => ClubId | undefined): void {
  const selection = inject(AUSWAHL);
  const list = linkedSignal<
    readonly ClubColorsChoice[] | undefined,
    readonly ClubColorsChoice[] | undefined
  >({
    source: selection.clubColors,
    computation: (read, before) => read ?? before?.value,
  });
  applyColors(() => {
    const id = club();
    return id === undefined ? undefined : clubColorsFor(list(), id);
  });
}

/** Gives its element the colours `korbColorScheme`, as a preview does; none, the app's own. */
@Directive({ selector: '[korbColorScheme]' })
export class ColorSchemeDirective {
  public readonly korbColorScheme = input<ClubColors | undefined>();

  public constructor() {
    applyColors(this.korbColorScheme);
  }
}
