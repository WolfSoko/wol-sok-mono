# 3074: Type-aware oxlint resolves node:test types only on some runs in tools/

Issue: [#3074](https://github.com/WolfSoko/wol-sok-mono/issues/3074) (found in #2985, PR #3070)

## Goal

Type-aware lint of the scripts under `tools/` gives the same verdict however oxlint is started: `nx lint tools` alone, `nx run-many -t lint` (one batched oxlint call over many projects) or `npx oxlint .`.

## Root cause

Type-aware oxlint (`oxlint-tsgolint`) types each file in the program of its nearest `tsconfig.json`. For `tools/` that is `tools/tsconfig.json`, which extends `tools/tsconfig.tools.json` and so includes only `**/*.ts`. The 27 `.js`/`.mjs` scripts under `tools/` belong to no program: tsgolint puts every such unowned file of one run into a shared fallback program, built from the unowned files that run happens to lint.

- `npx oxlint tools`: the fallback program holds only the `tools/` scripts. Nothing brings in `@types/node`, so `node:test` resolves to nothing, `describe`/`it` are `any`, and `no-floating-promises` stays silent.
- `npx oxlint tools jest.preset.cjs` (and `npx oxlint .`, and a batch that lints the root project): the root `jest.preset.cjs`, also unowned, imports `@nx/jest/preset`, whose types pull `@types/node` into the shared program; now `describe`/`it` return `Promise<void>` and are flagged.

Reproduced on main with the `void` of #3070 taken out of `tools/ci/deploy-inputs.test.mjs`: 0 findings with `tools` alone, 23 with `tools jest.preset.cjs` or `.`. Parallelism and working directory play no part; the set of co-linted unowned files decides.

The flake is not limited to `no-floating-promises`: once the types resolve, `require-array-sort-compare` reports `deploy-inputs.test.mjs:62` too, and `tools/ci/vite-config-imports.test.mjs` (added after #3070) and `tools/federation/shared-singletons/shared-singletons.spec.mjs` carry un-voided `describe`/`it` that pass `nx lint tools` today only because that run leaves them untyped.

## Non-goals

- Unowned files outside `tools/` (the root's `jest.preset.cjs`, `eslint.config.mjs`, other projects' scripts): raised to the manager as a follow-up.
- Type-checking the scripts with `tsc` (`typecheck-tools` stays `.ts` only, on `tsconfig.tools.json`).

## Decisions

- **`tools/tsconfig.json` includes `**/*.js` and `**/*.mjs` beside `**/*.ts`.** The file exists only for type-aware oxlint (its comment says so); `tsconfig.tools.json`, which `typecheck-tools` and tsx use, keeps `**/*.ts`. `allowJs` comes from `tsconfig.base.json` and `checkJs` stays off, so nothing type-checks the scripts beyond the lint rules. The scripts then always get the configured program with `types: ["node"]`, whatever else the run lints. No `.cjs` exists under `tools/`; the guard below catches one added later.
- **The code fixes what the now deterministic lint reports**: `void` on the floating `describe`/`it` (as #3070 chose), a `localeCompare` comparator for the string sort (as `nx-cloud-workers.test.mjs` does). No disable comments.
- **A guard test** `tools/ci/tools-tsconfig.test.mjs` (run by `nx test tools`): every git-tracked `.ts`/`.js`/`.mjs`/`.cjs`/`.mts`/`.cts` file under `tools/` is in the file list of `tools/tsconfig.json` (parsed with TypeScript's `getParsedCommandLineOfConfigFile`, no program built), so narrowing the include or adding an unmatched extension fails fast instead of flaking. Nested projects (`tools/deploy`, `tools/federation`, `tools/oxlint`, `tools/vite`) have no `tsconfig.json` of their own, so this one owns their files too; the test fails with a pointer if one is added without covering its scripts.

## Acceptance

1. `npx oxlint tools`, `npx oxlint tools jest.preset.cjs` and `npx oxlint .` report the same findings for files under `tools/` (none).
2. `npx nx lint tools --skip-nx-cache` and `npx nx run-many -t lint -p tools tools-federation tools-deploy tools-oxlint tools-vite --skip-nx-cache` pass.
3. With one `void` taken out of a `describe` in a `tools/` test, all three oxlint calls of 1 report it (checked by hand, not committed).
4. `npx nx test tools` passes, including the new guard; the guard fails when `**/*.mjs` is dropped from `tools/tsconfig.json`.
5. `npx nx run tools:typecheck-tools` passes unchanged.

## Open questions

None.
