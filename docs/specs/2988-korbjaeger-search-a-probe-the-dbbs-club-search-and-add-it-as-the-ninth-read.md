# Korbjäger search A: a Verein index built from the DBB's Ligen

Issue: [#2988](https://github.com/WolfSoko/wol-sok-mono/issues/2988), part of [#2958](https://github.com/WolfSoko/wol-sok-mono/issues/2958) (ticket A of its spec in PR #2959). Blocks tickets B (`/suchen` "Über den Verein") and C ("Über mein Kind"). Related: ADR 0018 (DBB behind a caching proxy), ADR 0019 (no persons), [#2963](https://github.com/WolfSoko/wol-sok-mono/issues/2963) (DBB permission request).

## Probe result (2026-11-09)

The DBB has no Verein search the app can use ([comment on #2988](https://github.com/WolfSoko/wol-sok-mono/issues/2988#issuecomment-6751108806)):

- The public SPA `/static/` calls only `competition/*`, `match/*`, `wam/data`, `wam/liga/list`, `register-player/*` and `user/lc`.
- The legacy JSP "Vereinssuche" (`index.jsp?Action=100&Verband=<id>`, field `search`) filters one Verband's Liga list in server-rendered HTML.
- `/rest/club/search` exists (POST) but no public page calls it; its body is unknown and its error (`idList is null`) points to a lookup by ids.
- `wam/data` has no Verein facet. It lists 23 Verbände (Landesverbände, Regionalligen, Bundesligen, …) with about 2,400 Ligen in all.

The owner chose the backend index, built in this ticket (cockpit request 818, 2026-11-09).

## Goal

Korbjäger can find a Verein by its name without knowing its Liga: a list of every Verein that plays in a DBB Liga (id, name, the Verbände it plays in), refreshed weekly by a scheduled function, served to the browser by one cached route. Ticket B builds the search screen on it.

## Non-goals

- No search screen, no title bar icon, no browser-side reader of the list (ticket B).
- No persons, no Teams, no contact data in the index (ADR 0019).
- No new DBB read: the crawl uses only reads the lib already allowlists (`ligaSuche`, `ligaSeite`, `ligaTeams`, `vereinsTeams`). The issue's "ninth read" (`club-search` in `dbbHttpRequest`) has no endpoint to call.
- No change to the existing eight reads or their cache times.

## Decisions

1. **The index is built from the Ligen, one Verband at a time.** For a Verband: every page of its Ligen (`ligaSuche` + `ligaSeite` with `verbandIds: [id]`), then each Liga's Teams (`ligaTeams`, the Spielplan read, which also covers Ligen without a Tabelle). Each Team carries its `vereinId`. A Verein's name comes from `vereinsTeams(vereinId)` (its `verein.name`), read only for a Verein the index does not know yet; known names are kept. A Liga whose read fails `not-found` is skipped; any other failure ends the run without writing, so the Verband's previous entry stays.
2. **Pure crawl in the lib, Firestore in the function.** `crawlClubs(data, verband, knownNames, pause)` lives in `feat-shared-basketball-data` (Node only, port only, tested on the recorded fixtures through `fakeDbbAnswer`). The domain types (`ClubIndexEntry`: `{ id, name }`; `VerbandClubs`: `{ verband, clubs, updatedAt }`) and the name matching for ticket B (`clubsMatching(index, term)`: case, diacritics and `ß` folded, every word of the term found in the name) live there too.
3. **A scheduled function in `korbjaeger-functions`** (`clubIndex`, 2nd gen `onSchedule`, hourly, `europe-west3`, `timeoutSeconds: 1800`, `maxInstances: 1`, `retryCount: 0`). Each run lists the Verbände (`ligaSuche` without a filter), picks the one whose document is missing or oldest and older than 7 days, crawls it and writes `clubIndex/{verbandId}`. So every Verband is refreshed weekly, spread over the hours; a first fill takes about a day. It calls the DBB directly (`dbbFetchInput`, the app's User-Agent, no cookies, a timeout), one request at a time with a pause of 1 s between them: about 2,600 requests a week (240 list pages, 2,400 Spielpläne, names of new Vereine only), the largest Verband (Bayern, ~430 requests) in about 8 minutes. Wrapped like the account trigger, its log names no Verein. A switch `CLUB_INDEX_ON` in `src/config.ts` takes it out of a deploy.
4. **Stored per Verband, closed to clients.** `clubIndex/{verbandId}`: `{ version: 1, verband: { id, name }, clubs: [{ id, name }], updatedAt }`, sorted by name; a Verein in several Verbände is listed in each. About 2,500 Vereine in all, well below Firestore's 1 MiB per document. The collection name `CLUB_INDEX_COLLECTION` (`clubIndex`) joins the account lib's names (`feat-shared-korbjaeger-account`), which both the app and the functions import; `firestore.rules` gives clients no access (no rule matches), `src/firestore-collections.spec.ts` checks the name.
5. **One cached route serves the whole list; the search runs on the device.** `GET /api/clubs` (a Nitro route of the app, under Hosting's existing `/api/**` rewrite) reads every `clubIndex` document with `firebase-admin`, merges a Verein listed in several Verbände into one entry (`{ id, name, verbaende: [{ id, name }] }`), sorted by name, and answers it with `Cache-Control: public, max-age=3600, s-maxage=86400` (`PROXY_CACHE_SEKUNDEN.vereinsIndex*`), an error `no-store`; any query parameter 404s. The whole list is about 100 kB (about 30 kB compressed), so the CDN answers nearly every request and Firestore is read about once a day per CDN node. This replaces the issue's `/api/dbb/clubs?q=…`: the typed text never leaves the device (better for privacy than a query sent through the proxy), and the CDN can cache one answer instead of one per term. It is not one of `SPEICHERBARE_ARTEN` (offline the search says it needs the internet, ticket B), and the service worker already leaves `/api` to the network.
6. **Documentation in this PR:** an amendment to ADR 0018 (the probe, the index, its load on the DBB), the privacy policy section 3 (the server's weekly list of Vereine from the DBB's public Ligen, without persons; the search on the device; the cache times from `PROXY_CACHE_SEKUNDEN`), CLAUDE.md's Korbjäger section, and the DBB permission request's wording (#2963 names the crawl: a comment there).

## Acceptance

- [ ] `crawlClubs` lists every Verein of a Verband's Ligen once, with the name from `vereinsTeams` for unknown ones and the known name otherwise; skips a Liga that is `not-found`; rejects on any other failure; pauses between requests (spec on fixtures, a fake clock).
- [ ] `clubsMatching` finds `MTV Wasbüttel` for `wasbuttel`, `Wasbüttel`, `mtv was`; `Post SV Nürnberg` for `nurnberg post`; nothing for an empty term (spec).
- [ ] `clubIndex` picks the missing or oldest Verband older than 7 days, writes its document, and writes nothing when the crawl fails (spec with fakes; an emulator spec for the write).
- [ ] `GET /api/clubs` merges the Verbände's documents into one list by name, sends the cache header, 404s on any query parameter and answers 502 `no-store` when Firestore fails (route spec with a fake reader).
- [ ] Firestore rules refuse a client read and write of `clubIndex/{id}` (emulator spec).
- [ ] The privacy policy names the list, its source, that no search term is sent, and the cache times from `PROXY_CACHE_SEKUNDEN` (its spec).
- [ ] ADR 0018 amended; CLAUDE.md updated; the DBB request #2963 names the crawl.
- [ ] `nx affected -t lint,lint-templates,test,typecheck-specs,build` green; `korbjaeger-functions:test-emulator` and `korbjaeger:test-emulator` green.

## Open questions

1. The first deploy fills the index over about a day; ticket B's screen must say "noch nicht verfügbar" for an empty list. Left to B.
2. If the DBB answers #2963 with an official club search, the index gives way to it (a second source behind the same route).
