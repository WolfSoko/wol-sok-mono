# Spec: Korbjäger — does the DBB offer a live data source, and would it agree to its use?

Issue: [#2947](https://github.com/WolfSoko/wol-sok-mono/issues/2947). Part of [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861); related to [ADR 0018](../adr/0018-korbjaeger-dbb-data-behind-a-caching-proxy.md) and [#2948](https://github.com/WolfSoko/wol-sok-mono/issues/2948).

A spike: findings and a recommendation, no build.

## Findings (2026-11-09)

### 1. Is there a live source, and for which leagues?

**basketball-bund.net has no live source.** Its own SPA (`/static/`, AngularJS, `scripts.6a95c5c3.js`) knows these match routes: `spielinfo`, `boxscore` and `playbyplay` (`/rest/match/id/{id}/playbyplay`), and none that polls, streams or refreshes: no `$interval` on a match page, no WebSocket, no ticker. The app reads the first two today; the third is the only one it does not.

`match/id/{id}/playbyplay` answers like `matchInfo` (envelope, `ligaData`, the game) plus `playByPlay` and `hasPlayByPlay`. Its controller shows a FIBA report (`playByPlay.report`, JSON from `sport.dbb.external.fiba.report.FibaReport`) and a PDF link, split into periods: a report uploaded **after** the game, not a feed. Probed for 15 played games:

| Liga (`ligaData.statisticType`)               | Games | `hasPlayByPlay` | `playByPlay` |
| --------------------------------------------- | ----- | --------------- | ------------ |
| 1. Bundesliga (Toyota DBBL), 1                | 6     | `false`         | `null`       |
| 1. Bundesliga (easyCredit BBL), 0             | 5     | `false`         | `null`       |
| NBBL A Nord, 1                                | 1     | `false`         | `null`       |
| Youth Bezirks- and Regionsligen (fixtures), 1 | 3     | `false`         | `null`       |

So even the leagues with full Spielberichte have no play-by-play at the DBB this season. The game's result and Spielbericht reach TeamSL once the scorer uploads them after the game (the [Bavarian circular on the digital scoresheet](https://basketballverband-bayern.de/wp-content/uploads/2023/05/Rundschreiben-DSS.pdf): result and report as PDF go into TeamSL after the game); nothing reaches the DBB's API during the game. The DBB's Varnish adds up to five minutes on top (ADR 0018).

**The live source is NBN23's, not the DBB's site.** Since 2021/22 the DBB runs a digital scoresheet (DSS, „Digitaler Spielberichtsbogen") from the Spanish company NBN23 (NOTHINGBUTNET S.L.); scorers record the game in NBN23's „InGame" app ([NBN23, 2021](https://nbn23.com/the-future-is-digital-in-german-basketball/)). Its live view is the app **DBB.Scores** (published by NBN23, `com.nbn23.germanapp`, [App Store](https://apps.apple.com/us/app/-/id1592686052)): live score, box score, play-by-play, shot charts and push notifications, „from youth to amateur level", from the DBB's digital game report system.

- Which leagues: wherever the organiser (the Verband of each Liga) makes the DSS mandatory or allows it, and the scorer's tablet is online during the game. The DBB's implementing rules of 2025 ([DSS-Durchführungsbestimmungen](https://basketballverband-bayern.de/wp-content/uploads/2025/04/2025-04-DSS-Durchfuehrungsbestimmungen-1.pdf), approved by the DBB Presidium on 29 March 2025) leave the decision per Liga to the organiser. No list of covered Ligen is published; it started with WNBL, 1. and 2. DBBL and one Regionalliga (2021) and has been rolled out to the Landesverbände since (Bavaria: released for all clubs from 2023/24).
- How it is reached: only through NBN23's apps. There is no public or documented API; the app's backend is NBN23's, behind its own accounts. Reading it would mean reverse-engineering a private app's backend, which this spike did not do.
- The men's professional leagues (BBL, ProA, ProB, `statisticType: 0`) keep their statistics in their own systems, as [#2948](https://github.com/WolfSoko/wol-sok-mono/issues/2948) found; that is outside ADR 0018's single source anyway.

### 2. What would the DBB allow?

Nothing is published. basketball-bund.net has no terms of use for its API and no robots or rate rules; no rate limiting was seen (ADR 0018). The DBB's legal notice ([Impressum](https://www.basketball-bund.de/impressum/)) reserves the usual: „Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers." So any use beyond today's — and live data most of all — needs written permission:

- **from the DBB** for the data of its Ligen (it already holds the consents for publishing player statistics on DBB.Scores and basketball-bund.net, e.g. the WNBL forms), and
- **from NBN23** for its live feed, which it sells as part of its own app (with in-app purchases and advertising); a live view in Korbjäger would compete with it.

The owner's planned request to the DBB (ADR 0018: before the app goes public) is the place to ask. No request rate is known; whatever the DBB names goes into the proxy's cache times.

### 3. What would the app need?

**From the DBB's REST API (a ninth read, `playbyplay`):** nothing live to gain. It would bring the after-the-game FIBA report where one exists, which today is nowhere sampled. Not worth a read until the DBB fills it.

**From a live source (NBN23 or a future DBB feed), only with permission:**

- A second adapter (ADR 0018: an official source is a second adapter of `BasketballData`), or a new port for live state (`LiveSpiel`: score, period, clock, last actions), since `BasketballData` holds no live state today. The screens would poll the app's proxy, never the source.
- **Never an uncached proxy path.** An uncached path multiplies the source's load by every parent watching. A short shared cache instead: `s-maxage` of 15 to 30 s on the live route (browser `max-age` at most as long), so the CDN collapses every viewer of a game into one request per period. Hosting's CDN already does that for today's routes.
- Load on the source with a 30 s cache: at most two requests a minute per live game, however many viewers; a youth game takes about 90 minutes from tip-off to the end, so about 180 requests per game and route. A Saturday with every followed Team's game live stays in the hundreds of requests an hour. With 15 s, double that.
- The privacy policy (ADR 0019) would gain the live source as a recipient or source; play-by-play names players per action, so the same `dbbOhnePersonen` care as for Spielberichte applies, and no live answer would be kept offline.

## Goal

The owner can decide whether to pursue live data in Korbjäger, knowing what exists, whom to ask and what it would cost.

## Non-goals

- Building anything: no ninth read, no live route, no port.
- Reverse-engineering NBN23's app backend.
- The professional leagues' own live systems (BBL, ProA, ProB).

## Decisions

| Decision                                                                                                                                           | Reason                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recommendation: do not build live data now.**                                                                                                    | The DBB's API has no live data (its play-by-play read is empty everywhere sampled); the one live source, NBN23's DBB.Scores, has no public API and is NBN23's product. Without written permission from both, building it would break ADR 0018's „a guest the DBB barely notices". |
| Ask about live data in the owner's permission request to the DBB, and whether NBN23's feed may be used (or a deep link into DBB.Scores per Spiel). | One letter covers both; the answer decides whether a live adapter is ever possible.                                                                                                                                                                                               |
| No ninth read for `playbyplay` now.                                                                                                                | It returns `null` for every game sampled, including DBBL and NBBL; a read that brings nothing costs a route, specs and fixtures. Revisit once the DBB fills it.                                                                                                                   |
| Should a live source be allowed: a short shared cache (15 to 30 s `s-maxage`), never an uncached path.                                             | Keeps the source's load per game independent of the number of viewers.                                                                                                                                                                                                            |

## Acceptance

1. The spec answers the issue's three questions (source and leagues; what the DBB would allow; what the app would need) with sources.
2. It gives a recommendation whether to build.
3. Nothing is built; `nx format:check` passes on the docs.

## Open questions

- Does DBB.Scores offer per-game links (a web page or app deep link) Korbjäger could link to from a Spiel page? Then a live view would be a link, not data, and would need no feed. To check on a device with the app, or ask NBN23.
- Which Ligen of the Teams parents follow use the DSS online during the game? Only the Landesverbände or NBN23 know.
