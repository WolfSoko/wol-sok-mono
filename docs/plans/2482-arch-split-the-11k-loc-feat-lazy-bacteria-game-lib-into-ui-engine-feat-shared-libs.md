# Plan: move the game's engine out of `feat-lazy-bacteria-game` (#2482)

Spec: the issue body of #2482 and its two comments (no separate spec PR).
Paths without a prefix are relative to `libs/features/lazy/bacteria-game/src/lib/`.

## Where things stand (main, 2026-11-04)

The issue was written at ~11k LOC. Since then the lib has grown past 140k
lines with data files. The seam it proposes already exists as an entry point:
`src/engine.ts` (`@wolsok/feat-lazy-bac-game/engine`) is guarded by an oxlint
override and by `engine-bundle.spec.ts`. Its import closure, measured with
esbuild, is 126 files:

| Part of the closure                                                                            | Files | Non-spec LOC |
| ---------------------------------------------------------------------------------------------- | ----- | ------------ |
| `state/` (all but 4 files, see below)                                                          | 76    | ~22,000      |
| `i18n/` without Angular (`dictionaries`, `en/`, `de/`, `translation`, `game-text`, `language`) | 46    | ~3,700       |
| `support/legal-links.ts`, `replays/watch-links.ts`, `social/profile.ts`                        | 3     | small        |

`state/` imports nothing from `gl/`, `sound/` or `arena/`. Only four files in
`state/` use Angular: `game-state.service.ts`, `game.states.ts`,
`player.service.ts` and `player.store.ts`.

The issue has three consumers: `bacteria-game-remote` (the UI),
`bacteria-wars-functions` (through `/engine`) and `feat-lazy-bacteria-wars-admin`
(through `/admin-kit`). The component split (issue step 4) is #2682 and is
being done there (#2750, #2753, #2760, #2761). It is out of scope here.

## Decisions

1. **One new lib, the engine, and no other libs in this ticket.** The new lib
   is `libs/features/bacteria-engine`, project `feat-shared-bacteria-engine`,
   alias `@wolsok/feat-shared-bacteria-engine`, tag `feat-shared` (the same
   precedent as `feat-shared-reaction-diffusion-kernels`). It holds exactly
   what `engine.ts` reaches today plus the rest of `state/`, which is also
   framework-free. `gl/`, `sound/` and `arena/` stay in the game lib. They are
   browser-only (WebGL, Web Audio, canvas) and each has one consumer, so a lib
   of their own buys caching but no seam. Whether to split them out is decided
   in a follow-up issue once this split has shipped (see the last task).
2. **The issue's "< 2.5k non-spec LOC" criterion is replaced.** At today's
   size it can't be reached without moving the UI itself. The new targets,
   all measurable:
   - The game lib loses `state/` (except its four Angular files) and the
     framework-free `i18n/`, which is about 26k non-spec LOC.
   - The engine lib's `src/index.ts` is its only public entry. No file outside
     the engine lib imports a path inside it.
   - Nothing in the engine lib imports Angular, NgRx, RxJS, Firebase or the DOM.
3. **The texts move with the engine.** `GameText` keys are typed against
   `EN` (`i18n/dictionaries.ts`), and `levels.ts`, `medallions.ts` and 12 other
   state files build texts. A texts lib of its own was rejected: a
   `feat-shared` lib may not depend on another one, and the texts belong to
   the same domain. `I18nService`, `TranslatePipe` and `GameTextPipe` stay in
   the game lib's `i18n/` and import the dictionaries from the engine.
4. **Allow `app` → `feat-shared`** in `.oxlintrc.json`'s `depConstraints`.
   `bacteria-wars-functions` (tag `app`) takes the engine directly. Today it
   can only reach `feature:lazy`. `feature:admin` and `feature:lazy` already
   allow `feat-shared`.
5. **The `/engine` entry goes away; `/admin-kit` and `/watch` stay.** The
   functions and the tools import `@wolsok/feat-shared-bacteria-engine`.
   Keeping `engine.ts` as a re-export would leave two names for one API.
   `admin-kit.ts` and `watch.ts` keep their exports but take engine symbols
   from the new alias.
6. **The four Angular state files stay in `state/`** of the game lib. That
   keeps their many importers unchanged. They import the engine through the
   alias.
7. **Specs move with their file, except the cases that cross the seam.**
   - `replay.spec.ts` and `online-colors.spec.ts` use `net/`: their `net` cases
     move into specs under `net/`.
   - The `MAX_GPU_COLONIES` case of `levels.spec.ts` moves next to
     `gl/simulation-shaders.ts`.
   - The fixtures `testing/match-record.ts` and `testing/recorded-replay.ts`
     move to the engine lib's `src/testing/`, exported as
     `@wolsok/feat-shared-bacteria-engine/testing`, the same way as
     `@wolsok/shared-analytics/testing`.

   No assertion is weakened. The goldens (`golden-replay.json`,
   `golden-gpu-int.json`, `golden-gpu-sim.json`, `SELF_TEST_GOLDEN`) move
   byte for byte or stay where they are. `BALANCE_VERSION` doesn't change.

8. **Buildable.** The game lib has an `ng-packagr-lite` build, so the engine
   lib gets one too (like the kernels lib). Otherwise the game lib's build
   compiles the engine's sources outside its `rootDir`.
9. **Each PR keeps `main` green.** All moves use `git mv`, so history follows.
   There is no barrel inside the engine apart from `src/index.ts`.

## PR 1: the engine lib (one PR, several commits)

Branch off `main`. The type is `refactor`. Commit scopes are the project each
commit is mainly about. Run this after every task:

```bash
npx nx run-many -t test,lint,lint-templates -p feat-shared-bacteria-engine feat-lazy-bacteria-game
```

### Task 1: create the empty lib

- Generate it with the `nx-generate` skill (`@nx/js:library`,
  `directory libs/features/bacteria-engine`, jest, no bundler). Then give it
  the kernels lib's `ng-packagr-lite` `build` target, `ng-package.json`,
  `tsconfig.lib*.json` and `tags: ["feat-shared"]`.
- Jest uses `ts-jest` with `testEnvironment: 'node'`, with no Angular preset
  and no `test-setup.ts`. That also proves the engine runs in Node.
- `tsconfig.base.json` gets the paths `@wolsok/feat-shared-bacteria-engine`
  and `.../testing`. `package.json` gets no peer dependencies.
- `.oxlintrc.json`: add `feat-shared` to `app`'s `onlyDependOnLibsWithTags`.
  Retarget the engine override (`no-restricted-imports` for Angular, NgRx,
  RxJS, Firebase and `**/arena/*`) to `libs/features/bacteria-engine/src/**/*.ts`,
  and widen it with `**/gl/*` and `**/sound/*`.
- `tools/federation/workspace-federation.js`: skip both new aliases next to
  `@wolsok/feat-lazy-bac-game`, with the same comment. Otherwise the shell and
  the remote share the engine through the import map.
- `.codecov.yml`: add a flag and a component for the new lib, as for the game lib.
- Tests: the generated spec passes, and `npx nx lint feat-shared-bacteria-engine`.
- Commit: `chore(feat-shared-bacteria-engine): add the empty engine lib`.

### Task 2: move the texts

- `git mv` `i18n/{dictionaries,translation,game-text,language}.ts`, `i18n/en/`
  and `i18n/de/` with their specs into `libs/features/bacteria-engine/src/lib/i18n/`.
- The engine's `src/index.ts` exports what `i18n/index.ts` exported from these
  files. The game lib's `i18n/index.ts` re-exports nothing from the engine.
  Its importers (48 files) import the engine alias directly.
- `game-texts.spec.ts` and `i18n.service.spec.ts` stay in the game lib.
- Tests: `npx nx test feat-shared-bacteria-engine` and
  `npx nx test feat-lazy-bacteria-game --testPathPattern=i18n`.
- Commit: `refactor(feat-shared-bacteria-engine): move the game's texts into the engine`.

### Task 3: move `state/` and the three stragglers

- `git mv` every file of `state/` (with its subfolders `gpu-int/`, `balance/`,
  `level-generator/` and the JSON data) except the four Angular files and
  their specs into `libs/features/bacteria-engine/src/lib/state/`.
- Move `support/legal-links.ts`, `replays/watch-links.ts` and
  `social/profile.ts` (with their specs) into the engine's `site/` and
  `social/` folders.
- Move `testing/match-record.ts` and `testing/recorded-replay.ts` into the
  engine's `src/testing/` and export them from `src/testing.ts`.
- Split the crossing spec cases as Decision 7 says.
- `src/index.ts` exports today's `engine.ts` list, plus whatever the game lib,
  `admin-kit.ts`, `watch.ts`, the admin lib and the tools import from these
  files. Find that list with esbuild's metafile, or by compiling until no
  import is left unresolved. Exports are named, never `export *`.
- Rewrite the game lib's imports of these files (about 160 files) to the alias.
  Do it with a script, and check that `rg "from '(\.\./)+state/" src/lib`
  finds only the four Angular files.
- Move `engine-bundle.spec.ts` and `engine-replay.spec.ts` into the engine
  lib. The bundle spec bundles `src/index.ts`.
- Delete `src/engine.ts` and its path in `tsconfig.base.json`. Remove it from
  the federation skips too.
- Tests: `npx nx test feat-shared-bacteria-engine` (the golden replay specs
  included) and `npx nx test feat-lazy-bacteria-game`.
- Commit: `refactor(feat-shared-bacteria-engine): move the simulation and the match state into the engine`.

### Task 4: switch the consumers

- `apps/bacteria-wars-functions`: replace `@wolsok/feat-lazy-bac-game/engine`
  with the new alias in every file. Update the path in
  `replays/replays.emulator.ts` (`golden-replay.json`).
- `tools/perf/engine-bench.mjs`: change `ENGINE` and the fixture paths.
  Change the `perf` target's inputs if they name the old path. The checksums
  and the baseline stay the same.
- `tools/bacteria-game/balance/*`, `play-games.ts` and
  `.github/workflows/bacteria-balance.yml`: change the paths. The workflow's
  hash also covers `libs/features/bacteria-engine`. The `balance` and
  `balance-check` targets move to the engine lib's `project.json`.
- `gpu-crosscheck/` stays in the game lib (it needs `gl/`) and imports the
  engine alias.
- `apps/bacteria-game-remote/src/firestore-indexes.spec.ts` also scans
  `libs/features/bacteria-engine/src`.
- Docs: update `CLAUDE.md` (sections Cloud Functions, Testing and Performance
  Gates, which name `@wolsok/feat-lazy-bac-game/engine` and the `state/`
  paths) and the game lib's `CLAUDE.md`. Add a short `CLAUDE.md` in the engine
  lib that states the Node-only rule. Mention the move in ADR 0011's notes
  (the code moved, the decision didn't).
- Tests: `npx nx test bacteria-wars-functions`, `npx nx build bacteria-wars-functions`,
  `npx nx run feat-shared-bacteria-engine:balance-check` and
  `npx nx run feat-shared-bacteria-engine:perf` (L22: compare against `main`
  on the same machine).
- Commit: `refactor(bacteria-wars-functions): take the engine from its own lib`.

### Task 5: check the whole thing

- `npx nx build bacteria-game-remote` (federation and PWA, including
  `check-lazy-admin.mjs`) and `npx nx build angular-examples`. Then
  `npx nx affected -t build,test,lint,lint-templates`.
- The budgets must not move. A shift of a few bytes from different chunk
  names is fine; anything more means an import now pulls something new into
  `main`.
- `npx nx graph --file=...`: `feat-shared-bacteria-engine` has no edge to the
  game lib, and the functions have no edge to `feat-lazy-bacteria-game`.
- `npm run arch:diagrams` regenerates `docs/architecture/README.md`.
- `npx nx format:write`, and also `npx -y oxfmt@<package.json version> --check`
  on the changed `.md` files (L27, L29).
- Play one campaign level and one replay in `nx serve bacteria-game-remote`.
- Commit: `docs(tools): regenerate the architecture diagrams`.

## Follow-up (not in this PR)

- After the merge, open an issue on whether to split `gl/`, `sound/` and
  `arena/` (about 17.6k LOC together) into libs of their own. Base it on the
  numbers in the then-current architecture review. Link it from #2482 and
  #2370.

## Risks

- **Federation.** If the engine alias is not skipped, the shell and the
  remote get one shared copy that only the shell's build updates. Task 1
  covers this. Check that `/bacteria-game` works through the shell and on its
  own port.
- **Coverage gate.** Specs move out of the game lib's Codecov flag. The new
  flag must exist before the PR's upload, or patch coverage reads as missing.
- **Open PR #2761** (component split, #2682) touches files that import
  `state/`. Whichever PR merges second rebases. The import rewrite is
  scripted, so rerun the script rather than resolving conflicts by hand.
