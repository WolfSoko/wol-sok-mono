# shared-theme

The light/dark choice the apps share (portfolio, Korbjäger):

- `ThemeService`: the visitor's `ThemeChoice` (`'system' | 'light' | 'dark'`)
  as a signal, `choose(choice)` and `cycle()`. A fixed choice sets
  `data-theme` on `<html>`, which the app's stylesheet turns into a fixed
  `color-scheme`; `system` removes it, so `light-dark()` follows the device
  live. The choice is kept in `localStorage` (nothing for `system`); where
  storage is blocked it holds for the visit.
- `provideTheme({ storageKey, themeColors? })`: the app's key and,
  optionally, the `theme-color` per theme, which the service then puts on
  the `theme-color` metas. Without it the metas stay as `index.html` has
  them.

- `readStored(key)` / `writeStored(key, value)`: the storage access the
  service uses (blocked storage and the server swallowed), for an app's
  other choices kept on the device, like the portfolio's language.

Each app sets `data-theme` before the first paint with a small inline
script in its `index.html` reading the same key; the app's spec keeps the
two equal.

`npx nx test shared-theme` runs its specs (Jest).
