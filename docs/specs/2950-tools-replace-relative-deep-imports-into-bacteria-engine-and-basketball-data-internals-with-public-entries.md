# Spec: tools import the engine and the basketball data lib through their public entries

Issue: [#2950](https://github.com/WolfSoko/wol-sok-mono/issues/2950). Follows [#2935](https://github.com/WolfSoko/wol-sok-mono/issues/2935) (PR [#2951](https://github.com/WolfSoko/wol-sok-mono/pull/2951), tools lint and typecheck); related to [#2898](https://github.com/WolfSoko/wol-sok-mono/issues/2898) (guard for `/testing` entries) and PR [#2764](https://github.com/WolfSoko/wol-sok-mono/pull/2764) (engine in its own lib).

## Goal

The balance lab (`tools/bacteria-game/balance/`) and the Korbjäger fixture scripts (`tools/korbjaeger/`) import `@wolsok/feat-shared-bacteria-engine` and `@wolsok/feat-shared-basketball-data` through path aliases, never a relative path into a lib's `src/`. The `.oxlintrc.json` override that #2951 adds to allow those relative imports goes away, so `@nx/enforce-module-boundaries` checks the scripts like any other source.

## Non-goals

- Moving the anonymiser out of `basketball-data/src/testing/` or the lab out of `bacteria-engine/src/lib/state/balance/`: the files stay where they are, only their way in changes.
- The `/testing` lint guard itself (#2898).
- Other `tsx` calls of `tools/` scripts that import no `@wolsok/*` path (e.g. `korbjaeger:icons`).

## Today

| Script                             | Imports by relative path                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `balance/run.ts`                   | `state/balance/lab-match` (type `LabMatch`), `state/balance/report` (13 names), `state/levels` (`isBigMap`, `isLadderLevel`, `LEVELS`)                                                     |
| `balance/worker.ts`                | `lab-match` (`LabMatch`, `playLabMatch`), `report` (`NamedCell`)                                                                                                                           |
| `balance/calibrate.ts`             | `report` (`BalanceReport`, `expectedStats`), `bot-controller` (`BOT_DIFFICULTIES`), `difficulty-curve` (`SKILL`, `strengthOf`, `targetWinRate`), `geometry` (`clamp`), `levels` (`LEVELS`) |
| `korbjaeger/record-fixtures.ts`    | `lib/dbb/dbb-request` (`DBB_BASE_URL`, `dbbFetchInput`, `dbbHttpRequest`, `DbbRequest`)                                                                                                    |
| `korbjaeger/fixture-requests.ts`   | `lib/dbb/dbb-request` (`DbbRequest`), `lib/domain/liga-suche` (`KEIN_LIGA_FILTER`, `LigaSucheFilter`)                                                                                      |
| `korbjaeger/anonymise-fixtures.ts` | `testing/anonymise-fixtures` (`anonymiseFixtures`, `survivingPersonData`)                                                                                                                  |
| `korbjaeger/raw-dir.ts`            | `testing/outside-folder` (`isOutsideFolder`)                                                                                                                                               |

The engine's main entry already exports `isBigMap`, `isLadderLevel`, `LEVELS`, `BOT_DIFFICULTIES`, `targetWinRate` and `clamp`; the basketball data lib's main entry exports everything `record-fixtures.ts` and `fixture-requests.ts` take.

## Decisions

1. **Engine: a secondary entry `@wolsok/feat-shared-bacteria-engine/balance`** (`libs/features/bacteria-engine/src/balance.ts`, path in `tsconfig.base.json`) exports the lab: everything `lab-match.ts` and `report.ts` export that the tools use, plus the calibration's `SKILL` and `strengthOf`. Reason: the lab is a tool of the engine's developers, not part of what the game, the functions or the admin take; the main entry stays as it is. Names the main entry already has come from the main entry.
2. **`tools/federation/workspace-federation.js` skips `@wolsok/feat-shared-bacteria-engine/balance`**, next to the engine and its `/testing`, so no shell or remote shares it.
3. **Basketball data: the anonymiser and `isOutsideFolder` join the existing `/testing` entry** (`libs/features/basketball-data/src/testing.ts`) instead of a new entry. Reason: they are fixture tooling, exactly what `/testing` holds (`fakeDbbAnswer` answers from the same fixtures); #2898 already counts `tools/korbjaeger/anonymise-fixtures.ts` as a legitimate consumer of that entry, so its guard exempts `tools/**` rather than a relative path. Neither file imports anything the entry's consumers (Node, jsdom specs) cannot load.
4. **Every `tsx` call of these scripts passes `--tsconfig tools/tsconfig.tools.json`** (it extends `tsconfig.base.json`, so the aliases resolve): the `balance-check` and `balance` targets of `feat-shared-bacteria-engine`, `.github/workflows/bacteria-balance.yml`, the usage lines in the scripts' header comments, the fixtures `README.md` and the game lib's `CLAUDE.md`. tsx hands the path on as `TSX_TSCONFIG_PATH`, so the worker `run.ts` forks with `--import tsx` resolves the aliases too.
5. **The allow override goes once #2951 is on `main`.** This branch starts from `main`, where `tools/` is not linted yet; before the merge it is rebased onto a `main` that holds #2951, and the override (`tools/bacteria-game/balance/**`, `tools/korbjaeger/**`) is deleted there. The merge waits for #2951.

6. **`tools/tsconfig.json` extends `tools/tsconfig.tools.json`.** Type-aware oxlint takes a file's nearest `tsconfig.json`; `tools/` had none, so with the relative imports gone the aliases resolved to nothing and `no-redundant-type-constituents` saw `error` types in `run.ts`. The file holds no options of its own, so `tsconfig.tools.json` stays the one config `typecheck-tools` and `tsx` read.

## Acceptance

1. `grep -rn "libs/features" tools --include=*.ts` finds no import into a lib's `src/`.
2. `.oxlintrc.json` holds no override for `tools/bacteria-game/balance/**` or `tools/korbjaeger/**`, and `npx nx lint tools` (the project #2951 adds) passes.
3. `npx nx run feat-shared-bacteria-engine:balance-check` runs the lab through the new entry, workers included, and passes as on `main`.
4. `npx tsx --tsconfig tools/tsconfig.tools.json tools/bacteria-game/balance/calibrate.ts` and both fixture scripts start (a usage error without arguments, no `ERR_MODULE_NOT_FOUND`).
5. `workspace-federation.js` skips `@wolsok/feat-shared-bacteria-engine/balance`; the federation builds of the shell and the game remote stay green.
6. Specs of `feat-shared-bacteria-engine` and `feat-shared-basketball-data` stay green; `nx affected -t lint,lint-templates,test` passes.

## Open questions

- None for the build. The merge order (after #2951) is decision 5.
