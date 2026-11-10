# Korbjäger: light/dark switch (System, Hell, Dunkel)

Issue: [#2925](https://github.com/WolfSoko/wol-sok-mono/issues/2925), parent [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861).

## Goal

A parent picks the look of Korbjäger themselves: "System" (the default, as today, following the device live), "Hell" or "Dunkel". The choice is kept on the device, applies before the first paint after a reload, and the scoreboard (`.anzeigetafel`) stays dark in every mode.

## Non-goals

- No sync of the choice to the account (issue: device only).
- No following of a change made in another open tab (`storage` event); the other tab takes it at its next start.
- No new colours: the theme stays Material 3's from `styles.scss` (#2918, #2922).
- No change to angular-examples' toolbar toggle (issue: not suited).

## Decisions

1. **Shared lib `libs/shared/theme` (`@wolsok/shared-theme`, tag `shared`).** It takes portfolio's `ThemeService` and its spec: `ThemeChoice = 'system' | 'light' | 'dark'`, `choice` signal, `choose(choice)` (new) and `cycle()` (portfolio's button), `data-theme` on `<html>`, the choice in `localStorage` (none stored for `system`), storage errors swallowed so the choice holds for the visit. Its inputs come from `provideTheme({ storageKey, themeColors? })`: the key, and optionally the two `theme-color` values. Without `themeColors` it leaves the `theme-color` metas alone. Reason: both apps then share one tested model, as the issue proposes; the service is small, so the extraction stays small. Portfolio keeps its key `wolsok.theme` and colours, so nothing changes for its visitors; its `stored-choice.ts` stays for the language choice.
2. **Korbjäger keeps its one `theme-color` `#e37100`.** The brand orange frames both modes (the issue allows it), so Korbjäger passes no `themeColors`.
3. **Key `korbjaeger-darstellung`**, as `DARSTELLUNG_SCHLUESSEL` in `src/app/geraete-speicher.ts`, added to `GERAETE_SCHLUESSEL` and named in section 4 of the privacy policy. The lib stores the raw choice (`light`/`dark`), not the app's `'1'` flag format.
4. **`styles.scss`**: `:root[data-theme='light'] { color-scheme: light }` and `:root[data-theme='dark'] { color-scheme: dark }` after the `html` rule. Every `--mat-sys-*` token is a native `light-dark()`, so the page turns; `.anzeigetafel` sets `color-scheme: dark` itself and stays dark.
5. **Pre-paint script** inline in `apps/korbjaeger/index.html`'s `<head>`, before the stylesheet: reads the key in a `try`, sets `data-theme` for `light`/`dark` only. A spec keeps the key in the script equal to `DARSTELLUNG_SCHLUESSEL`.
6. **Settings UI**: a card "Darstellung" of its own component (`src/app/darstellung/darstellung-wahl.component.ts`, `korb-darstellung-wahl`) with a `mat-button-toggle-group` "System" / "Hell" / "Dunkel" (labelled "Darstellung"), shown on `/einstellungen` above the account card, in every account state. The account-less text "Hier gibt es noch nichts einzustellen." goes, since there now is something. `provideTheme` sits in `app.config.ts`.
7. **Links** take `var(--mat-sys-primary)` for both states (unvisited and visited), set once on `a` in `styles.scss`; components with their own link colour keep it. Fixes the purple visited link on the home page.
8. **Contrast check**: `@axe-core/playwright` as a devDependency and an e2e spec that runs axe's `color-contrast` rule on the overview (with a followed Team), the Team page and the Spiel page in light and dark. Reason: keeps the contrast checked on every later change, not once.

## Acceptance

- [ ] "System", "Hell" and "Dunkel" in the settings, in German; "System" follows the device live (e2e: `emulateMedia` switches without reload).
- [ ] The choice survives a reload without a flash (e2e on the built app, light and dark: with the app's scripts blocked, `<html>` already carries `data-theme` and the body's background is the chosen scheme's).
- [ ] `.anzeigetafel` stays dark in all three modes (e2e: its computed `color-scheme` is `dark`).
- [ ] `korbjaeger-darstellung` is in `GERAETE_SCHLUESSEL` and the privacy policy names it.
- [ ] `src/theme.spec.ts` stays green.
- [ ] axe reports no contrast errors in either mode on the overview, the Team page and the Spiel page.
- [ ] Screenshots, phone and desktop, light and dark, linked from the PR.
- [ ] Visited and unvisited links take `--mat-sys-primary`.
- [ ] Portfolio behaves as before (its theme spec, moved to the lib, stays green; its index.html script spec stays).

## Open questions

1. Screenshots: a cloud session cannot upload images to GitHub. Recommended: put them on a private claude.ai page linked from the PR.
