# Korbjäger search B: `/suchen` with the search by Verein, in the title bar

Issue: [#2989](https://github.com/WolfSoko/wol-sok-mono/issues/2989), ticket B of [#2958](https://github.com/WolfSoko/wol-sok-mono/issues/2958) (spec and plan in [PR #2959](https://github.com/WolfSoko/wol-sok-mono/pull/2959)). Builds on ticket A, [#2988](https://github.com/WolfSoko/wol-sok-mono/issues/2988) ([PR #2995](https://github.com/WolfSoko/wol-sok-mono/pull/2995)): the DBB has no Verein search, so a crawled club index is served at `GET /api/clubs` (every Club once, by name, `IndexedClub[]`, cached a day), and the device searches it itself.

## Goal

An Elternteil finds their child's Team without its id or the Liga it plays in: they open the search from the title bar, type part of the Verein's name, pick the Verein and follow one of its Teams.

## Non-goals

- "Über mein Kind" (ticket C, [#2990](https://github.com/WolfSoko/wol-sok-mono/issues/2990)): B leaves its way in out; C adds it.
- Any change to the index, its crawl or `/api/clubs` (ticket A).
- A search by a child's name (ADR 0019 stays).
- Offline search: `/api/clubs` stays out of the service worker and the device's last answers.

## Decisions

1. **Pages.** `/suchen` (`pages/suchen/index.page.ts`) holds the Verein search and a way to the Liga wizard ("Über die Liga" → `/team-einrichten`). `/suchen/verein/:id` (`pages/suchen/verein/[id].page.ts`) shows the Verein's name and its Teams through the existing `vereinsTeams` read and `VereinsTeamsComponent` with the follow control. A `suchen.page.ts` beside the folder would make Analog treat it as a layout, hence `index.page.ts`.
2. **The index on the device.** A root service `ClubIndex` (`src/app/search/club-index.ts`) loads `/api/clubs` once per start, on the first search, and keeps it in memory; a failed load can be retried. It fetches through the same `fetch` helpers the DBB transport uses (extracted from `proxy-transport.ts` into `proxy-fetch.ts`: time limit, `navigator.onLine`, `offline`/`unavailable`), so `fehlerText` words its failures as on every screen. The body is checked by a guard in the lib (`parseIndexedClubs`, `unexpected-shape` when it is no list; malformed entries dropped).
3. **Fold once (learning 332).** The lib's `clubsMatching(index, term)` folds every name on every call. It becomes `clubSearch(index)`, which folds each name once and returns a function of the term with the same rules (case, diacritics, `ß`, every word); `ClubIndex` builds it when the list loads, so a keystroke only compares strings.
4. **Typing.** The term lives in a signal, debounced 300 ms before it searches; it is kept in memory by the search's root state, so Back from a Verein shows the same hits. It never goes into the URL: a reload would send it to Hosting, and the privacy policy says the typed text stays on the device. At least 2 characters; at most 30 hits shown, with a hint to type more when there are more.
5. **Empty or partial index.** The first fill takes about a day, and `/api/clubs` carries no completeness marker. An empty list says the Verein list is still being built and points to the Liga way; a search without hits says no Verein was found, that the list may not hold every Verein yet, and points to the Liga way as well. No change to ticket A's route is needed.
6. **Title bar.** A search action (`search` icon, `aria-label="Suchen"`, `routerLink="/suchen"`) before the settings, in every build (the settings show only where sign-in is built).
7. **Ways in.** The home page's "Such das Team über seine Liga." and the empty overview's "Team einrichten" both lead to `/suchen` ("Such das Team über seinen Verein oder seine Liga.", "Team suchen").
8. **Breadcrumbs.** `/suchen`: `Suchen`. `/suchen/verein/:id`: `Suchen › <Verein's name>` ("Verein" until it is read). `/team-einrichten` sits below the search: `Suchen › Team einrichten`.
9. **English names, German texts.** New identifiers are English (Coding Rule 10); the UI stays German (`deutsche-texte.spec.ts`). Both pages are `noindex` like every page; no sitemap or analytics (the app has none).

## Acceptance

1. The title bar shows "Suchen" in every build; it opens `/suchen`.
2. On `/suchen`, typing `wasbuttel` (after the debounce) lists `MTV Wasbüttel` as a link to `/suchen/verein/<id>`; one character lists nothing; more than 30 hits show 30 and the hint.
3. `/api/clubs` is fetched once per start, not per keystroke; the term is never part of a request or the URL.
4. An empty index, no hits, offline, no connection and a 502 each show their own German text; the failures offer "Erneut versuchen".
5. `/suchen/verein/:id` shows the Verein's name and its Teams, each with "Team folgen"; following one puts it into Meine Teams. An unknown id says the DBB does not know the Verein; a malformed id too.
6. Back from a Verein's page shows the same term and hits.
7. Breadcrumbs as in decision 8; "Über die Liga" opens the wizard.
8. The home page's and the empty overview's links lead to `/suchen`.
9. `noindex` on both pages; `deutsche-texte.spec.ts`, `theme.spec.ts`, the contrast e2e (with `/suchen`) stay green.
10. `nx affected -t lint,lint-templates,test,typecheck-specs,build` and the korbjaeger e2e are green.

## Open questions

None. Ticket C adds "Über mein Kind" to `/suchen`.
