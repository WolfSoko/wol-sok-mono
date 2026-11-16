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

- **`.ts` extensions, not moved helpers.** Vite's bundled loader (today's default) and Node's native type stripping both resolve `./x.ts`. The same goes for the helpers the configs load (`tools/vite/nitro-ts-path-aliases.ts` imports `./workspace-file`). The configs are type-checked by each app's `tsconfig.editor.json` (`**/*.ts`), the helpers by `tools/tsconfig.tools.json`: both get `allowImportingTsExtensions` (with `noEmit`, which it requires; neither emits), else `tsc` and the editor report TS5097. Moving the helpers would change nothing about the extension.
- **The oxlint boundary override** for `apps/*/vite.config.ts` allows the `tools/vite` helpers by an anchored regex, which now names the `.ts`.
- **Guard by a test** in `tools/ci/vite-config-imports.test.mjs` (run by `nx test tools`): every tracked `vite.config.*` / `vitest.config.*`, and every file it loads through relative imports, has a module extension (`.ts`, `.mts`, `.js`, …, not just any dot) on each relative import (`import … from`, `export … from`, `import()`). The `tools` test target gets the Vite configs among its inputs, so a config change reruns it.

## Acceptance

1. `nx reset && nx show projects` prints no "without a file extension" warning.
2. `nx build korbjaeger` (its `build-app`), `nx build pacetrainer` and `nx build rollapolla-analog` still load their configs and build.
3. `nx test tools` passes, and the new test fails on an extensionless relative import in a Vite config.
4. `nx affected -t lint,lint-templates` passes, and `tsc -p apps/<app>/tsconfig.editor.json` reports no TS5097 for the three apps.

## Open questions

None.
