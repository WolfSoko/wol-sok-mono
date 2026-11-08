# Korbjäger

The basketball parents app ([#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861)):
the Spiele, results and Tabellen of a youth Team, read from the German
Basketball Federation (DBB). German UI. It will run at
https://korb.wolsok.de (`SITE_URL` in `src/app/site.ts`, the one place
that names the domain); it is not deployed yet.

An Analog app on the Nitro `firebase` preset. Pages render in the browser
only (`ssr: false`); Nitro serves the shell and the DBB proxy.

- **Data:** the screens read `BasketballData` from
  `@wolsok/feat-shared-basketball-data` (`libs/features/basketball-data`),
  provided in `src/app/basketball-data/` with a transport that calls the
  app's own proxy, since the DBB sends no CORS headers.
- **Proxy:** `src/server/routes/api/dbb/` (thin route files) over
  `src/server/dbb/`. Only the reads the lib's `dbbHttpRequest` allowlists
  get a route, with numeric ids; every other path under `/api/dbb/` is 404.
  It passes the DBB's body on unchanged, caches successes
  (`public, max-age=60, s-maxage=300`) and nothing else, turns DBB
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
`313036` plays two Ligen), and the `e2e` build mode points the proxy's
`DBB_BASE_URL` at it. Open `/team/313036`.

## Tests

```sh
npx nx test korbjaeger                       # Vitest: proxy, transport, pages
npx nx run korbjaeger:typecheck-specs
npx nx e2e korbjaeger                        # Playwright, on the fake DBB
```

The proxy specs mount the route handlers in h3 with the DBB faked; the
page specs run against a fake `BasketballData`. The e2e starts `fake-dbb`
and `serve-e2e` as Nx tasks (CLAUDE.md, Testing).
