# Plan: infer `typecheck-specs` with a local Nx plugin (#3131)

Spec: `docs/specs/3131-infer-typecheck-specs-with-a-local-nx-plugin-instead-of-per-project-entries.md`.
Starts once PR #3130 is merged; branch `3131-infer-typecheck-specs` off that `main`.

1. **Plugin, test first.**
   - Files: `tools/nx/typecheck-specs.test.mjs` (red first), `tools/nx/typecheck-specs.mjs`.
   - Tests: `createNodes` adds the target with command, inputs and `cache` to the
     root of a `tsconfig.spec.json` beside a `project.json`/`package.json`, skips
     one without, honours `targetName`. `npx nx test tools`.
   - Commit: `feat(tools): infer typecheck-specs with a local Nx plugin`.
2. **Register it, drop the per-project entries.**
   - Files: `nx.json` (plugin entry, `targetDefaults.typecheck-specs` removed),
     every `project.json` with `"typecheck-specs": {}`; `angular-examples` keeps
     its `dependsOn`.
   - Check: `nx show projects --with-target typecheck-specs` against the projects
     with a `tsconfig.spec.json`; `nx run-many -t typecheck-specs --skip-nx-cache`.
     A newly covered project that fails goes into the plugin entry's `exclude`
     with its reason, and to the manager as a follow-up.
   - Commit: `chore(nx): take typecheck-specs from the plugin, not each project.json`.
3. **Guard.**
   - Files: `tools/ci/typecheck-specs.test.mjs` (overrides only `dependsOn`;
     every spec project inferred or excluded).
   - Tests: `npx nx test tools`; break it by hand once (a `command` in a
     `project.json`), then restore.
   - Commit: `test(tools): guard the inferred typecheck-specs`.
4. **Docs.**
   - Files: `CLAUDE.md` Testing → "Spec typecheck".
   - Commit: `docs(tools): describe the typecheck-specs plugin` (scope `tools`).
5. **Checks before PR:** `npx nx format:write`, `npx nx affected -t lint,lint-templates`,
   release check by hand (`tools/ci/release-affected.mjs` with only the plugin
   file changed selects nothing).
