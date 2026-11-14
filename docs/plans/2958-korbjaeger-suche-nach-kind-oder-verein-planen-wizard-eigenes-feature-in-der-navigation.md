# Plan: Korbjäger search by Kind or Verein

Issue: [#2958](https://github.com/WolfSoko/wol-sok-mono/issues/2958). Spec: [`docs/specs/2958-korbjaeger-suche-nach-kind-oder-verein-planen-wizard-eigenes-feature-in-der-navigation.md`](../specs/2958-korbjaeger-suche-nach-kind-oder-verein-planen-wizard-eigenes-feature-in-der-navigation.md). Decisions: cockpit request 773 (2026-11-09).

The spec's three tickets are sub-issues of #2958, each blocking the next:

| Ticket                                | Issue                                                                           | PR               |
| ------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| A: DBB probe and the club search read | [#2988](https://github.com/WolfSoko/wol-sok-mono/issues/2988)                   | one PR, A1 to A5 |
| B: `/suchen` with "Über den Verein"   | [#2989](https://github.com/WolfSoko/wol-sok-mono/issues/2989), blocked by #2988 | one PR, B1 to B5 |
| C: "Über mein Kind"                   | [#2990](https://github.com/WolfSoko/wol-sok-mono/issues/2990), blocked by #2989 | one PR, C1 to C3 |

#2958 carries the status label and is the one handed on; each PR closes its own ticket, the last one #2958 too. New code is English (CLAUDE.md, Coding Rule 10: `Club`, `Child`, `Roster`, `Game`); existing German identifiers are used as they are spelled until #2967 renames them. Every task runs `npx nx format:write` and `npx nx affected -t lint,lint-templates,test` before its commit.

## Ticket A: the club search read ([#2988](https://github.com/WolfSoko/wol-sok-mono/issues/2988))

### A1. Probe the DBB (gate)

- Find the call behind basketball-bund.net's Vereinssuche: load its page and the script bundles it references with `curl`, look for `/rest/` paths naming `club` or `verein`, then call the endpoint with two or three club names (a full name, a fragment, one with an umlaut). At most a dozen requests, with the app's User-Agent.
- Record: method, path, body or query, the envelope (`status`), the fields of a hit, whether it returns persons (contacts), paging, the `Cache-Control`/Varnish headers, behaviour for a one-letter and an empty query.
- Write the findings to `docs/specs/2988-korbjaeger-dbb-club-search-probe.md` (no names of persons; club names are public organisations).
- Commit: `docs(korbjaeger): probe the DBB's club search (#2988)`.
- **Gate:** if no usable endpoint exists, stop here. Put the backend-index variant to the owner as a `question` request (DBB load, storage, refresh), mark #2988 with the probe's result and leave B and C blocked.

### A2. Domain type, request and mapping in the lib

- `libs/features/basketball-data/src/lib/domain/club-search.ts`: `ClubHit { id: VereinId; name: string; associationId?: … }` (only what the probe shows and the UI needs), `ClubSearch { hits: readonly ClubHit[]; more: boolean }`, `parseClubQuery(text): ClubQuery | undefined` (trimmed, 2 to 50 characters, letters including umlauts and `ß`, digits, space, `-`, `.`, `'`, `/`; branded `ClubQuery`).
- `dbb/dbb-request.ts`: kind `{ kind: 'club-search'; query: ClubQuery }`; `dbbHttpRequest` builds the DBB call from the probe; `assertValidDbbRequest` checks the query.
- `dbb/map-club-search.ts`: guards for every field read (`unexpected-shape` with the field's path), persons dropped as `dbbOhnePersonen` does.
- `basketball-data.ts`: `clubSearch(query: ClubQuery, options?: O): Promise<ClubSearch>`; `DbbBasketballData` implements it.
- Fixture: an entry in `tools/korbjaeger/fixture-requests.ts`, recorded with `record-fixtures.ts`, run through `anonymise-fixtures.ts` (it fails on any surviving person); `fakeDbbAnswer` answers it.
- Tests: `domain/club-search.spec.ts` (query rules), `dbb/dbb-request.spec.ts` (method, path, refused query), `dbb/map-club-search.spec.ts` (fixture, missing field, persons dropped), `dbb-basketball-data.spec.ts` (the port method). `npx nx test feat-shared-basketball-data`.
- Commit: `feat(feat-shared-basketball-data): the DBB's club search as a read (#2988)`.

### A3. Proxy route

- `apps/korbjaeger/src/shared/dbb-proxy-routes.ts`: a `club-search` entry, path `/api/dbb/clubs`, the query in `q`, `readOf` through `parseClubQuery` (any other parameter or a refused query: `undefined`, so 404), `urlOf` back.
- Route file `apps/korbjaeger/src/server/routes/api/dbb/clubs.get.ts`, thin over `src/server/dbb/`.
- `src/shared/proxy-cache.ts`: `PROXY_CACHE_SEKUNDEN.cdnClubSearch = 86400`; the proxy sends `public, max-age=60, s-maxage=86400` on success, errors stay `no-store`.
- `KorbjaegerData` gets `clubSearch`; the browser transport's `SPEICHERBARE_ARTEN` stays without it.
- Tests: the route spec (200 with the fixture and its `Cache-Control`, 404 for a bad or extra parameter, 502 on DBB failure), `dbb-proxy-routes.spec.ts` (`urlOf`/`readOf` round trip), the `letzte-antworten` spec asserting `club-search` is not kept, `e2e/dbb-proxy.spec.ts` (headers, `X-Robots-Tag`) against the `fake-dbb` target. `npx nx test korbjaeger`, `npx nx run korbjaeger:e2e` (Playwright browsers: learning L298/L307).
- Commit: `feat(korbjaeger): proxy route for the club search (#2988)`.

### A4. Docs and privacy policy

- ADR 0018: an amendment section (date, the ninth read, its cache time and why); no new ADR.
- Privacy policy (`src/app/rechtliches/`): the search term goes through the proxy to the DBB, is not stored or measured; the cache time rendered from `PROXY_CACHE_SEKUNDEN` (its spec checks it).
- CLAUDE.md, Korbjäger section: the ninth read, route and cache time.
- Commit: `docs(korbjaeger): ADR 0018 amendment and privacy policy for the club search (#2988)`.

### A5. PR

PR "Closes #2988", CodeRabbit review, merge per CLAUDE.md.

## Ticket B: `/suchen` with "Über den Verein" ([#2989](https://github.com/WolfSoko/wol-sok-mono/issues/2989))

### B1. Club search resource

- `apps/korbjaeger/src/app/basketball-data/club-search-resource.ts`: `clubSearchResource(query: () => ClubQuery | undefined)`, a resource over `BASKETBALL_DATA.clubSearch` like `teamSaisonResource`, with the app's error kinds (`offline`, `unavailable`); no stored answer, so offline says the search needs the internet.
- Tests: its spec with a fake `BasketballData` (idle without a query, loading, hits, `offline`).
- Commit: `feat(korbjaeger): a resource for the club search (#2989)`.

### B2. Search page and the Verein path

- Page `apps/korbjaeger/src/app/pages/suchen.page.ts` (route `/suchen`) rendering `SearchPageComponent` (`src/app/search/search-page.component.ts`, `korb-search-page`): the three ways in as Material cards or list items; "Über die Liga" links to `/team-einrichten`.
- `src/app/search/club-search.component.ts` (`korb-club-search`): `mat-form-field` with a search input, 300 ms debounce on a signal, `parseClubQuery`, a `mat-progress-bar` while loading, the hits as links to `/suchen/verein/:id`, texts for no hit, a too-short query, offline and unavailable (`src/app/fehler/`).
- Page `src/app/pages/suchen/verein/[id].page.ts`: the Verein's name and its Teams through the existing `vereinsTeams` read and `VereinsTeamsComponent` with `TeamFolgenComponent`.
- Breadcrumb: `breadcrumb(() => [{ title: 'Suchen', link: ['/suchen'] }, …])` on both pages, the Verein's name as the last level.
- Tests: component specs (debounce, states, links), page specs, `deutsche-texte.spec.ts` and `theme.spec.ts` stay green.
- Commit: `feat(korbjaeger): search a Verein and follow its Teams on /suchen (#2989)`.

### B3. Title bar action and the home link

- `TitleBarComponent`: a `matIconButton` with `<mat-icon>search</mat-icon>`, `aria-label="Suchen"`, `routerLink="/suchen"`, in every build, before the settings.
- The home page's link to "Team einrichten" points to `/suchen`.
- Tests: `title-bar.component.spec.ts` (the action in builds with and without sign-in), the home spec.
- Commit: `feat(korbjaeger): search action in the title bar (#2989)`.

### B4. E2E and docs

- `e2e/suche.spec.ts`: title bar → `/suchen` → type a club from the fixture → its page → follow a Team → it shows on the overview; back through the title bar; `noindex` on both pages. `e2e/kontrast.spec.ts` gains `/suchen` in both looks.
- CLAUDE.md, Korbjäger section: the search pages and the title bar action. No portfolio or sitemap change (ADR 0019: no sitemap).
- Commit: `test(korbjaeger): e2e for the search by Verein (#2989)`.

### B5. PR

PR "Closes #2989", with phone and desktop screenshots on a private claude.ai page linked from the PR.

## Ticket C: "Über mein Kind" ([#2990](https://github.com/WolfSoko/wol-sok-mono/issues/2990))

### C1. The Kind flow

- `src/app/search/child-path.ts`: a pure view model `childPathStep(followed, lastGame)` → `'pick-team' | 'mark' | 'not-played-yet'`, with the last played Spiel from `zuletztGespielt` (`src/app/ueberblick/kader-suche.ts`, moved into the lib by PR #2954 if that lands first) over the Team's Saison (`teamSaisonResource`).
- The way in "Über mein Kind" opens the same club search with `?fuer=kind`; on the Verein's page each Team offers "Mein Kind spielt hier": it follows the Team (`TeamFolgenComponent`'s action) and goes to `/suchen/kind/:teamId`, which shows the Kader of that Team's last played Spiel through the existing Spiel page parts with "Als mein Kind markieren" (`src/app/kind/`), or the hint "after the first Spiel" where none was played.
- Breadcrumb `Suchen › <Verein> › Kind markieren`.
- Tests: `child-path.spec.ts` (each step), component specs (follow then mark, no Spiel, an Anonymer Spieler not markable), no search by name anywhere (the page has no text input).
- Commit: `feat(korbjaeger): find the Kind through the Verein and mark them in the Kader (#2990)`.

### C2. E2E and docs

- `e2e/suche.spec.ts`: "Über mein Kind" → Verein → Team → mark a named player from the fixture → the overview groups by that Kind.
- CLAUDE.md, Korbjäger section: the Kind flow.
- Commit: `test(korbjaeger): e2e for the Kind flow (#2990)`.

### C3. PR

PR "Closes #2990, closes #2958", screenshots as in B5.

## Risks

- The DBB's club search may not exist or may return contact persons: A1 is a gate, and A2 maps only id, name and Verband.
- The renaming of #2967 may land meanwhile: take the names from `main` at each ticket's start.
- A day of CDN cache means a newly registered club shows up a day late; acceptable for club names.
