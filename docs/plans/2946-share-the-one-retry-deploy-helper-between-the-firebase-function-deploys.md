# Plan #2946: Share the one-retry deploy helper between the Firebase function deploys

Spec: [docs/specs/2946-…](../specs/2946-share-the-one-retry-deploy-helper-between-the-firebase-function-deploys.md).
Test first in each task; `npx nx format:write` and
`npx nx affected -t lint,lint-templates` before each commit.

1. **Guard for target inputs** — new `tools/ci/target-inputs.test.mjs`
   (missing `{workspaceRoot}` files; the `{projectName}` check moved from
   `deploy-inputs.test.mjs`). Red on today's `jest.preset.js`, then fix
   `nx.json`, `apps/bacteria-game-remote/project.json`,
   `apps/bacteria-wars-functions/project.json`,
   `libs/features/lazy/bacteria-game/project.json`. Commit
   `fix(nx): name jest.preset.cjs in test inputs and guard file inputs`.
2. **Move the helper to `tools-deploy`** — `git mv` the four files to
   `tools/deploy/`, add `project.json` (tag `tools`, Jest `test`),
   `jest.config.ts`, `tsconfig.spec.json`; specs import `@jest/globals`;
   usage line and doc comment name the new path; drop `deploy/**` from
   `bacteria-wars-functions`' `tsconfig.spec.json`; its `deploy` command
   points at the new path. Tests: `nx test tools-deploy`,
   `nx run tools:typecheck-tools`. Commit
   `refactor(tools-deploy): move the one-retry deploy helper into tools`.
3. **Korbjäger deploys retry once** — `apps/korbjaeger/project.json`,
   `apps/korbjaeger/src/firebase-deploy.spec.ts` (spec first),
   `apps/korbjaeger-functions/project.json`, its `config.spec.ts`. Commit
   `fix(korbjaeger): retry a failed Firebase deploy once` (with
   `korbjaeger-functions` in the same commit, scope `korbjaeger`).
4. **Docs** — CLAUDE.md (functions deploy paragraph, Korbjäger deploy).
   Commit `chore(tools-deploy): document the shared deploy retry`.
