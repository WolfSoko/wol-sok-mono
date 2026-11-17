# Plan #3041: tsconfig path targets that name no file

1. **Tests first** (`tools/ci/release-affected.test.mjs`): give the existing
   `tsconfigBaseChanges` calls an `isFile` predicate over a fixture set of
   files; add cases for A1 (directory target), A2 (non-normalised target), A3
   (outside the workspace, missing). Run `npx nx test tools`: the new cases
   fail.
2. **Implement** (`tools/ci/release-affected.mjs`): `tsconfigBaseChanges(before,
   after, isFile)` normalises each changed target (`posix.normalize` after
   stripping `./`) and returns `[TSCONFIG_BASE]` when any is a wildcard or not
   `isFile`; update its doc comment. In `refinedFiles`, build `isFile` from
   `git ls-tree -r --name-only -z` of base and head. Tests green.
3. **Checks and commit**: `npx nx format:write`, `npx nx lint tools --fix`,
   `npx nx run tools:typecheck-tools`, `npx nx test tools`; commit
   `fix(tools): count tsconfig path targets that name no file as the base`
   with spec and plan.
