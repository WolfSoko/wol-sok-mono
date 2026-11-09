# Spec #2935: tools: bring the scripts under tools/ into lint and typecheck

Found while building [#2882](https://github.com/WolfSoko/wol-sok-mono/issues/2882)
([PR #2933](https://github.com/WolfSoko/wol-sok-mono/pull/2933)).

## Goal

The scripts under `tools/` are linted and typechecked in CI like every
project. Today they belong to no Nx project (the root project `wolsok`, which
owns them, has no targets), so `nx lint` never runs oxlint, and with it
`wolsok/no-version-json-read` and `@nx/enforce-module-boundaries`, on them,
and nothing runs `tsc -p tools/tsconfig.tools.json --noEmit`.

## Non-goals

- No refactoring of what the scripts import: the balance lab
  (`tools/bacteria-game/balance/`) and the fixture tooling
  (`tools/korbjaeger/`) keep reaching into the engine's and
  `basketball-data`'s sources by relative path; moving that behind the libs'
  entry points is raised to the manager as a follow-up (see Decisions).
- No type checking of the `.js`/`.mjs` scripts (`checkJs`); oxlint covers them.
- `tools/oxlint` stays its own project (`oxlint-workspace-rules`) with its
  own `test` and `lint`.
- No change to the inferred `typecheck` targets CI does not run
  ([#2822](https://github.com/WolfSoko/wol-sok-mono/issues/2822)).

## Decisions

- **One project `tools`** (`tools/project.json`, tag `tools`, root `tools`).
  `@nx/oxlint` infers its `lint` target and passes `tools/oxlint` as a nested
  project root, so the plugin's files stay with `oxlint-workspace-rules`.
  One project rather than one per folder: the scripts are a handful each,
  share one tsconfig and have no consumers inside the graph.
- **No project depends on `tools`**: `apps/*/vite.config.ts` and
  `apps/*/federation.config.js` import from it, but the graph (checked with
  `nx graph`) has no edge into `tools`, so a change to a lib the scripts use
  makes `tools` affected without dragging apps into a release.
- **Typecheck target `typecheck-tools`**: `tsc -p tools/tsconfig.tools.json
  --noEmit`, cached, added to CI's `nx affected -t` list. Not `typecheck`:
  that name is inferred by `@nx/vite` on five projects CI does not run yet
  (#2822), and adding it to the CI list would start those too. Not
  `typecheck-specs`: it checks scripts, not specs. `tools/tsconfig.tools.json`
  keeps its name (the Android deploy's `tsx --tsconfig` names it); type-aware
  lint already finds the tools' files without a `tools/tsconfig.json`
  (checked with a probe).
- **Boundaries**: a constraint for the tag `tools` lets it depend on
  `feat-shared`, `shared`, `utils` and `tools` (what it uses, plus the
  layers below; never an app). The 17 relative imports into the engine's and
  `basketball-data`'s `src/` (balance lab, fixture tooling) are recorded as an
  override in `.oxlintrc.json` for those two folders, an `allow` pattern as
  for `apps/*/vite.config.ts`, the tag constraint kept. Moving them behind the
  libs' entry points would need new public exports of internals (the balance
  lab's report, the fixture anonymiser), a secondary entry the federation
  skip list must know, and `--tsconfig` on every `tsx` call of those scripts
  (the `balance` targets, the fixtures README, `bacteria-balance.yml`):
  a change of its own, raised as a follow-up.
- **CLAUDE.md**: the lint section's "`nx lint` does not reach `tools/`
  scripts outside a project" becomes the `tools` project and its targets.

## Acceptance

1. `npx nx show project tools` lists `lint` and `typecheck-tools`; `lint`
   lists `tools/oxlint` as a nested project root.
2. `npx nx lint tools` and `npx nx run tools:typecheck-tools` are green.
3. A `readFileSync(join(root, 'version.json'))` in a `tools/` script fails
   `npx nx lint tools` with `wolsok/no-version-json-read` (probe, not
   committed).
4. A type error in a `tools/` `.ts` script fails `typecheck-tools` (probe,
   not committed).
5. `.github/workflows/ci-cd.yml` runs `typecheck-tools` among the affected
   targets; a change under `tools/` makes `tools` affected.
6. No project depends on `tools` in the graph; `oxlint-workspace-rules`
   keeps its targets and its `test` is green.
7. CLAUDE.md describes the `tools` project.

## Open questions

- None blocking. The follow-up (deep imports behind the libs' entries) is the
  manager's to organise.
