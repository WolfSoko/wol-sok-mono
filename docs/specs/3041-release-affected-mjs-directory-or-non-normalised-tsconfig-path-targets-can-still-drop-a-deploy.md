# Spec #3041: release-affected.mjs counts tsconfig path targets that name no file as the base itself

## Goal

`tsconfigBaseChanges` in `tools/ci/release-affected.mjs` narrows a paths-only
change of `tsconfig.base.json` to the files its changed aliases point to. It
strips a leading `./` and takes the rest literally. A target naming a
directory (`./libs/y/src`, which TypeScript resolves to its `index.ts`) or a
non-normalised path (`./libs/a/../b/src/index.ts`) matches no Nx input, so a
project reading only the new target is dropped as "reads none of the changed
files": a silently skipped deploy. After this change such a target can no
longer drop a deploy.

## Non-goals

- Resolving a directory target to the file TypeScript would pick
  (`index.ts`, `package.json` `types`, …): counting the base itself is safe and
  a directory target is rare (none of the 51 targets today).
- Tracing changes of any other file than `tsconfig.base.json`.

## Decisions

1. **Normalise every target with `path.posix.normalize`** after stripping a
   leading `./`, so `./libs/a/../b/src/index.ts` counts as
   `libs/b/src/index.ts`, the path Nx's inputs name. Reason: it keeps the
   narrowing for an equivalent literal path rather than giving it up.
2. **A changed target that is no file (blob) at the base or the head counts
   as `tsconfig.base.json` itself**, which keeps Nx's verdict, the same way a
   wildcard does. That covers a directory, a path outside the workspace
   (`../x`) and a path that exists nowhere. Reason: the failure mode is a
   skipped deploy; the safe fallback costs at most a deploy too many.
3. **`tsconfigBaseChanges` stays pure**: it takes a predicate
   `isFile(path)` as a third parameter. The CLI builds it from
   `git ls-tree -r --name-only` of base and head (blobs only, so a directory
   is no file), read only when `tsconfig.base.json` changed. Reason: the
   function stays unit-testable without git, as today.
4. A target is checked against both sides (a file at base or head), not
   only its own side: simpler, and a target that is a file on one side
   matches Nx inputs that name it.

## Acceptance

- A1: a changed alias whose target is a directory (`./libs/b/src`) counts as
  `['tsconfig.base.json']` (unit test).
- A2: a non-normalised target (`./libs/a/../b/src/index.ts`) counts as
  `libs/b/src/index.ts` (unit test).
- A3: a target outside the workspace or missing on both sides counts as
  `['tsconfig.base.json']` (unit test).
- A4: existing behaviour unchanged: literal file targets still narrow, wildcards
  and non-paths changes still count as the base (existing tests green).
- A5: the CLI passes a predicate built from git blobs; `npx nx test tools`,
  lint and typecheck of `tools` pass.

## Open questions

None.
