# Plan 3074: own every tools/ script in tools/tsconfig.json

Spec: `docs/specs/3074-type-aware-oxlint-resolves-node-test-types-only-on-some-runs-in-tools.md`

1. **Guard test first** — `tools/ci/tools-tsconfig.test.mjs`: list git-tracked script files under `tools/`, parse `tools/tsconfig.json` with TypeScript's API, assert none is missing. Red on main (27 scripts missing). Commit with task 2.
2. **Include the scripts** — `tools/tsconfig.json`: `include` `**/*.ts`, `**/*.js`, `**/*.mjs`, comment explaining why. Guard green. Commit: `fix(tools): give the tools scripts a tsconfig so type-aware lint types them on every run`.
3. **Fix the findings the lint now reports** — `void` on `describe`/`it` in `tools/ci/vite-config-imports.test.mjs` and `tools/federation/shared-singletons/shared-singletons.spec.mjs`; `localeCompare` comparator in `tools/ci/deploy-inputs.test.mjs`. Same commit as 2 so lint never goes red on the branch.
4. **Checks** — `nx format:write`, `nx affected -t lint,lint-templates,test,typecheck-tools`, the three oxlint calls of acceptance 1 and the manual probe of acceptance 3.
5. **PR** with spec, plan, code, `Closes #3074`; follow-up for unowned files outside `tools/` to the manager.
