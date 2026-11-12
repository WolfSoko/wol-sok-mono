# 2985: tools:lint flaky, add `void` to `describe`/`it` in tools/ci/nx-cloud-workers.test.mjs

Issue: [#2985](https://github.com/WolfSoko/wol-sok-mono/issues/2985)

## Goal

`tools:lint` gives the same verdict on every run. `describe` and `it` from `node:test` return promises; type-aware oxlint (`typescript/no-floating-promises`) flags an un-awaited call whenever it resolves their types, which it does only on some runs. Every such call in the `node:test` files under `tools/` is marked with `void`, as `tools/oxlint/workspace-rules.spec.mjs` and `tools/firebase/grant-admin.test.mjs` already do.

## Non-goals

- Finding out why the type-aware lint resolves the `node:test` types only on some runs (a follow-up for the manager, not this ticket).
- Changing what any test checks.

## Decisions

- **All `node:test` files under `tools/`, not only the one the issue names.** The same pattern stands in `tools/ci/deploy-inputs.test.mjs`, `tools/ci/release-affected.test.mjs` and `tools/ci/target-inputs.test.mjs`; fixing one file would leave the flake in the others.
- **`void`, not `await`.** Top-level `await` of `describe` would serialise the suites and change how node:test reports them; `void` states that the promise is left to the runner on purpose, the form the workspace already uses.
- **No lint disable comment.** The rule is right; the code is what changes.

## Acceptance

1. Every `describe(` and `it(` call in `tools/**/*.test.mjs` and `tools/**/*.spec.mjs` that imports from `node:test` is prefixed with `void` (checked by grep: no un-voided call left).
2. `npx nx lint tools --skip-nx-cache` passes.
3. `npx nx test tools` passes, with the same number of tests as before.
4. Nothing else changes (diff touches only those test files and this spec and plan).

## Open questions

None.
