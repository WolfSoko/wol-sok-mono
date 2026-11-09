# Korbjäger: search by Kind or Verein (wizard, a feature of its own in the navigation)

Issue: [#2958](https://github.com/WolfSoko/wol-sok-mono/issues/2958), parent [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861). Related: [#2957](https://github.com/WolfSoko/wol-sok-mono/issues/2957) (simpler navigation), [#2947](https://github.com/WolfSoko/wol-sok-mono/issues/2947) (DBB source and proxy cache), [PR #2954](https://github.com/WolfSoko/wol-sok-mono/pull/2954) (Kader search into the lib).

This is an idea-level plan: it fixes the decisions and splits the work into three tickets. Each ticket gets its own spec before it is built.

## Goal

An Elternteil reaches their child's Team without knowing its Liga. Today the only way in is the wizard "Team einrichten" (`src/app/team-einrichten/`): Verband → Altersklasse and Geschlecht → Liga → Team. Most parents know their Verein, not the Liga's name. Searching becomes a feature of its own in the navigation, with two ways in:

- **"Über den Verein"**: type the Verein's name, pick it, see its Teams, follow one.
- **"Über mein Kind"**: the same Verein path, which then leads on to marking the Kind in the Kader of the followed Team's last played Spiel, in one flow.

The Liga wizard stays as a third way ("Über die Liga").

## Non-goals

- **No search by a child's name**, no player pages, no index of persons (ADR 0019 stays as it is). "Über mein Kind" finds the Kind only through their Team.
- No change to the cache times of the existing eight reads (ADR 0018 stays: `max-age=60, s-maxage=300`, a finished boxscore `s-maxage=3600`).
- No new titlebar, breadcrumb or back navigation; that is #2957, which takes the search entry into its titlebar later.
- No search across Verbände by Liga name or Team name beyond what the Verein search gives.

## Decisions

Decided on 2026-11-09 (cockpit request 773, the manager on the owner's behalf, all five recommendations taken).

1. **ADR 0019 stays: no name search for a child.** A name search would publish more than the DBB's own pages do and would need a stored index of children's names, both of which the ADR rules out. "Über mein Kind" therefore runs Verein → Team → follow → open the Team's last played Spiel → "Als mein Kind markieren" in that Kader (the existing `src/app/kind/` dialog). Where the Team has played no Spiel yet, the flow ends at the hint the app already gives ("after the first Spiel"). Reopening this is an ADR change by the owner, not a ticket decision.
2. **Data for the Verein search: probe the DBB first.** The API the app uses has no Verein search, while basketball-bund.net offers one on its own pages. Ticket A probes for the endpoint behind it (as ADR 0018's probe did: method, path, body, envelope, caching, whether it returns persons). If it exists, it becomes the ninth allowlisted read (`DbbRequest` kind `verein-suche` in `dbbHttpRequest`, its mapping in `DbbBasketballData`, a GET route `/api/dbb/vereine?q=…` built by `PROXY_ROUTES`, a place in `KorbjaegerData`), with an amendment to ADR 0018. Only if none exists does a backend index follow: a scheduled function (weekly, throttled) collects Vereine (id, name, Verband) from the Ligen's Tabellen into a stored list without persons; that variant needs its own decision on DBB load and storage before it is built.
3. **Longer cache only for the new search data.** The Verein search answer (or the index) is cached `s-maxage` one day: club names change rarely, and a long CDN cache keeps the DBB's load per search low. The search answer is not kept in the device's `LokaleLetzteAntworten` (it is not one of `SPEICHERBARE_ARTEN`), so offline the search says it needs the internet. `PROXY_CACHE_SEKUNDEN` (`src/shared/proxy-cache.ts`) gets the new value, so the privacy policy names it.
4. **Navigation: route `/suchen` behind a search icon in the toolbar**, next to the settings icon in `app.component.ts` (`matIconButton`, `aria-label="Suchen"`, shown in every build, unlike the settings, which only show with `anmeldung`). `/suchen` offers the three ways in ("Über den Verein", "Über mein Kind", "Über die Liga", the last linking to the existing wizard). The home page's link to "Team einrichten" points to `/suchen` instead. #2957 moves the icon into its titlebar.
5. **Three tickets**, each specified on its own:
   - **A: DBB probe and the Verein search read** (lib `feat-shared-basketball-data`, proxy, ADR 0018 amendment, fixtures through the anonymiser, cache time and privacy policy).
   - **B: `/suchen` with "Über den Verein"** (search field with debounce, result list, a Verein's Teams through the existing `vereinsTeams` read and `VereinsTeamsComponent` with `TeamFolgenComponent`, the toolbar icon). Depends on A.
   - **C: "Über mein Kind"** (B's Verein path, then follow, the last played Spiel's Kader of that Team, marking; the hint where none was played). Depends on B.

## Constraints the tickets keep

- German UI only (`src/deutsche-texte.spec.ts`), `noindex` on `/suchen` like every page, no sitemap entry.
- The proxy stays allowlisted: the query of the search route is validated (length, characters) and unknown parameters are 404, as for the Liga search.
- No search term is sent to analytics or logged with the uid; the term goes only to the proxy and on to the DBB. The privacy policy says so.
- The search screen reads through the `BASKETBALL_DATA` port only, in its own component under `src/app/suche/`; the result's domain type lives in the lib.

## Acceptance (of this spec)

- [ ] The decisions above are recorded; planning turns them into tickets A, B and C with their dependencies (A blocks B, B blocks C), linked to #2958 through the relationships field.
- [ ] No ADR changes in this PR; ticket A carries the ADR 0018 amendment.

## Open questions

1. Probe result: if the DBB's Verein search turns out to return persons (contact names of a club), ticket A maps only id, name and Verband and drops the rest, as `dbbOhnePersonen` does. If it returns nothing usable, the backend-index variant comes back to the owner as a decision of its own (DBB load, storage, refresh) before anything is built.
2. Whether "Über mein Kind" should also be offered from a followed Team's card without going through `/suchen` is left to ticket C.
