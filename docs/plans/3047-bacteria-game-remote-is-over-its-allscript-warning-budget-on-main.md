# Plan #3047: bacteria-game-remote is over its allScript warning budget on main

Spec: [docs/specs/3047-…](../specs/3047-bacteria-game-remote-is-over-its-allscript-warning-budget-on-main.md)

1. **Spec and plan** (`docs/specs/`, `docs/plans/`), commit
   `docs(bacteria-game-remote): spec and plan for the allScript budget warning`.
2. **Baselines** (`apps/bacteria-game-remote/project.json`, `esbuild` target,
   `production` configuration): `allScript` `1768kb` → `1863kb`,
   `anyScript` `622kb` → `653kb`. Commit of its own,
   `perf(bacteria-game-remote): raise the allScript and anyScript baselines to what ships`.
   - Test: `npx nx run bacteria-game-remote:build:production` shows no
     `exceeded maximum budget` warning for scripts (acceptance 1 and 4).
3. **Checks**: `npx nx format:write`,
   `npx nx affected -t lint,lint-templates --base=origin/main`.
4. **PR** to `main` with `Closes #3047`, the "what grew" table from the spec
   in its body.
