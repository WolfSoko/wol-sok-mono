# Korbjäger

The basketball parents app ([#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861)):
the Spiele, results and Tabellen of a youth Team, read from the German
Basketball Federation (DBB). German UI. It will run at
https://korb.wolsok.de (`SITE_URL` in `src/shared/site.ts`, the one place
that names the domain); it is not deployed yet.

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
  `ligenAktuellZuerst`: the Liga of the Team's next Spiel from today on
  (`HEUTE` in `src/app/heute.ts`, read again when the page comes back
  into view; specs replace it), or of its last
  Spiel once none is left (a cancelled Spiel decides nothing, a forfeited
  one does); the others follow by their last Spiel, newest first. Each
  Tabelle loads and fails on its own.
  A toggle button ("Team folgen", `aria-pressed`) adds the Team to Meine
  Teams or takes it out (`team-folgen.component.ts`).
- **Spiel page** (`/spiel/{id}`, `src/app/spiel-seite/`): the result, the
  quarter scores (and overtimes) where the Verband records them, what
  became of the Spiel, both Teams linking to their Team pages, the Halle,
  and both Kader of the Spielbericht. Players appear as the DBB shows
  them (shirt number, name), an Anonymer Spieler as "Anonymer Spieler",
  never as a link (ADR 0019). Spielerwerte (points, field goals, free
  throws, fouls) only for a Kader whose `spielerwerteErfasst` holds,
  "keine Spielerwerte erfasst" for one without, "Noch kein Spielbericht"
  while there is none. The Spiel and its Spielbericht load and fail on
  their own; the view models are pure (`spiel-kopf.ts`,
  `kader-zeilen.ts`, `spielbericht-teil.ts`).
- **Halle** (`src/app/halle/`): `HalleComponent` shows a Halle with a
  link that opens navigation in a tab of its own (the lib's
  `halleNavigationUrl`); `SpielHalleComponent` reads it from one Spiel's
  match info. Only the next Spiel's is read, by `NaechstesSpielComponent`
  (`src/app/spiel/`) on the Team page and on each overview card, so each
  loads and fails on its own.
- **Meine Teams** (`src/app/auswahl/`): the `Auswahl` port (`AUSWAHL`),
  Meine Teams as a signal (`undefined` until read) with `folgen` and
  `entfolgen`. Its local adapter
  `LokaleAuswahl` keeps them in `localStorage` (`korbjaeger-auswahl`) as
  `{ version: 1, teams: [...] }` (`auswahl-dokument.ts`: ids only, Kinder
  join version 1 as a field of their own, #2872). It reads the document again
  before each write and on the `storage` event, so two tabs keep each
  other's changes, and keeps fields it does not know. Storage that cannot
  be read or holds something else counts as empty, storage that takes
  nothing keeps them for the visit; a document of a newer version is left
  alone and changes are refused (`AuswahlZuNeuError`, "Bitte die App neu
  laden"). Every adapter runs the shared contract suite
  `auswahlVertrag` (`testing/auswahl-vertrag.ts`), the Firestore adapter
  of #2873 too.
- **Overview** (`/`, `src/app/ueberblick/`): each of Meine Teams with its
  next Spiel (day, time, home or away, opponent), the Spiele
  before it that fall through (cancelled or forfeited) and its last result (the lib's `teamUeberblick`), the Team
  that plays first first and Teams without a next Spiel last
  (`nachNaechstemSpiel`), each linking to its Team page.
  `MeineTeamsUeberblick` holds one read per followed Team
  (`teamSaisonResource`, as the Team page), so each card loads and fails
  on its own and a follow or unfollow reads no other Team again; the cards
  (`ueberblick-team.component.ts`) only show what they are given, and one
  whose read fails offers "Entfernen". Error texts are in
  `src/app/fehler/`. Both screens
  show a Spiel through `SpielZeileComponent` (`src/app/spiel/`), as a
  link to its Spiel page (`SpielLinkComponent` on the cards). The
  Team-id form below opens a Team to follow.
- **Proxy:** `src/server/routes/api/dbb/` (thin route files) over
  `src/server/dbb/`; `src/shared/dbb-proxy-routes.ts` maps each read to
  its route and back, for the transport and the proxy. Only the reads the lib's `dbbHttpRequest` allowlists
  get a route, with numeric ids; every other path under `/api/dbb/` is 404.
  It passes the DBB's body on unchanged, caches successes
  (`public, max-age=60, s-maxage=300`; a finished Spiel's Spielbericht,
  `/api/dbb/spiel/{id}/bericht` with a confirmed result and both Kader, by
  the lib's `dbbBoxscoreFinished` on the body itself, `s-maxage=3600`) and nothing else, turns DBB
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
`313036` plays two Ligen, a Vorrunde with a Tabelle and a friendly Liga without one; its Spiel `2861436` has a Kader-only Spielbericht, and Spiele `2911141` (quarters, Spielerwerte) and `2843814` (no Spielbericht yet) open at `/spiel/{id}`), and the `e2e` build mode points the proxy's
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
`BasketballData` and `LokaleAuswahl` without storage. The e2e starts `fake-dbb`
and `serve-e2e` as Nx tasks (CLAUDE.md, Testing).
