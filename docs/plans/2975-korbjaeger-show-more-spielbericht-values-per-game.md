# Plan #2975: Korbjäger: show more Spielbericht values per game

Spec: [docs/specs/2975-korbjaeger-show-more-spielbericht-values-per-game.md](../specs/2975-korbjaeger-show-more-spielbericht-values-per-game.md).
Branch `claude/epic-allen-1olwzh`, one PR to `main`. Each task is test
first; before each commit `npx nx format:write` and
`npx nx affected -t lint,lint-templates`.

## 1. A fixture with every Spielerwert filled

- `tools/korbjaeger/fixture-requests.ts`: entry `boxscore-2861555`
  (`game-report`, Spiel 2861555, 1. Regionalliga Herren).
- `tools/korbjaeger/anonymise-fixtures.ts`: optional fixture names after
  the raw dir, as `record-fixtures.ts` takes them; only those are read and
  written (the survival check runs on them).
- Record and anonymise only that fixture into a raw dir outside the
  workspace; commit `libs/features/basketball-data/src/lib/dbb/fixtures/boxscore-2861555.json`
  and its README row.
- Tests: `committed-fixtures.spec.ts` (invented names) and `npx nx test
  tools` stay green; `typecheck-tools`.
- Commit: `test(feat-shared-basketball-data): record a Spielbericht with every Spielerwert filled`.

## 2. The lib maps every Spielerwert

- `domain/game-report.ts`: `Shots`, the new `PlayerStats` fields,
  `fieldGoals` returning `Shots`.
- `dbb/map-game-report.ts`: map `esz`, attempts, `rt`, `as`, `st`, `to`,
  `bs`, `eff`, `isf`; `hasStats` counts every value.
- `domain/recorded-stats.ts` (exported from `src/index.ts`):
  `recordedStats(roster)`.
- Specs first: `map-game-report.spec.ts` (new fixture, youth fixture with
  zeros), `game-report.spec.ts` (`fieldGoals`), `recorded-stats.spec.ts`
  (both fixtures, one non-zero player, no Spielerwerte).
- Callers adapt in the same commit (`kader-zeilen.ts` reads
  `fieldGoals(...).made`, the app's specs' fakes).
- Commit: `feat(feat-shared-basketball-data): map every Spielerwert of a Spielbericht`.

## 3. The Kader table shows what a Kader records

- `apps/korbjaeger/src/app/spiel-seite/kader-zeilen.ts`: `PlayerStatsRow`
  (English fields, shots as text), `playingTime(seconds)`, the starting
  five on the row.
- `kader-spalten.ts`: the columns of a Kader from `playerStatsRecorded`
  and `recordedStats`, in the spec's order (pure, specced).
- `kader.component.ts|html|scss`: the new column definitions with German
  `aria-label`/`title`, the "Start" label, the sticky name column.
- Specs first: `kader-zeilen.spec.ts`, `kader-spalten.spec.ts`,
  `kader.component.spec.ts` (or `spiel.component.spec.ts`, where the Kader
  is rendered today) for the youth and the full case.
- `CONTEXT.md`: the Spielerwerte entry lists the values.
- Commit: `feat(korbjaeger): show every Spielerwert the DBB records for a Kader`.

## 4. Check

- `npx nx run-many -t test,lint,lint-templates,typecheck-specs -p korbjaeger feat-shared-basketball-data tools`.
- `npx nx run korbjaeger:e2e` (or its affected specs) for the existing
  Spiel page flows.
- A screenshot at 360 px of the full Kader through Playwright against the
  fake DBB, for the PR.
