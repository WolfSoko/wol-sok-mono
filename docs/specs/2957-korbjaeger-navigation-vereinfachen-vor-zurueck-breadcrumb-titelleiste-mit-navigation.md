# Korbjäger: simpler navigation (back/forward, breadcrumb, title bar with navigation)

Issue: [#2957](https://github.com/WolfSoko/wol-sok-mono/issues/2957).

## Goal

Korbjäger runs mostly as an installed PWA (`display: standalone`), where the browser shows no back button, no forward button and no address bar. Today the only way around is the brand link "Korbjäger" to the overview and the links inside a page. The title bar becomes the app's navigation: a back and a forward button, and a breadcrumb that says where the parent is (`Korbjäger › Team › Spiel`) with every level above the current one a link.

## Non-goals

- No change to the pages' own content, headings or links (the Spiel page's Team links stay).
- No `document.title` per page (a separate change; the breadcrumb's data would serve it later).
- No bottom navigation bar or drawer: the app has one overview and pages below it.
- No gesture navigation (swipe back): the OS and browser own that.

## Decisions

1. **One title bar component**, `TitleBarComponent` (`korb-title-bar`, `src/app/navigation/title-bar.component.ts`), takes the `mat-toolbar` out of `app.component.ts`: back (`arrow_back`, "Zurück"), forward (`arrow_forward`, "Vor"), the breadcrumb, and the settings button as today, with room for one more action beside it (the search of [#2958](https://github.com/WolfSoko/wol-sok-mono/issues/2958)). Reason: app.component stays the shell; the bar is tested on its own.
2. **Back and forward follow the app's own history.** `AppHistory` (`src/app/navigation/app-history.ts`, root service) listens to the router's `NavigationStart`/`NavigationEnd` and keeps the visited entries with a position, through the pure `historyAfter(history, step)` (`history.ts`): an imperative navigation drops what lay ahead and adds the entry (a `replaceUrl` replaces the current one); a `popstate` navigation moves to the entry with the restored `navigationId`, or, where it is unknown (an entry from before this start), resets to it alone. `canGoBack`/`canGoForward` are computed from it. Back calls `Location.back()` where there is an entry behind, forward `Location.forward()` where there is one ahead. Reason: `history.length` counts other sites' entries too, and the Navigation API's `canGoForward` is missing in older Safari; Angular's `navigationId` in the history state is what identifies an entry.
3. **Back without app history goes up.** A page opened directly (a shared link, a restart of the PWA on a Team) has nothing behind it; back then navigates to the breadcrumb's parent (`replaceUrl: false`, so the browser's back still returns). On the overview without history back is disabled. Forward is disabled while nothing lies ahead. Both stay visible so the bar does not jump.
4. **The breadcrumb is declared by each page**, through `breadcrumb(() => Level[])` (`src/app/navigation/breadcrumb.ts`) in the page component's constructor; it writes the levels below the root into the root service `Breadcrumb` and clears them on destroy. A `Level` is `{ title: string; link?: readonly string[] }`. The root `Korbjäger` (link `/`) is always first; the last level is the current page, shown as text with `aria-current="page"`. Levels:
   - `/`: `Korbjäger` alone (no link, current).
   - `/team/{id}`: the Team's name once read, `Team` before and on failure.
   - `/spiel/{id}`: the followed side's Team (home side where both are, linked to `/team/{id}`), then `Spiel`; `Spiel` alone under the root where no side is followed or the Spiel is not read yet.
   - `/team-einrichten`: `Team einrichten`; `/einstellungen`: `Einstellungen`; `/privacy`: `Datenschutz`; `/impressum`: `Impressum`; unknown paths: `Seite nicht gefunden`.
     Reason: the Team's name and the followed side are only known inside the page; a static route table cannot give them.
5. **Markup**: `<nav aria-label="Seitenpfad">` with an `<ol>`, the separator `›` as CSS content (not read out). On a narrow screen every level shrinks with an ellipsis; the current level keeps its share first. The brand look of the root stays (Barlow Condensed from the theme's title font).
6. **Spiel page's followed side** comes from the existing `gefolgterVerein` logic, with `followedSide(spiel, followed)` beside it returning the Team (id, name), `gefolgterVerein` built on it, so colours and breadcrumb pick the same side.

## Acceptance

- [ ] The title bar shows back, forward, breadcrumb and (where sign-in is built) the settings button, all in German (`deutsche-texte.spec.ts` green).
- [ ] Overview → Team → Spiel: the breadcrumb reads `Korbjäger › <Team> › Spiel` (Spiel of a followed Team); a tap on `<Team>` opens the Team page.
- [ ] Back after that returns to the previous page; forward then goes to the Spiel again; forward is disabled at the newest entry.
- [ ] A Team page opened directly: back opens the overview; on the overview opened directly back is disabled.
- [ ] The current level carries `aria-current="page"`; the bar has no horizontal overflow at 360 px width with a long Team name.
- [ ] Unit specs for `historyAfter`, `AppHistory`, `Breadcrumb`/`breadcrumb`, `TitleBarComponent`, and the pages' levels; e2e `e2e/navigation.spec.ts` for the flows above.
- [ ] Existing e2e (they use the brand link and settings button) stay green.

## Open questions

None. Forward is shown, disabled while nothing lies ahead (decided with the approval).
