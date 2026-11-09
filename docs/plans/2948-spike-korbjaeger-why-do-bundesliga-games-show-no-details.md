# Plan: Korbjäger — why Bundesliga games show no details

Spec: [`docs/specs/2948-spike-korbjaeger-why-do-bundesliga-games-show-no-details.md`](../specs/2948-spike-korbjaeger-why-do-bundesliga-games-show-no-details.md). Test first, one commit for the change (small), spec and plan in a commit before it.

1. **Docs.** Spec and plan. Commit `docs(korbjaeger): spec and plan for Ligen without Spielberichte`.
2. **Lib.** `libs/features/basketball-data/src/lib/domain/liga.ts`: `ohneSpielberichte?: true` with its doc; `dbb/map-liga.ts` sets it from `ligaData.optionalNumber('statisticType') === 0`. Tests first: `dbb/map-spiel-details.spec.ts` (fixtures `matchinfo-2930311.json`, `matchinfo-2843814.json`) and a `map-liga` case for `null` and a missing field.
3. **Spiel page.** `apps/korbjaeger/src/app/spiel-seite/spielbericht-teil.ts`: `fehltText` takes the Liga's flag, cancelled first. Tests first in `spiel.component.spec.ts`: new text for such a Liga, old text otherwise, cancelled text wins, an arriving Spielbericht shows.
4. **Checks.** `npx nx test feat-shared-basketball-data`, `npx nx test korbjaeger`, `npx nx affected -t lint,lint-templates`, `npx nx format:write`, `npx nx build korbjaeger`.
5. **Commit** `fix(korbjaeger): say when the DBB keeps no Spielberichte for a Liga`, PR with `Closes #2948`.
