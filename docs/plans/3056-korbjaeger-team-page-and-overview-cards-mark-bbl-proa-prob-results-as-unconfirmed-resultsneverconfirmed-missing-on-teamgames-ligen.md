# Plan #3056: Korbjäger — Team page and overview cards mark BBL/ProA/ProB results as unconfirmed

Spec: [`docs/specs/3056-korbjaeger-team-page-and-overview-cards-mark-bbl-proa-prob-results-as-unconfirmed-resultsneverconfirmed-missing-on-teamgames-ligen.md`](../specs/3056-korbjaeger-team-page-and-overview-cards-mark-bbl-proa-prob-results-as-unconfirmed-resultsneverconfirmed-missing-on-teamgames-ligen.md). Test first, each task red before green.

Tasks 1–3 landed as one commit (squash-merged anyway); a review round added `recordedDbbTransport` to the lib's `/testing`.

1. **Record the BBL Team's Spiele.** `tools/korbjaeger/fixture-requests.ts`: a row `team-163073-matches` (`team-games`, Team 163073). Record only it into a raw folder outside the workspace, anonymise only it, add its row to the fixtures' `README.md`. `committed-fixtures.spec.ts` and `fixture-persons.spec.ts` stay green.
   Commit: `test(feat-shared-basketball-data): record a BBL Team's Spiele`.
2. **Rule in the adapter.** `libs/features/basketball-data/src/lib/dbb/map-league.ts`: `resultsNeverConfirmed` from Verband 100, „männlich" and `akName` „Senioren" (constant `SENIOR_AGE_GROUP`), no longer tied to `withoutGameReports`. `domain/league.ts`: the flag's doc. Tests first: `map-team-games.spec.ts` on both recorded Team answers (acceptance 1); the existing `map-game-details` cases rewritten for acceptance 2 (NBBL, DBBL-Pokal, other Verband, `statisticType` 1 and null); one case on the Verein's Spiele or Liga search (acceptance 3).
   Commit: `fix(feat-shared-basketball-data): mark BBL, ProA and ProB Ligen as never confirmed on every endpoint`.
3. **App spec on the recorded answer.** `apps/korbjaeger/src/app/spiel/spiel-zeile.spec.ts` (or the nearest existing spec of `spielZeile`): the BBL Team's Saison through `mapTeamGames` gives no `vorlaeufig`, Team 313036's unconfirmed Spiel does (acceptance 4). `team/team.component.spec.ts` keeps its hand-made BBL Liga on purpose: it tests how the Team page renders the flag, while this spec covers the recorded path (its `withoutGameReports`, which a Team's Spiele never carry, goes).
   Commit: `test(korbjaeger): pin the never-confirmed mark on a recorded BBL Saison`.
4. **Checks.** `npx nx test feat-shared-basketball-data`, `npx nx test korbjaeger`, `npx nx affected -t lint,lint-templates,typecheck-specs`, `npx nx format:write`, `npx nx build korbjaeger`.
5. **PR** to `main` with spec, plan and code, `Closes #3056`, acceptance results in the description; review by a fresh subagent; merge request; live check of acceptance 7 after the deploy.
