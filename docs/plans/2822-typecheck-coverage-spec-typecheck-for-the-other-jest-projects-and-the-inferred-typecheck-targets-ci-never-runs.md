# Plan: typecheck coverage (#2822)

Spec: [docs/specs/2822-…](../specs/2822-typecheck-coverage-spec-typecheck-for-the-other-jest-projects-and-the-inferred-typecheck-targets-ci-never-runs.md).
One branch, one PR; each task is one commit. Before each commit: `npx nx format:write`,
`npx nx affected -t lint,lint-templates`.

1. **Guard first (red).** Add `tools/ci/typecheck-specs.test.mjs`: walk every `project.json`
   (outside `node_modules`, `dist`, `tmp`), and for each with a `test` target and a sibling
   `tsconfig.spec.json`, expect a `typecheck-specs` target. Run `npx nx test tools`: it fails,
   listing the 47 projects. Not committed alone (a red commit); goes in with task 3.
2. **Fix the six projects' spec type errors**, each checked with
   `npx tsc -p <root>/tsconfig.spec.json --noEmit` and its `nx test`:
   - `apps/bacteria-game-remote/src/app/error-reports/error-reports.spec.ts`
   - `libs/public/spa-cdk-stack/src/lib/stack-spa.spec.ts`
   - `libs/public/ws-thanos/src/lib/snap-sound.service.spec.ts`
   - `libs/shared/data-access/vite.config.ts`
   - `libs/utils/version/tsconfig.spec.json`
   - `apps/angular-examples/project.json` (`typecheck-specs` with `dependsOn: ["generate-version"]`)
     Commit: `fix(<project>): …` per project where the scope rule allows one scope each
     (six small commits).
3. **Add `"typecheck-specs": {}` to the other 41 `project.json` files** (a short Node script edits
   the JSON, then `nx format:write`). Task 1's test goes green. Run
   `npx nx run-many -t typecheck-specs --skip-nx-cache`. Commit: `chore(tools): …` with the test.
4. **Run `typecheck` in CI.** Add it to the `nx affected -t` list in `.github/workflows/ci-cd.yml`
   and to `stop-after` in `.nx/ci-config.yaml`; `npx nx test tools`
   (`nx-cloud-workers.test.mjs`) passes. Commit: `chore(github): …`.
5. **Docs.** `CLAUDE.md` Testing → "Spec typecheck": the rule, the guard, CI running `typecheck`.
   Commit: `docs`-type `chore(tools): …`.
6. **PR** with spec, plan and code, `Closes #2822`; acceptance points listed with their results.
