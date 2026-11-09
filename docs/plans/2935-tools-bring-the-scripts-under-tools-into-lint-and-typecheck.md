# Plan #2935: tools: bring the scripts under tools/ into lint and typecheck

Spec: [docs/specs/2935-tools-bring-the-scripts-under-tools-into-lint-and-typecheck.md](../specs/2935-tools-bring-the-scripts-under-tools-into-lint-and-typecheck.md)

1. **Project and boundaries** — `tools/project.json` (name `tools`, tag
   `tools`, target `typecheck-tools`); `tools/federation/project.json` and
   `tools/vite/project.json` as nested projects (`tools-federation`,
   `tools-vite`), since apps import them; `.oxlintrc.json`: depConstraint for
   `tools`, override with the `allow` pattern for
   `tools/{bacteria-game/balance,korbjaeger}/**`.
   Tests: `npx nx lint tools` red before the oxlintrc change (17 boundary
   errors), green after; `npx nx run tools:typecheck-tools` green; probes of
   acceptance 3 and 4 red, then removed.
   Commit: `feat(tools): lint and typecheck the scripts under tools/`.
2. **CI** — `.github/workflows/ci-cd.yml`: add `typecheck-tools` to the
   `nx affected -t` list. Test: `npx nx show projects --affected
   --files=tools/perf/engine-bench.mjs` lists `tools`.
   Commit: `ci(github): run typecheck-tools among the affected targets`
   (as `chore(github): …`, commitlint's types).
3. **Docs** — CLAUDE.md lint section: the `tools` project, its targets and
   the override. Commit: `docs(tools): describe the tools project in CLAUDE.md`
   (or folded into task 1).
4. **Checks** — `npx nx format:write`, `npx nx affected -t
   lint,lint-templates,typecheck-tools`, `npx nx test oxlint-workspace-rules`,
   graph check that nothing depends on `tools`.
