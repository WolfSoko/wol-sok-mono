# 18. Korbjäger reads the DBB's undocumented API through an allowlisted, caching proxy

- Status: accepted
- Date: 2026-11-08
- Scope: `libs/features/basketball-data` (`feat-shared-basketball-data`),
  the coming Korbjäger app and its proxy routes
- Issue: [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861);
  terms as in the glossary of
  [#2860](https://github.com/WolfSoko/wol-sok-mono/pull/2860)

## Context

The basketball parents app (working title Korbjäger) shows the Spiele,
results, Tabellen and Kader of youth Teams. The only source for them is the
German Basketball Federation (DBB): basketball-bund.net, whose own pages
read a JSON API under `https://www.basketball-bund.net/rest`. The API is
undocumented and nobody promised it to us.

What the API does, probed on 2026-11-08:

- It sends no CORS headers, so a browser on another origin cannot call it.
- It answers HTTP 200 even when a read fails; an envelope's `status` says
  what happened (`"0"` ok, `"1"` not found, `"-1"` server error). A
  non-numeric id gets HTTP 400 with an empty body.
- Responses pass through Varnish with `max-age` 120 to 300 s; data can be
  about ten minutes old. No rate limiting was seen.
- The Liga search is a `POST` with a JSON filter body, and its first call
  ignores the start index: later pages need a call of their own.
- Eight reads cover the app: `wam/data`, `wam/liga/list`,
  `competition/table`, `competition/spielplan`, `team/.../matches`,
  `club/.../actualmatches`, `match/.../matchInfo` and `match/.../boxscore`.

The owner will ask the DBB for permission before the app goes public. Until
then the app must be a guest the DBB barely notices, and switching to an
official source, should one come, must not touch the screens.

## Decision

**The screens read basketball data through one port, `BasketballData`**
(`libs/features/basketball-data`), in domain types and with three typed
errors (`not-found`, `unavailable`, `unexpected-shape`). The lib is Node
only, so the browser and the proxy share it. `DbbBasketballData` is the one
adapter: it maps the DBB's JSON, reads the envelope's `status`, and checks
every field it reads with small hand-written guards, so a change in the
DBB's JSON fails loudly as `unexpected-shape` rather than showing wrong
data.

**The adapter knows no HTTP.** It hands each read as a `DbbRequest` (one of
the eight allowlisted kinds, with its ids) to an injected `DbbTransport`.
`dbbHttpRequest` is the single place that turns a `DbbRequest` into the
DBB's method, path and body, and it refuses ids that are no positive
integers. The app's transport sends the request to its own proxy; tools
send it to the DBB directly.

**The proxy is narrow and caches.** It runs as Nitro server routes of the
app under `/api/dbb/`, one route per allowlisted read, with numeric ids
validated and 404 for every other path. The Liga search is a `GET` on the
proxy, its filter in the query string, so the CDN can cache it. It answers
with `Cache-Control: public, max-age=60, s-maxage=300` (the boxscore of a
finished Spiel, which rarely changes, `s-maxage=3600`: one whose result the
Verband has confirmed, with both Kader listed, as the boxscore body itself
says; an unconfirmed one keeps the short cache, since its Kader and
Spielerwerte may still change), so Firebase
Hosting's CDN serves repeats and the DBB sees at most one request per
resource every few minutes, however many parents watch. It calls the DBB
with a timeout, a User-Agent that names the app and its URL, and no
cookies either way; DBB `status: "1"` becomes 404, a timeout, a 5xx or
`status: "-1"` a 502 that is not cached. It passes the DBB's body through
unchanged: the mapping stays in the adapter, where it is tested without
HTTP.

## Consequences

- An official DBB source, or any other, is a second adapter of
  `BasketballData`; the screens and the proxy's allowlist stay.
- A DBB change in shape breaks the reads it touches with a typed error
  naming the field's path. The fixtures under
  `src/lib/dbb/fixtures/` are re-recorded with
  `tools/korbjaeger/record-fixtures.ts` and anonymised (ADR 0019) to pick
  the change up.
- Schedules, results and Tabellen can be up to about fifteen minutes old
  (the DBB's own caching plus the proxy's five minutes). The Kader and
  Spielerwerte of a finished Spiel can be about an hour plus the DBB's
  caching old, so a correction the Verband makes after the Spiel shows up
  that late. The app's source note says both.
- The DBB marks things only implicitly, and the adapter follows what the
  responses show: a forfeit is `verzicht` on the Spiel and the Team that
  gave up, a cancellation `abgesagt`, a Hauptrunde slot a team without
  `teamPermanentId`, a moved Spiel just its new date, a roster without
  Spielerwerte all zeros. The fixtures' README lists them.
- If the DBB says no, the app goes offline; nothing else in the workspace
  depends on the API.

## Amendment (2026-11-09): the club index

Issue: [#2988](https://github.com/WolfSoko/wol-sok-mono/issues/2988), part of
[#2958](https://github.com/WolfSoko/wol-sok-mono/issues/2958); owner's
decision in cockpit request 818.

**Probe.** The DBB has no Verein search the app can use: the public SPA
(`/static/`) calls none, the legacy JSP "Vereinssuche" filters one
Verband's Liga list in server-rendered HTML, and `/rest/club/search` is an
unpublished `POST` whose body is unknown (its error, `idList is null`,
points to a lookup by ids). `wam/data` has no Verein facet.

**Decision.** Korbjäger keeps its own index of the Vereine, built only
from reads the allowlist already holds, so the proxy's allowlist stays at
eight reads:

- `clubIndex` in `korbjaeger-functions` (hourly, `europe-west3`) crawls
  one Verband a run: every page of its Ligen (`wam/data`,
  `wam/liga/list`), each Liga's Spielplan (`competition/spielplan`) for its
  Teams' `clubId`, and the name of each Verein it does not know yet
  (`club/.../actualmatches`). It picks the Verband whose list is missing or
  at least a week old, so each is refreshed weekly; it notes when a crawl
  starts, so a Verband whose crawl fails or runs out of time waits a day
  and holds up no other. It calls the DBB as the proxy does (its own
  User-Agent naming the app, no cookies, a timeout), one request at a
  time, a second apart: about 2,600 requests a week once the names are
  known. The first fill reads one name per Verein too (Bayern: about 900
  requests); after 20 minutes of a run a Team's name stands in for a
  Verein's and is read again next week, inside the run's 30 minutes. A
  Liga the DBB does not know or answers in another shape is skipped; any
  other failure writes nothing. Lists of a Verband the DBB no longer
  offers are deleted.
- It stores `clubIndex/{verbandId}` in Firestore: the Verband and its
  Vereine' ids and names only, no persons, no Teams. No rule opens it to
  clients.
- The Nitro function (`europe-central2`) reads it across regions, against
  the rule that a function reading Firestore runs in its region: the CDN
  keeps the answer a day, so that is about one read a day per CDN node,
  and a function of its own behind a Hosting rewrite would have to ship a
  release before its rewrite.
- `GET /api/clubs` (the app's Nitro server) serves every Verband's list
  merged into one, `Cache-Control: public, max-age=3600, s-maxage=86400`;
  any query is 404, so the CDN keeps one answer. The device searches the
  list itself; the typed text never leaves it.

**Consequences.** A new Verein shows up within about a week. A Verein's name is
read once: a renamed Verein keeps its old name in the index for as long as
any list holds it. The DBB sees a steady, small background load besides the
visitors' reads; the permission request (#2963) names it. Should the DBB
offer a club search, it replaces the index behind the same route.
`CLUB_INDEX_ON` in the functions' `src/config.ts` takes the crawl out of a
deploy.
