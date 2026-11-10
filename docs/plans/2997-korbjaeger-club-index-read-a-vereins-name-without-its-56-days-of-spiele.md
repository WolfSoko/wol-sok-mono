# Plan #2997: Korbjäger club index: read a Verein's name without its 56 days of Spiele

Spec: [docs/specs/2997-korbjaeger-club-index-read-a-vereins-name-without-its-56-days-of-spiele.md](../specs/2997-korbjaeger-club-index-read-a-vereins-name-without-its-56-days-of-spiele.md).
Test first in each task; before each commit `npx nx format:write` and
`npx nx affected -t lint,lint-templates`.

1. **The DBB read.** `libs/features/basketball-data/src/lib/dbb/map-club.ts`
   (`mapClub`) with `map-club.spec.ts` (a recorded `club-*-actualmatches.json`
   fixture, an answer without `club`); `club` on `BasketballData`
   (`basketball-data.ts`) and `DbbBasketballData` with `CLUB_NAME_DAYS`
   (`dbb-basketball-data.ts`), specs in `dbb-basketball-data.spec.ts`
   (request sent, name mapped, `not-found`, non-DBB id). Export from the
   lib's `index.ts` where the other constants are.
   Commit: `feat(feat-shared-basketball-data): read a Verein's name alone (club)`.
2. **The crawl uses it.** `ClubCrawlSource` and `clubName` through `club` in
   `club-index/crawl-clubs.ts`; `crawl-clubs.spec.ts` fakes only the four
   reads and logs `club <id>`; `apps/korbjaeger-functions/src/club-index/run-club-index.spec.ts`
   fake gets `club`. Commit: `perf(feat-shared-basketball-data): crawl club names with a one-day read`.
3. **Docs.** ADR 0018 amendment names `rangeDays=1`. Same commit as 2 or
   its own `docs` commit under the lib's scope.
4. **Checks.** `npx nx affected -t test,typecheck-specs,lint,lint-templates`;
   open the PR (`Closes #2997`), review, test list in the PR body.
