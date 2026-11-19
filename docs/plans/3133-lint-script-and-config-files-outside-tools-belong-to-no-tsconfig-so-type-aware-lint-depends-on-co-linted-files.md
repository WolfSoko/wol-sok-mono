# Plan: every script belongs to its nearest tsconfig (#3133)

Spec: `docs/specs/3133-lint-script-and-config-files-outside-tools-belong-to-no-tsconfig-so-type-aware-lint-depends-on-co-linted-files.md`

1. **Guard test first (red).** Move `stepBlock` from `tools/ci/target-inputs.test.mjs` into `tools/ci/workspace-projects.mjs`. Add `tools/ci/script-tsconfig.test.mjs` (nearest `tsconfig.json` plus references owns every tracked, non-ignored script; `ci-cd.yml` step present and not skippable); delete `tools/ci/tools-tsconfig.test.mjs`. Run `node --test tools/ci/script-tsconfig.test.mjs`: fails listing the survey's files.
2. **Own the files (green).** Root `tsconfig.json`; `federation.config.js` in the four `tsconfig.editor.json`; `apps/ws-thanos-test-app/tsconfig.e2e.json` and its reference; `src/**/*.mjs` in `libs/shared/e2e-server/tsconfig.lib.json`; `**/test-nested-build-path/**` in `.oxlintrc.json`; delete the five tensorflow `*.cy.ts`. Add the CI step to `.github/workflows/ci-cd.yml`. Guard test green.
3. **Checks.** `npx oxlint .` on `main` and on the branch (json counts compared), `npx nx affected -t lint,lint-templates,test`, `npx nx test tools`, `npx nx test shared-e2e-server`, the tsx script; fix lint findings the newly typed files show.
4. **Docs.** CLAUDE.md (Linting section: root `tsconfig.json`, workspace-wide guard and its CI step; Testing section line on the CI step), the comment in `tools/tsconfig.json`.
5. **Format and commit.** `npx nx format:write`; one commit `fix(tools): give every linted script a tsconfig that owns it (#3133)` with spec and plan; open the PR with `Closes #3133`.
