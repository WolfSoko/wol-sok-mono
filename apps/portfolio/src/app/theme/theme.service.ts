import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  Signal,
  signal,
} from '@angular/core';

/** The visitor's choice of theme: a fixed one, or whatever the system uses. */
export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_CHOICES: readonly ThemeChoice[] = [
  'system',
  'light',
  'dark',
];

/** Where the choice is kept between visits; `index.html` reads it too. */
export const THEME_STORAGE_KEY = 'wolsok.theme';

/** The colour the browser chrome takes per theme (`theme-color`). */
const THEME_COLORS: Readonly<Record<'light' | 'dark', string>> = {
  light: '#f6f8fb',
  dark: '#0b0f14',
};

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.some((choice) => choice === value);
}

/**
 * The site's theme. The stylesheet follows `color-scheme` and `light-dark()`,
 * so with no choice it tracks the system; a choice pins `data-theme` on the
 * root element, which the stylesheet turns into a fixed `color-scheme`.
 * A small script in `index.html` applies the stored choice before the first
 * paint, so a pinned theme never flashes the other one.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly chosen = signal<ThemeChoice>(this.stored());

  /** The visitor's choice. */
  public readonly choice: Signal<ThemeChoice> = this.chosen.asReadonly();

  public constructor() {
    effect(() => this.apply(this.chosen()));
  }

  public setChoice(choice: ThemeChoice): void {
    this.chosen.set(choice);
    if (!this.browser) {
      return;
    }
    try {
      if (choice === 'system') {
        this.document.defaultView?.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        this.document.defaultView?.localStorage.setItem(
          THEME_STORAGE_KEY,
          choice
        );
      }
    } catch {
      // private mode or storage blocked: the choice holds for this visit
    }
  }

  /** The next choice in the cycle system → light → dark → system. */
  public cycle(): void {
    const index = THEME_CHOICES.indexOf(this.chosen());
    this.setChoice(THEME_CHOICES[(index + 1) % THEME_CHOICES.length]);
  }

  private apply(choice: ThemeChoice): void {
    const root = this.document.documentElement;
    if (choice === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', choice);
    }
    if (!this.browser) {
      return;
    }
    const dark =
      choice === 'dark' ||
      (choice === 'system' &&
        this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)')
          .matches);
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[dark ? 'dark' : 'light']);
  }

  private stored(): ThemeChoice {
    if (!this.browser) {
      return 'system';
    }
    try {
      const value =
        this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return isThemeChoice(value) ? value : 'system';
    } catch {
      return 'system';
    }
  }
}
