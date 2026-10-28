import {
  DOCUMENT,
  effect,
  inject,
  Injectable,
  Signal,
  signal,
} from '@angular/core';
import { readStored, writeStored } from '../stored-choice';

/** The visitor's choice of theme: a fixed one, or whatever the system uses. */
export type ThemeChoice = 'system' | 'light' | 'dark';

const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

/** Where the choice is kept between visits; `index.html` reads it too. */
export const THEME_STORAGE_KEY = 'wolsok.theme';

/**
 * The colour the browser chrome takes per theme: the `theme-color` metas
 * in `index.html` carry the same two, one per `prefers-color-scheme`.
 */
export const THEME_COLORS: Readonly<Record<'light' | 'dark', string>> = {
  light: '#f6f8fb',
  dark: '#0b0f14',
};

function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.some((choice) => choice === value);
}

/**
 * The site's theme. The stylesheet follows `color-scheme` and `light-dark()`,
 * so with no choice it tracks the system, as do the two `theme-color` metas
 * through their media queries; a choice pins `data-theme` on the root
 * element, which the stylesheet turns into a fixed `color-scheme`, and both
 * metas to that theme's colour. A small script in `index.html` does the same
 * before the first paint, so a pinned theme never flashes the other one.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly chosen = signal<ThemeChoice>(this.stored());

  /** The visitor's choice. */
  public readonly choice: Signal<ThemeChoice> = this.chosen.asReadonly();

  public constructor() {
    effect(() => this.apply(this.chosen()));
  }

  /** The next choice in the cycle system → light → dark → system. */
  public cycle(): void {
    const index = THEME_CHOICES.indexOf(this.chosen());
    const choice = THEME_CHOICES[(index + 1) % THEME_CHOICES.length];
    this.chosen.set(choice);
    writeStored(THEME_STORAGE_KEY, choice === 'system' ? null : choice);
  }

  private apply(choice: ThemeChoice): void {
    const root = this.document.documentElement;
    if (choice === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', choice);
    }
    for (const meta of this.document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )) {
      const own = meta.getAttribute('media')?.includes('dark')
        ? 'dark'
        : 'light';
      meta.content = THEME_COLORS[choice === 'system' ? own : choice];
    }
  }

  private stored(): ThemeChoice {
    const value = readStored(THEME_STORAGE_KEY);
    return isThemeChoice(value) ? value : 'system';
  }
}
