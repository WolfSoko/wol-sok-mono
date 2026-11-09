import type { ThemeColors, ThemeSettings } from '@wolsok/shared-theme';

/** Where the choice is kept between visits; `index.html` reads it too. */
export const THEME_STORAGE_KEY = 'wolsok.theme';

/**
 * The colour the browser chrome takes per theme: the `theme-color` metas
 * in `index.html` carry the same two, one per `prefers-color-scheme`.
 */
export const THEME_COLORS: ThemeColors = {
  light: '#f6f8fb',
  dark: '#0b0f14',
};

/** The site's theme settings for `provideTheme`. */
export const PORTFOLIO_THEME: ThemeSettings = {
  storageKey: THEME_STORAGE_KEY,
  themeColors: THEME_COLORS,
};
