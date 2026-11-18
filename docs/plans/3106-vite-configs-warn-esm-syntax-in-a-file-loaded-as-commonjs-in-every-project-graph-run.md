# Plan: Vite configs and helpers as ES modules (#3106)

Spec: [docs/specs/3106-…](../specs/3106-vite-configs-warn-esm-syntax-in-a-file-loaded-as-commonjs-in-every-project-graph-run.md)

1. **Guard first.** In `tools/ci/vite-config-imports.test.mjs` add `isEsModule(file)` (`.mts`/`.mjs`, or `.ts`/`.js` with the nearest `package.json`'s `type` `module`; `.json` exempt) with unit cases, and a test per tracked Vite config listing the config and every relatively loaded file that is not an ES module. Add `{workspaceRoot}/tools/vite/**/*` to the `tools` `test` inputs. Run `node --test tools/ci/vite-config-imports.test.mjs`: red on the five lib configs and both helpers.
2. **Rename.** `git mv` the five lib `vite.config.ts` to `.mts` and both `tools/vite/*.ts` to `.mts`; update the libs' `project.json` `configFile`, `tsconfig.spec.json`/`tsconfig.lib.json`, the apps' helper imports, the helper's own import, the oxlint allow regex, `tools/tsconfig.tools.json` (`**/*.mts`) and `CLAUDE.md`. Test green; `nx reset && nx show projects` shows no warning.
3. **Check.** `nx test tools`, `nx run-many -t test,typecheck -p` the five libs, `nx run tools:typecheck-tools`, `nx run korbjaeger:build-app`, `nx build pacetrainer`, `nx build rollapolla-analog`, `nx format:write`, `nx affected -t lint,lint-templates`.
4. **Commit** `fix(tools-vite): load the Vite configs and helpers as ES modules` with spec, plan, test and change; open the PR (`Closes #3106`).
