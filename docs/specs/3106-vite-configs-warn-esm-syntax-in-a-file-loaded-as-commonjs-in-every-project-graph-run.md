# Vite configs warn "ESM syntax in a file loaded as CommonJS" in every project-graph run

Issue: [#3106](https://github.com/WolfSoko/wol-sok-mono/issues/3106)

## Goal

Vite 8's config loader decides a config's module format the way Node does: by its extension, else by the `type` of the nearest `package.json`. The root `package.json` has no `"type": "module"`, so a `.ts` file that has no module `package.json` closer by is loaded as CommonJS, and rolldown warns "ESM syntax in a file loaded as CommonJS" for it in every Nx project-graph run (`@nx/vite` loads every config) and so in every release leg. Vite's planned default `configLoader: 'native'` would load such a file as CommonJS outright. Make every Vite config, and every file it loads, an ES module by Node's rules, and keep it so.

Measured with `nx reset && nx show projects` on `main` (6dcf08f), the warning names seven files, not the ten the issue lists:

- the Vite configs of the five libs `libs/features/korbjaeger-answers`, `libs/features/korbjaeger-selection`, `libs/public/spa-cdk-stack`, `libs/shared/analytics`, `libs/shared/data-access` (none has a `package.json` with a `type`; the root's applies);
- both `tools/vite` helpers, `workspace-file.ts` and `nitro-ts-path-aliases.ts`, which the apps' configs load (no `package.json` in `tools/`).

The apps' configs (`apps/korbjaeger`, `apps/pacetrainer`, `apps/rollapolla-analog`) do not warn: each app's own `package.json` already says `"type": "module"`, which also covers the files they load from inside the app (`deploy/*.ts`, `src/shared/function-region.ts`).

## Non-goals

- `"type": "module"` in the root `package.json`: it would turn every `.js`/`.ts` script of the workspace into ESM (the CommonJS deploy helpers under `tsx`, Jest configs, `federation.config.js`), far beyond this issue.
- Renaming the apps' configs: they are ESM already.
- Silencing the warning (`VITE_CONFIG_NATIVE_IGNORE_WARNING`): hides the cause.

## Decisions

- **`.mts` for the five lib configs and the two helpers.** The extension makes each an ES module whatever `package.json` is near, and Vite, `@nx/vite`/`@nx/vitest` (which infer from `vite.config.{js,ts,mjs,mts,cjs,cts}`) and TypeScript all take it. A `"type": "module"` in the libs' `package.json`s instead would change how the published packages (`spa-cdk-stack`, the shared libs) load for their consumers; a `package.json` in `tools/vite` would make the folder an npm package beside its `project.json`.
- **References follow the rename:** each lib's `project.json` `configFile`, its `tsconfig.spec.json` include and `tsconfig.lib.json` exclude; the apps' config imports of the helpers and the helpers' own import (`./workspace-file.mts`); the anchored oxlint boundary regex for `apps/*/vite.config.ts`, which allows the helpers by name; `tools/tsconfig.tools.json` includes `**/*.mts` so `typecheck-tools` still checks the helpers; `CLAUDE.md` names the helper by its new name. Specs and plans of earlier issues stay as written (history).
- **Guard by a test** in `tools/ci/vite-config-imports.test.mjs` (run by `nx test tools`, beside the extension check of #3057): every tracked `vite.config.*` / `vitest.config.*`, and every file it loads through relative imports, is an ES module by Node's rules: `.mts`/`.mjs`, or `.ts`/`.js` under a nearest `package.json` with `"type": "module"`; JSON is exempt. The `tools` test target gets `tools/vite/**` among its inputs, as the test now reads the helpers (`package.json`s and the configs are inputs already).

## Acceptance

1. `nx reset && nx show projects` prints no "ESM syntax in a file loaded as CommonJS" warning (and no other config-loader warning).
2. The five libs keep their inferred targets (`test`, `typecheck`, `build` where they had one), and `nx test` passes for each of them.
3. `nx run korbjaeger:build-app`, `nx build pacetrainer` and `nx build rollapolla-analog` still load their configs and the helpers and build.
4. `nx test tools` passes, and the new test fails on a Vite config or helper that would load as CommonJS.
5. `nx affected -t lint,lint-templates,typecheck` passes, `nx run tools:typecheck-tools` included.

## Open questions

None.
