# Plan: file extensions in Vite config imports (#3057)

Spec: [docs/specs/3057-…](../specs/3057-korbjaeger-vite-config-ts-imports-without-file-extension-warn-in-every-release-and-project-graph-run.md)

1. **Guard first.** Add `tools/ci/vite-config-imports.test.mjs`: lists tracked `vite.config.*`/`vitest.config.*` with `git ls-files`, finds relative specifiers in static imports, re-exports and `import()`, and fails naming each one without an extension. Add `{workspaceRoot}/**/vite.config.*` and `{workspaceRoot}/**/vitest.config.*` to the `tools` project's `test` inputs. Run `node --test tools/ci/vite-config-imports.test.mjs`: red on today's three configs.
2. **Fix.** Add `.ts` to the relative imports of `apps/korbjaeger/vite.config.ts`, `apps/pacetrainer/vite.config.ts` and `apps/rollapolla-analog/vite.config.ts`. Test green; `nx reset && nx show projects` shows no extension warning.
3. **Check.** `nx test tools`, `nx run korbjaeger:build-app`, `nx build pacetrainer`, `nx build rollapolla-analog`, `nx format:write`, `nx affected -t lint,lint-templates`.
4. **Commit** `fix(korbjaeger): give the Vite configs' relative imports their file extension` with spec, plan, test and fix; open the PR (`Closes #3057`).
