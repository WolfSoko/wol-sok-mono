# Bacteria engine: the UI texts out of the engine

Issue: [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103)

## Goal

`feat-shared-bacteria-engine` holds the game's UI texts (`src/lib/i18n/en/`, `de/`, 3,183 lines in 21 areas a language) next to the deterministic simulation. Every copy edit therefore reruns the engine's `perf` gate, its golden specs and `engine-bundle.spec.ts`, and redeploys `bacteria-wars-functions` (`--force`), although no function shows these texts.

This change is step 1 of the issue: the texts the engine does not render leave the engine, so a change to one of them affects neither `feat-shared-bacteria-engine` nor `bacteria-wars-functions`.

## Non-goals

- Steps 2 to 4 of the issue (folders by concern in `state/`, the `/cloud` entry, narrower `perf` inputs). They follow as later PRs of [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103) (see Decided questions).
- No change to a text, a key path or what a screen shows.
- No change to what the simulation computes: no `BALANCE_VERSION` bump, goldens unchanged.
- The public replay pages' texts (`apps/bacteria-wars-functions/src/site/`) and the admin's own dictionaries stay as they are.

## What the code shows

- The engine **renders English at runtime**: `english()` (`i18n/game-text.ts`) fills `Achievement.name`/`condition`, `GameMap.name` of a generated level, `XpPart.label`, `ONLINE_LOCKS`, `ladderLocks`, the medallion and win-condition hints and the unlock locks, from the dictionary `EN`. The keys it builds come from four areas only: `achievements`, `game`, `levels` and `training` (457 of the 1,593 English lines).
- The game builds `GameText`s of its own with keys of other areas (`boards`, `online`, `settings`, `newGame`, …), so `GameText.key` cannot simply narrow to the engine's keys.
- Module boundaries (`.oxlintrc.json`): `feat-shared` may depend only on `shared`, `utils`, `api`; the game (`feature:lazy`) only on `feat-shared`, `shared`, `utils`, `api`. A new `feat-shared` texts lib could therefore not import the engine's English areas or its `Translation` type, and a `feature` texts lib could not be imported by the game.

## Decisions

1. **The engine keeps the English texts it renders, nothing else.** `en/achievements.ts`, `en/game.ts`, `en/levels.ts`, `en/training.ts` stay in the engine as `ENGINE_EN` (`i18n/engine-texts.ts`) with `EngineTextKey = EntryPath<typeof ENGINE_EN>`; `english()` renders from it. Reason: the engine stores these strings in its state (a generated level's map name, an achievement's name), so they are engine output; moving them out would mean changing every consumer of those fields first (about 110 lines in the game), a larger change better made on its own if wanted.
2. **All other texts move into the game lib**, `libs/features/lazy/bacteria-game/src/lib/i18n/texts/`: the 17 other English areas, all 21 German areas (the German ones of the engine's four areas typed `Translation<typeof …>` against the engine's English, so a missing or extra German key still fails to compile), and `dictionaries.ts` with `EN` (the engine's four areas plus the game's), `DE`, `DICTIONARIES` and `TranslationKey`. Reason: the game is their only consumer (the admin takes `TranslationKey` through the game's `admin-kit`), it already depends on the engine, and it needs no new tag rule. The issue's own lib (`feat-shared-bacteria-texts`) would need either `feat-shared → feat-shared` or a new tag allowed for `feature:lazy`, plus a federation skip in all four apps, for no consumer beyond the game.
3. **`GameText` becomes generic over its key**: `GameText<K extends string = EngineTextKey>`, `Translate<K>` and `renderGameText<K>` likewise; `english()` takes the engine's `GameText` only. The game defines its `GameText` as `GameText<TranslationKey>` from `i18n/game-texts.ts`, its existing text module, and its files import it from there. An engine `GameText` is assignable to the game's, since `EngineTextKey` is a subset of `TranslationKey`, so the key check stays at compile time on both sides.
4. **The engine's index** stops exporting `DE`, `DICTIONARIES`, `EN` and `TranslationKey` and exports `ENGINE_EN` instead (plus the generic `GameText`; `GameTextParams`, `Translate` and `EngineTextKey` stay internal, as nothing outside uses them). The mechanics (`translation.ts`, `language.ts`, `game-text.ts`) stay.
5. **Docs**: the engine's and the game's `CLAUDE.md` say where texts live and that a text the engine renders goes into its four areas. `docs/architecture/README.md` stays as it is: the change adds no project and no dependency (the game already depends on the engine), and the diagrams' drift since their last run is refreshed by its own PR ([#3101](https://github.com/WolfSoko/wol-sok-mono/issues/3101)).

## Acceptance

1. A diff changing only a file under `libs/features/lazy/bacteria-game/src/lib/i18n/texts/` makes neither `feat-shared-bacteria-engine` nor `bacteria-wars-functions` affected (`nx show projects --affected` on that diff), and `tools/ci/release-affected.mjs` on it selects no functions deploy.
2. The engine holds no German text and no English area it does not render: `libs/features/bacteria-engine/src/lib/i18n/` has no `de/` and only the four English areas.
3. A German area missing a key, or holding one too many, still fails to compile (spec-typecheck or build of the game).
4. Every key and every text is unchanged: a JSON dump of `EN` and `DE` taken before the move equals the one after it (checked during the work, noted in the PR, not committed).
5. Golden replays (`golden-replay.spec.ts`), GPU goldens and the `perf` checksums are unchanged; no `BALANCE_VERSION` bump.
6. `npx nx affected -t lint,lint-templates,test,typecheck-specs,build` green; no new project or dependency edge, so no cycle and no tag violation (boundaries lint green).

## Decided questions

- **Scope** (manager, request 1239): this PR delivers step 1 and leaves [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103) open (`Part of [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103)`). Steps 2 to 4 stay later PRs of [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103), no sub-issues.
- **Texts in the game lib** instead of a lib of their own (decision 2): approved as written.
