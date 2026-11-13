# Korbjäger

The basketball parents app ([#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861)):
the Spiele, results and Tabellen of a youth Team, read from the German
Basketball Federation (DBB). German UI. It runs at
https://korb.wolsok.de (`SITE_URL` in `src/shared/site.ts`; the CNAME's
stack keeps its own copy, see Deploy).

An Analog app on the Nitro `firebase` preset. Pages render in the browser
only (`ssr: false`); Nitro serves the shell and the DBB proxy.

- **Data:** the screens read `BasketballData` from
  `@wolsok/feat-shared-basketball-data` (`libs/features/basketball-data`),
  provided in `src/app/basketball-data/` with a transport that calls the
  app's own proxy, since the DBB sends no CORS headers.
- **Team page** (`/team/{id}`, `src/app/team/`): the Team's next Spiel
  with its Halle, the Team's Spiele of the Saison (each opening its Spiel
  page), then one Tabelle per Liga of those Spiele, the Team's own line
  highlighted. The current Liga comes first, by the lib's
  `leaguesCurrentFirst`: the Liga of the Team's next Spiel from today on
  (`TODAY` in `src/app/today.ts`, read again when the page comes back
  into view; specs replace it), or of its last
  Spiel once none is left (a cancelled Spiel decides nothing, a forfeited
  one does); the others follow by their last Spiel, newest first. Each
  Tabelle loads and fails on its own.
  A toggle button ("Team folgen", `aria-pressed`) adds the Team to Meine
  Teams or takes it out (`follow-team.component.ts`).
  Below, "Weitere Teams des Vereins": the Verein's other Teams as its
  Spiele of four weeks either way show them (the lib's `vereinsTeams`,
  `clubTeamsResource`), each with its Ligen, a link to its page and the
  same follow button; `ClubTeamsComponent` (`src/app/club/`) only
  shows the read's stand (it keeps them while a sibling Team of the same
  Verein loads, so that reads the Verein no second time). Once the Team's
  Saison looks over (the lib's `seasonOver`: no Spiel left and the last
  more than two weeks past) a hint (`SeasonOverHintComponent`, shared
  with the overview) says no Spiel is set and asks whether the Saison is
  over, since a break looks the same, and offers these Teams at the top.
- **Spiel page** (`/spiel/{id}`, `src/app/game-page/`): the result, the
  quarter scores (and overtimes) where the Verband records them, what
  became of the Spiel, both Teams linking to their Team pages, the Halle,
  and both Kader of the Spielbericht. Players appear as the DBB shows
  them (shirt number, name), an Anonymer Spieler as "Anonymer Spieler",
  never as a link (ADR 0019). Spielerwerte (points, field goals, free
  throws, fouls) only for a Kader whose `playerStatsRecorded` holds,
  "keine Spielerwerte erfasst" for one without, "Noch kein Spielbericht"
  while there is none. The Spiel and its Spielbericht load and fail on
  their own; the view models are pure (`game-head.ts`,
  `roster-rows.ts`, `game-report-part.ts`).
- **Halle** (`src/app/venue/`): `VenueComponent` shows a Halle with a
  link that opens navigation in a tab of its own (the lib's
  `venueNavigationUrl`); `GameVenueComponent` shows where a Halle's read
  stands (`VenueState`: loading, failed, read) and reads nothing itself.
  Only the next Spiel's details are read (`gameDetailsResource` in
  `src/app/basketball-data/`, beside `teamSeasonResource`): the Team page
  holds its own read, `FollowedTeamsOverview` one per followed Team, and
  `NextGameComponent` (`src/app/game/`) shows the Spiel with its
  Halle on both, so each loads and fails on its own.
- **Meine Teams** (`src/app/auswahl/`): the `Auswahl` port (`AUSWAHL`),
  Meine Teams as a signal (`undefined` until read) with `folgen` and
  `entfolgen`. Its local adapter
  `LocalSelection` keeps them in `localStorage` (`korbjaeger-selection`) as
  `{ version: 3, teams, children, clubColors }` (`selection-document.ts`: ids
  only; English field names since #2966). It reads the document again
  before each write and on the `storage` event, so two tabs keep each
  other's changes, and keeps fields it does not know. Storage that cannot
  be read or holds something else counts as empty, storage that takes
  nothing keeps them for the visit; a document of a newer version is left
  alone and changes are refused (`SelectionTooNewError`, "Bitte die App neu
  laden"). Every adapter runs the shared contract suite
  `selectionContract` (`testing/selection-contract.ts`), the Firestore adapter
  of #2873 too.
- **Overview** (`/`, `src/app/overview/`): each of Meine Teams with its
  next Spiel (day, time, home or away, opponent), the Spiele
  before it that fall through (cancelled or forfeited) and its last result (the lib's `teamOverview`), the Team
  that plays first first and Teams without a next Spiel last
  (`byNextGame`), each linking to its Team page.
  `FollowedTeamsOverview` holds the reads of each followed Team: its Saison
  (`teamSeasonResource`, as the Team page) and, once its next Spiel is
  known, that Spiel's details for the Halle (`gameDetailsResource`), both
  ended when the Team is unfollowed. A card whose Team's Saison looks
  over (`seasonOver`) shows the same hint with its Verein's current
  Teams; only then is the Verein read (`clubTeamsResource`), once per
  Verein however many of its Teams are followed. So each card loads and fails
  on its own and a follow or unfollow reads no other Team again; the cards
  (`overview-team.component.ts`) only show what they are given, and one
  whose read fails offers "Entfernen". Error texts are in
  `src/app/errors/`. Both screens
  show a Spiel through `GameRowComponent` (`src/app/game/`), as a
  link to its Spiel page (`GameLinkComponent` on the cards). While
  Meine Teams is empty it offers "Team suchen" (`/suchen`); once a Team
  is followed, "Weiteres Team suchen" below the cards.
- **Team einrichten** (`/team-einrichten`, `src/app/team-setup/`):
  finds a Team without its id, step by step. A Verband, then an age group
  and a gender, each offering only what the Liga search finds for the
  picks before it (the lib's `offered`; each step a `facetStep`
  shown by `korb-facet-select`, which says so when a step offers
  nothing); then a Liga of the paged list (`leaguePages`: the first page
  with the search, every later one through the DBB's list call,
  "Weitere Ligen", the lib's `nextStartIndex`); then every Team of
  that Liga (`leagueTeamsResource`, the lib's `leagueTeams` from its
  Spielplan), by the DBB's Team name, which carries the Verein's team
  number ("TSV X 2"). One tap follows the Team (`Auswahl.folgen`) and
  opens its Team page. Changing a pick starts over below it.
- **Installable and offline:** `src/public/manifest.webmanifest` (name,
  German, `standalone`, the theme's orange `#e37100`, linked from
  `index.html` with the icons) makes the app installable; its icons
  (`src/public/icons/`, `favicon.ico`) come from
  `npx nx run korbjaeger:icons` (`tools/korbjaeger/generate-icons.ts`, a
  basketball in the theme's orange, maskable): don't draw them by hand.
  Angular's service worker (`ngsw-config.json`, registered by
  `provideAppServiceWorker` in `src/app/pwa/`, production builds only)
  prefetches the shell (`index.html`, the manifest, `assets/*.js` and
  `*.css`, no source maps), so every page opens without a network; it
  answers navigations with the shell except files and `/api/**`
  (`navigationUrls`), and has no data group: it never caches the proxy,
  whose data is the app's own (below) and the CDN's. `build` runs
  `build-app` (Analog, cached) and then, never cached since its result
  hashes `build-app`'s files, copies `ngsw-worker.js` and
  `safety-worker.js` into the Hosting folder and writes `ngsw.json` there
  (`ngsw-config`), from the hashed files of that very build. A worker that
  lost files of its release reloads the page; a new release is taken on
  the next load. Hosting sends the worker's files `no-cache` like the
  shell. `src/pwa/` specs the manifest and the worker's config. The dev
  servers (`serve`, `serve-e2e`) run no worker, so the e2e checks the last
  good data without one.
- **Last good data** (`src/app/basketball-data/`): the browser transport
  keeps the last good answer of a Team's Spiele, a Tabelle, a Spiel's
  match info and a Verein's Spiele by its proxy path
  (`STORABLE_KINDS`, `LocalAnswerCache`, `localStorage` keys
  `korbjaeger-answer:/api/dbb/...` as `{ v: 2, am, art, antwort }`, with
  an index `korbjaeger-answers` of each one's size, time and kind). Each
  is kept without the persons it names (the lib's `dbbWithoutPersons`: a
  match info names top players and referees). Never kept: a Spielbericht
  (its Kader name children, ADR 0019), the wizard's Liga search and Liga
  Teams (browsing them would evict what Meine Teams need), errors, and an
  answer the adapter could not map: the transport only notes an answer in
  the read's `Reading`, and the resource keeps it once the read mapped it.
  A read with a `Reading` that fails as `offline` (fetch throws or the
  proxy does not answer within 8 s, `PROXY_TIMEOUT_MS`; or
  `navigator.onLine` is false, `NoInternetError`, when the proxy is not
  called at all) or `unavailable` (the proxy's 502) is answered from it,
  never a 404 or a cancelled read. An answer older than 7 days
  (`MAX_AGE_MS`) is neither served nor kept; `ANSWER_CACHE`
  (`answer-cache-maintenance.ts`) drops those and answers of kinds no
  longer kept at the start, when the page comes back into view and hourly
  while it stays open. When Meine Teams find the storage full, the
  answers give way (`FREE_STORAGE`) and `LocalSelection` writes once
  more. At most 60 answers and 1,000,000 characters
  (`ANTWORT_GRENZEN`, so Meine Teams always find room): a write beyond
  either evicts the oldest answers first, once the new one is stored (a
  write the storage refuses evicts nothing); a full storage
  (`QuotaExceededError`) evicts the oldest until the write fits; an answer
  that is not kept (too large, or the storage full) drops the older one of
  its path too, and a blocked storage keeps nothing. Writes read the index,
  not the answers; it forgets answers deleted behind its back and is
  rebuilt from them when it cannot be read. The read's options are typed
  (`KorbReadOptions`, `DbbBasketballData<KorbReadOptions>` hands them to
  the transport as they are). Each resource of `basketballDataResource`
  (a `DataResource`) has an `asOf` beside its value, changing with it (a
  value shown while reloading keeps its Stand); `korb-as-of` (`src/app/as-of/`) shows it as "Offline · Stand: vor 2 Std." ("Offline" only where the browser says so, else "Keine Verbindung" or "DBB nicht erreichbar"), aging with `NOW` (`src/app/now.ts`, the screens' one
  clock, read every minute and on visibility changes; `TODAY` is its
  German date). The Team page's head, its "Weitere Teams des Vereins",
  each Tabelle, the Spiel page and each overview card show one Stand, the
  oldest of the reads they show (the next Spiel's Halle included).
- **Errors** (`src/app/errors/`): `errorText` tells the three failures
  apart: no connection ("Kein Internet" where the browser says it is
  offline, else "Keine Verbindung. Internet oder Server nicht
  erreichbar"), the DBB unreachable
  (the proxy's 502, "Der DBB ist gerade nicht erreichbar") and not found
  (the screen's own text, a 404).
- **Proxy:** `src/server/routes/api/dbb/` (thin route files) over
  `src/server/dbb/`; `src/shared/dbb-proxy-routes.ts` maps each read to
  its URL and back, for the transport and the proxy. Only the reads the lib's `dbbHttpRequest` allowlists
  get a route, with numeric ids; every other path under `/api/dbb/` is 404.
  A Verein's Spiele (`/api/dbb/verein/{id}/spiele`) are read for the
  lib's fixed day range (`CLUB_GAMES_DAYS`), never one the client
  names, so each Verein caches under one URL.
  The Liga search is a GET too, its filter in the query
  (`/api/dbb/ligen?verband=7&altersklasse=12&geschlecht=2_1`, a later
  page `/api/dbb/ligen/seite?start=10&...`): the proxy builds the DBB's
  POST body itself and answers an unknown parameter or an id the lib's
  `assertValidDbbRequest` refuses with 404.
  It passes the DBB's body on unchanged, caches successes
  (`public, max-age=60, s-maxage=300`; a finished Spiel's Spielbericht,
  `/api/dbb/spiel/{id}/bericht` with a confirmed result and both Kader, by
  the lib's `dbbBoxscoreFinished` on the body itself, `s-maxage=3600`) and
  sends every error (404, 502) `no-store`, since Hosting would add its
  default `max-age=600` and a browser keep a DBB outage ten minutes; it turns DBB
  `status: "1"` into 404 and a timeout (5 s), a network error, a 5xx or
  `status: "-1"` into 502, and calls the DBB with its own User-Agent and
  no cookies. See [ADR 0018](../../docs/adr/0018-korbjaeger-dbb-data-behind-a-caching-proxy.md).

## No sitemap, on purpose

The app has **no sitemap** and every page carries
`<meta name="robots" content="noindex">` (`index.html`). Don't add one: the
pages show children's Teams and games, the DBB's API is undocumented and
the DBB has not been asked yet ([ADR 0019](../../docs/adr/0019-korbjaeger-privacy-stance.md)).
So CLAUDE.md's sitemap rule does not apply here.

`src/public/robots.txt` deliberately **allows** crawling
(`User-agent: *` with an empty `Disallow:`): a URL that robots.txt blocks
is never fetched, so a crawler would never read its `noindex` and could
still list the bare URL. `src/indexing.spec.ts` keeps both in place.

## Deploy

`npx nx run korbjaeger:deploy` (the `non-cdk` leg of `deploy.yml` on a
release that affects the app, with `FIREBASE_TOKEN`) builds the app and
deploys `firebase.korbjaeger.json` from the workspace root, not the
`firebase.json` Nitro generates here:

- **Firebase project** `korbjaeger`, named only in `.firebaserc` (alias
  `korbjaeger`). The config names no site, so Hosting is the project's
  default site, `korbjaeger.web.app`.
- **Hosting** serves the build's public files; only `/api/**` goes to the
  Nitro function, every other path without a file extension to
  `/index.html`, so pages come from the CDN without a function call. A
  missing file (an old chunk after a release) is a 404, not the shell, and
  every page route and `/index.html` are sent `no-cache` (only those: Hosting's header rules override the function's, so a rule reaching `/api/**` would take the proxy off the CDN). Every response carries
  `X-Robots-Tag: noindex`, from Hosting and, for the proxy, from Nitro's
  route rules too.
- **Function** `server`, region `europe-central2`, at most 10 instances
  (`vite.config.ts`, Nitro's `firebase` options). The deploy first sets
  the cleanup policy of its images in that region (one day): without one,
  the Firebase CLI fails after deploying the function and before
  releasing Hosting.
- **Domain** `korb.wolsok.de`: a CNAME to `<site>.web.app` in the CDK app
  `korbjaeger-cdk` (stack `Korbjaeger`, `cdk` leg of `deploy.yml`). It
  keeps the site as `KORBJAEGER_HOSTING_SITE` and the domain as
  `KORBJAEGER_DOMAIN`, since infra may import no app; its spec keeps them
  equal to `.firebaserc` and `SITE_URL`.
- **Web config** of the project in `src/environments/environment.ts`,
  read by nothing until sign-in (#2873); its spec keeps `projectId` equal
  to `.firebaserc`.

`src/firebase-deploy.spec.ts` keeps the config in shape, including the
`--legacy-peer-deps=false` of the function's install (CLAUDE.md, Cloud
Functions).

## Run it

```sh
npx nx serve korbjaeger                # http://localhost:4302, on the real DBB
npx nx run korbjaeger:fake-dbb         # the fake DBB on http://localhost:4303
npx nx run korbjaeger:serve-e2e        # http://localhost:4304, on the fake DBB
```

`nx serve` reads the real DBB; be a quiet guest. For work that needs no
live data, run `fake-dbb` and `serve-e2e`: the fake DBB
(`e2e/fake-dbb/server.cts`) answers from the lib's anonymised fixtures
(`fakeDbbAnswer` of `@wolsok/feat-shared-basketball-data/testing`; Team
`313036` plays two Ligen, found through `/team-einrichten` as
Niedersachsen, U12, Jugend männlich, the second page of Ligen,
"Regionsvorrunde Nord Braunschweig mu12": a Vorrunde with a Tabelle and a friendly Liga without one; its Spiel `2861436` has a Kader-only Spielbericht, and Spiele `2911141` (quarters, Spielerwerte) and `2843814` (no Spielbericht yet) open at `/spiel/{id}`; its Verein `1837` shows its other Teams), and the `e2e` build mode points the proxy's
runtime config `dbbBaseUrl` at it (`NITRO_DBB_BASE_URL` overrides it at
run time). Open `/team/313036`.

## Tests

```sh
npx nx test korbjaeger                       # Vitest: proxy, transport, pages
npx nx run korbjaeger:typecheck-specs
npx nx e2e korbjaeger                        # Playwright, on the fake DBB
```

The proxy specs mount the real route files in h3 where Nitro's file
routing puts them, with the DBB faked; `e2e/dbb-proxy.spec.ts` checks that
routing on the served app. The page specs run against a fake
`BasketballData` and `LocalSelection` without storage. The e2e starts `fake-dbb`
and `serve-e2e` as Nx tasks (CLAUDE.md, Testing).
