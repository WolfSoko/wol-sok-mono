# Spec #3017: Korbjäger club index: a DBB outage mid-crawl stores Team names as Verein names

Issue: [#3017](https://github.com/WolfSoko/wol-sok-mono/issues/3017). Found in the
review of [PR #3014](https://github.com/WolfSoko/wol-sok-mono/pull/3014)
([#2997](https://github.com/WolfSoko/wol-sok-mono/issues/2997)). Related:
[#3005](https://github.com/WolfSoko/wol-sok-mono/issues/3005),
[#2988](https://github.com/WolfSoko/wol-sok-mono/issues/2988),
[#2989](https://github.com/WolfSoko/wol-sok-mono/issues/2989).

## Goal

A crawl of the club index (`crawlClubs`,
`libs/features/basketball-data/src/lib/club-index/crawl-clubs.ts`) lets a
Team's name stand in for a Verein's name only where the DBB answers that it
does not know the Verein or answers in a shape the lib cannot read. Where the
DBB cannot be reached or fails (`unavailable`), the crawl of that Verband
rejects: `runClubIndex` then records the failed attempt (`markFailure`) and
keeps the list stored before it, as it already does for a League list or
Teams the DBB cannot deliver.

## Why

`clubName` catches every `BasketballDataError`. During a DBB outage every name
read fails as `unavailable`, so the crawl stores Team-derived names
(`nameFromTeam`) for every Verein not yet known. Since #3005 such a list counts
as complete, so `/api/clubs` serves it with the long cache, and the search
(#2989) shows Team names as Vereine for up to a day.

## Non-goals

- No change to the run's schedule (a failed crawl is due again after a day),
  the store or `/api/clubs`.
- No retry of single name reads within a run.
- `timeForNames` running out keeps letting Team names stand in, as today.

## Decisions

- **Fall back on `not-found` and `unexpected-shape` only**, as `teamsOf` does
  for a League's Teams: both are answers that trying again will not change.
- **`offline` rejects too.** It means "try again once online", like
  `unavailable`; the functions' transport never reports it, but a name that is
  only missing for now must not be stored as a Team's.
- **Fix in the lib, not in the run.** The crawl decides what counts as "no
  name"; the run already handles a rejecting crawl (failure noted, old list
  kept, error rethrown so the log shows it).

## Acceptance

1. A crawl spec where the name read rejects `unavailable` rejects with that
   error and so returns no list with a `nameFromTeam` name.
2. A crawl spec where it rejects `offline` rejects too.
3. `not-found` (existing spec, Verein 300) and `unexpected-shape` (new spec)
   still let the Team's name stand in.
4. A run spec where a name read rejects `unavailable` saves no list, notes the
   failure (`failure 3 unavailable: …`) and rejects.
5. The crawl's doc comment says which failures fall back.

## Open questions

None.
