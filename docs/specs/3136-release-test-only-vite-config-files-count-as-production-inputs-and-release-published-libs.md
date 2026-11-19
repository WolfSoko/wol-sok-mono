# Release: test-only vite.config files count as production inputs and release published libs

Issue: [#3136](https://github.com/WolfSoko/wol-sok-mono/issues/3136)

## Goal

`namedInputs.production` in `nx.json` leaves out spec files, `jest.config`, `playwright.config` and the spec tsconfigs, but not a project's Vite config. Three libs run Vite only for Vitest and build with another executor:

| Project                                                  | `build` executor              | Vite config                    |
| -------------------------------------------------------- | ----------------------------- | ------------------------------ |
| `spa-cdk-stack` (`libs/public/spa-cdk-stack`, published) | `@nx/js:tsc`                  | `vite.config.mts`, `test` only |
| `shared-analytics` (`libs/shared/analytics`)             | `@nx/angular:ng-packagr-lite` | `vite.config.mts`, `test` only |
| `shared-data-access` (`libs/shared/data-access`)         | `@nx/angular:ng-packagr-lite` | `vite.config.mts`, `test` only |

A change to one of those configs is a `production` change, so `tools/ci/release-affected.mjs` keeps every project whose `build` or `deploy` reads it. Measured on `main` (8d94d6a): `--files=libs/public/spa-cdk-stack/vite.config.mts,libs/shared/analytics/vite.config.mts --target=build` keeps `spa-cdk-stack`, `shared-analytics`, `feat-lazy-bacteria-game`, `bacteria-game-remote`, `angular-examples`, `portfolio` and `rollapolla-analog`. Since #3044 the version job selects through the same filter, so such a commit bumps published packages and redeploys apps.

Make a test-only Vite config no production input, keep the Vite configs of projects that build with Vite (`pacetrainer`, `rollapolla-analog`, both `@analogjs/platform:vite`) one, and keep it so.

## Non-goals

- The same leak through test-only targets in `project.json` (#3130).
- Other causes of needless releases (#3015, #3020, #3049): handled there.
- Changing how any lib builds or tests.
- The CDK stacks' `deploy` inputs (see acceptance 1).

## Decisions

- **Test-only configs are named `vitest.config.mts`, and `production` excludes `!{projectRoot}/vitest.config.*`.** The name then says what the file is for, the way `jest.config` and `playwright.config` do, and one global exclusion covers every project without a per-project `namedInputs` copy. Vitest reads `vitest.config.*` before `vite.config.*`, and `@nx/vitest` infers from it, so the `test` targets stay. The rejected alternatives: a blanket `!{projectRoot}/vite.config.*` would drop the Analog apps' real build input (and every `^production` of their dependents' graph), and adding it back per app is easy to forget for the next Vite app; a project-level `namedInputs.production` in each lib would copy the whole list three times and drift from `nx.json`.
- **References follow the rename:** each lib's `project.json` `test.options.configFile`, its `tsconfig.spec.json` include and `spa-cdk-stack`'s `tsconfig.lib.json` exclude.
- **The inferred `typecheck`, `build-deps` and `watch-deps` targets of the three libs go away:** `@nx/vite/plugin` infers them from a `vite.config.*`, and `@nx/vitest` does not. No CI step, `dependsOn` or script names them (CI runs `typecheck-specs`/`typecheck-tools`, never `typecheck`), and each lib's `build` (`tsc`, ng-packagr) type-checks the same sources. Accepted, not worked around.
- **Guard by a test**, `tools/ci/test-only-vite-configs.test.mjs` (run by `nx test tools`, whose inputs hold `**/vite.config.*`, `**/vitest.config.*` and `**/*.json` already):
  - `nx.json`'s `production` excludes `{projectRoot}/vitest.config.*` and excludes no `vite.config`;
  - every tracked `vite.config.*` belongs to a project that builds with Vite: its `project.json` either names no `build` target (so `@nx/vite/plugin` infers a Vite one) or one whose executor is a Vite build executor (`@analogjs/platform:vite`, `@nx/vite:build`). Otherwise it fails, naming the file and asking for `vitest.config.mts`.
- **`CLAUDE.md`'s Vitest line** says the naming rule, so a new Vitest lib starts right.

## Acceptance

1. `node tools/ci/release-affected.mjs --files=<the three libs' vitest.config.mts> --target=build` selects no project, and `--target=deploy` none of the apps it kept before. The five CDK stacks (`*-cdk`) stay selected for `deploy`: their `deploy` targets declare no `inputs`, so Nx takes `default` and `^default` (every file of the stack and its dependencies, specs included), which no `production` exclusion reaches. That is a separate leak, raised as a follow-up, not fixed here (this change keeps `nx.json` to the `production` exclusion).
2. `node tools/ci/release-affected.mjs --files=apps/pacetrainer/vite.config.ts --target=deploy` still selects `pacetrainer`, and `rollapolla-analog`'s config still selects `rollapolla-analog`.
3. `nx show project <lib>` lists `test` with `configFile` on the new file for all three libs, and `nx test spa-cdk-stack`, `nx test shared-analytics` and `nx test shared-data-access` pass.
4. `nx build` passes for the three libs.
5. `nx test tools` passes; the new test fails on a test-only lib with a `vite.config.*` and on a `production` without the exclusion.
6. `nx affected -t lint,lint-templates` passes.

## Open questions

None.
