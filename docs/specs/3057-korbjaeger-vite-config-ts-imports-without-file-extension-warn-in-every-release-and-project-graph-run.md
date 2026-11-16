# Korbjäger vite.config.ts: imports without file extension warn in every release and project-graph run

Issue: [#3057](https://github.com/WolfSoko/wol-sok-mono/issues/3057)

## Goal

Vite 8's config loader warns, in every Nx project-graph run (`@nx/vite` loads each config) and so in every release leg, that a relative import of a Vite config has no file extension, because the planned default `configLoader: 'native'` (Node's ESM loader) refuses extensionless relative imports. Give every relative import of every Vite config its file extension, and keep it so.

Today (measured with `nx reset && nx show projects`) the warning names:

- `apps/korbjaeger/vite.config.ts`: `../../tools/vite/nitro-ts-path-aliases`, `../../tools/vite/workspace-file`, `./deploy/build-configuration`, `./deploy/css-targets`, `./src/shared/function-region`
- `apps/pacetrainer/vite.config.ts` and `apps/rollapolla-analog/vite.config.ts`: `../../tools/vite/workspace-file`

The other five Vite configs (`libs/features/korbjaeger-answers`, `libs/features/korbjaeger-selection`, `libs/public/spa-cdk-stack`, `libs/shared/analytics`, `libs/shared/data-access`) import no relative module.

## Non-goals

- The second warning of the same block, "ESM syntax in a file loaded as CommonJS", which every `vite.config.ts` and both `tools/vite` helpers get because the root `package.json` has no `"type": "module"`. Fixing it means renaming the configs and helpers to `.mts` (or a module `package.json`), touching `project.json`s, tsconfigs and docs across eight projects: raised to the manager as a follow-up, not done here.
- Silencing the warning with `VITE_CONFIG_NATIVE_IGNORE_WARNING`: that hides the cause.
- The lockfile republish noted in the issue: belongs with #3024 / #3054.

## Decisions

- **`.ts` extensions, not moved helpers.** Vite's bundled loader (today's default) and Node's native type stripping both resolve `./x.ts`; the configs are not type-checked by any tsconfig and type-aware oxlint already accepts them (checked by `nx lint`). Moving the helpers would change nothing about the extension.
- **Guard by a test** in `tools/ci/vite-config-imports.test.mjs` (run by `nx test tools`): every tracked `vite.config.*` / `vitest.config.*` has a file extension on each relative import (`import … from`, `export … from`, `import()`). The `tools` test target gets the Vite configs among its inputs, so a config change reruns it.

## Acceptance

1. `nx reset && nx show projects` prints no "without a file extension" warning.
2. `nx build korbjaeger` (its `build-app`), `nx build pacetrainer` and `nx build rollapolla-analog` still load their configs and build.
3. `nx test tools` passes, and the new test fails on an extensionless relative import in a Vite config.
4. `nx affected -t lint,lint-templates` passes.

## Open questions

None.
