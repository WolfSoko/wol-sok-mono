# Plan: reaction-diffusion-kernels dangling tsconfig.spec.json reference

Spec: [3143](../specs/3143-reaction-diffusion-kernels-tsconfig-json-references-a-tsconfig-spec-json-that-does-not-exist.md)

## Task 1: guard first (red)

- File: `tools/ci/script-tsconfig.test.mjs`.
- Add `danglingReferences()`: for each `gitLsFiles('tsconfig*.json', '**/tsconfig*.json')`, parse it with the existing `parseTsconfig` and collect each `projectReferences` entry whose `ts.resolveProjectReferencePath(reference)` does not exist, as `<config> → <reference path>`.
- Add `describe('the tsconfig references')` asserting the list is empty.
- Update the `ownedFiles` doc comment: a missing reference owns nothing there because the new test fails on it.
- Run `node --test tools/ci/script-tsconfig.test.mjs`: fails, naming `libs/features/reaction-diffusion-kernels/tsconfig.json → ./tsconfig.spec.json`.

## Task 2: fix (green)

- File: `libs/features/reaction-diffusion-kernels/tsconfig.json`: drop the `./tsconfig.spec.json` reference.
- Run the guard (green), `npx nx test tools`, `npx nx build feat-shared-reaction-diffusion-kernels`, `npx nx lint feat-shared-reaction-diffusion-kernels`, `release-affected.mjs` for `deploy` and `build` (expected: only the two CDK stacks of [#3142](https://github.com/WolfSoko/wol-sok-mono/issues/3142)).
- Commit tasks 1 and 2 together with spec and plan: `fix(feat-shared-reaction-diffusion-kernels): drop the tsconfig reference to a missing spec config ([#3143](https://github.com/WolfSoko/wol-sok-mono/issues/3143))`, after `npx nx format:write` and `npx nx affected -t lint,lint-templates`.
