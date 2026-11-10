# Spec #2997: Korbjäger club index: read a Verein's name without its 56 days of Spiele

Issue: [#2997](https://github.com/WolfSoko/wol-sok-mono/issues/2997), found in
the `/simplify` review of [PR #2995](https://github.com/WolfSoko/wol-sok-mono/pull/2995)
([#2988](https://github.com/WolfSoko/wol-sok-mono/issues/2988)). Related:
[#2963](https://github.com/WolfSoko/wol-sok-mono/issues/2963) (the DBB permission request).

## Goal

`crawlClubs` (`libs/features/basketball-data/src/lib/club-index/crawl-clubs.ts`)
reads each unknown Verein's name through `vereinsTeams`, which asks the DBB for
`club/id/{id}/actualmatches?rangeDays=28` and maps every Spiel of those 56 days
into Teams, only to keep `verein.name`. The first fill does about 2,500 of
these reads. A read of its own asks the same allowlisted path with
`rangeDays=1` and maps only the `club` object.

Probed on 2026-11-10 (Verein 4468): `rangeDays=1` answers 4.9 kB with 4 Spiele,
`rangeDays=28` 41.7 kB with 37 Spiele; both carry the same `club` object
(`vereinId`, `vereinsname`). An unknown id answers `status:"1"` with
`club: null`, as before.

## Non-goals

- No new DBB endpoint and no change to the allowlist (`dbbHttpRequest`):
  `vereins-spiele` already takes `tage` from 1 to `MAX_VEREINS_SPIELE_TAGE`.
- No proxy route and no app read: the app's `KorbjaegerData` picks only the
  reads its proxy serves, so the new read stays out of it.
- No change to `vereinsTeams`, `VEREINS_SPIELE_TAGE` or what the club index
  stores.

## Decisions

- **A port read `club(club: VereinId, options?): Promise<Verein>`** on
  `BasketballData` (CONTEXT.md: Verein's code name is `Club`; the domain type
  `Verein` keeps its name until its own rename, Coding Rule 10). It rejects
  like every read: `not-found` for an unknown Verein, `unexpected-shape`
  where `club` is missing.
- **`DbbBasketballData.club` asks `vereins-spiele` with `tage: CLUB_NAME_DAYS`
  (1)**, the smallest range the allowlist takes, and maps through a new
  `mapClub` (`dbb/map-club.ts`), which reads only `clubMatches.club` with the
  existing `mapVerein`. The Spiele are never mapped, so a Spiel the mapper
  cannot read no longer costs the Verein its name.
- **`crawlClubs` takes a narrower source**, `ClubCrawlSource =
  Pick<BasketballData, 'ligaSuche' | 'ligaSeite' | 'ligaTeams' | 'club'>`:
  it says what a crawl reads, and the specs' fakes drop the reads a crawl
  never makes (cleanup of the touched code). `runClubIndex` still passes its
  `BasketballData`, which satisfies it.
- **ADR 0018's amendment** names `rangeDays=1` for the name read.

## Acceptance

1. `BasketballData` has `club`; `DbbBasketballData.club(id)` sends exactly
   `{ kind: 'vereins-spiele', vereinId: id, tage: 1 }` to the transport and
   resolves `{ id, name }` from a recorded `actualmatches` fixture.
2. `club` rejects `not-found` for the DBB's `status:"1"` answer and for an id
   that is no DBB id, `unexpected-shape` for an answer without `club`.
3. `crawlClubs` reads names only through `club` (its spec's read log shows
   `club <id>`, never `vereinsTeams`), with unchanged results, fallbacks
   (`nameFromTeam`) and pacing.
4. `korbjaeger-functions`' `runClubIndex` spec passes with its fake offering
   `club`.
5. `nx affected -t lint,lint-templates,test,typecheck-specs` is green; the
   app's `KorbjaegerData` and proxy are unchanged.

## Open questions

None.
