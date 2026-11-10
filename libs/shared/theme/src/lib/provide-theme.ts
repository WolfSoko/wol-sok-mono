import {
  InjectionToken,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';

/** The colour the browser chrome takes per theme. */
export interface ThemeColors {
  readonly light: string;
  readonly dark: string;
}

/** What an app tells `ThemeService`. */
export interface ThemeSettings {
  /** Where the choice is kept between visits; the app's pre-paint script reads it too. */
  readonly storageKey: string;
  /**
   * The `theme-color` per theme, as the app's `theme-color` metas carry
   * them (one per `prefers-color-scheme`). Left out, the metas stay as
   * `index.html` has them, one colour for both themes.
   */
  readonly themeColors?: ThemeColors;
}

export const THEME_SETTINGS = new InjectionToken<ThemeSettings>(
  'THEME_SETTINGS',
  {
    providedIn: 'root',
    factory: () => {
      throw new Error(
        'ThemeService needs provideTheme({ storageKey }) in the app config.'
      );
    },
  }
);

/** Sets up `ThemeService` for the app. */
export function provideTheme(settings: ThemeSettings): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: THEME_SETTINGS, useValue: settings },
  ]);
}
