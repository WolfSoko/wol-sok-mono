import {
  DOCUMENT,
  effect,
  inject,
  Injectable,
  Signal,
  signal,
} from '@angular/core';
import { THEME_SETTINGS } from './provide-theme';
import { readStored, writeStored } from './stored-choice';

/** The visitor's choice of theme: a fixed one, or whatever the system uses. */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** Every choice, in the order a cycle or a toggle group offers them. */
export const THEME_CHOICES: readonly ThemeChoice[] = [
  'system',
  'light',
  'dark',
];

/** Whether `value` is one of `THEME_CHOICES`. */
export function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.some((choice) => choice === value);
}

/**
 * The site's theme. The stylesheet follows `color-scheme` and
 * `light-dark()`, so with no choice it tracks the system live; a choice
 * pins `data-theme` on the root element, which the stylesheet turns into a
 * fixed `color-scheme`, and, where the app gave theme colours, the
 * `theme-color` metas to that theme's colour. The app's pre-paint script in
 * `index.html` sets `data-theme` from the same key before the first paint,
 * so a pinned theme never flashes the other one.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly settings = inject(THEME_SETTINGS);
  private readonly chosen = signal<ThemeChoice>(this.stored());

  /** The visitor's choice. */
  public readonly choice: Signal<ThemeChoice> = this.chosen.asReadonly();

  public constructor() {
    effect(() => this.apply(this.chosen()));
  }

  /** Takes `choice` and keeps it on the device (none kept for `system`). */
  public choose(choice: ThemeChoice): void {
    this.chosen.set(choice);
    writeStored(this.settings.storageKey, choice === 'system' ? null : choice);
  }

  /** The next choice in the cycle system → light → dark → system. */
  public cycle(): void {
    const index = THEME_CHOICES.indexOf(this.chosen());
    this.choose(THEME_CHOICES[(index + 1) % THEME_CHOICES.length]);
  }

  private apply(choice: ThemeChoice): void {
    const root = this.document.documentElement;
    if (choice === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', choice);
    }
    this.applyThemeColors(choice);
  }

  private applyThemeColors(choice: ThemeChoice): void {
    const colors = this.settings.themeColors;
    if (!colors) {
      return;
    }
    for (const meta of this.document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )) {
      const own = meta.getAttribute('media')?.includes('dark')
        ? 'dark'
        : 'light';
      meta.content = colors[choice === 'system' ? own : choice];
    }
  }

  private stored(): ThemeChoice {
    const value = readStored(this.settings.storageKey);
    return isThemeChoice(value) ? value : 'system';
  }
}
