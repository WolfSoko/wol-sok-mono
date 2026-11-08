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
