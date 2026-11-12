# Plan #3017: Korbjäger club index: a DBB outage mid-crawl stores Team names as Verein names

Spec: [docs/specs/3017-korbjaeger-club-index-a-dbb-outage-mid-crawl-stores-team-names-as-verein-names.md](../specs/3017-korbjaeger-club-index-a-dbb-outage-mid-crawl-stores-team-names-as-verein-names.md).

1. **Crawl specs (red).** `libs/features/basketball-data/src/lib/club-index/crawl-clubs.spec.ts`:
   let `fakeData` take the name answers per Verein (a name or an error kind);
   add specs for `unavailable` and `offline` rejecting, and for
   `unexpected-shape` falling back. Run `npx nx test feat-shared-basketball-data`: the two
   rejecting specs fail.
2. **Fix (green).** `crawl-clubs.ts`: `clubName` returns `undefined` only on
   `not-found` and `unexpected-shape` and rethrows everything else; share the
   check with `teamsOf` (`isLastingAnswer`), and update the doc comments of
   `crawlClubs` and `clubName`. Tests green.
3. **Run spec.** `apps/korbjaeger-functions/src/club-index/run-club-index.spec.ts`:
   a run whose name read rejects `unavailable` saves nothing, notes the
   failure and rejects. Run `npx nx test korbjaeger-functions`.
4. **Retry a name read** (condition of merge request 1096). `crawl-clubs.ts`:
   `CLUB_NAME_ATTEMPTS` (3), `clubName` reads again after a failure that may
   pass; specs for a read that recovers and for one that fails every time
   (`crawl-clubs.spec.ts`). Commit `fix(feat-shared-basketball-data): retry a Club's name read before failing the crawl`.
5. **Checks and commit.** `npx nx format:write`, `npx nx affected -t lint,lint-templates,test`;
   one commit `fix(feat-shared-basketball-data): fail the club crawl on a DBB outage instead of storing Team names`
   with spec and plan.
