# Plan: remove the Korbjäger app completely

Spec: [docs/specs/3132-remove-korbjaeger-app-completly.md](../specs/3132-remove-korbjaeger-app-completly.md)

Branch off `main`, one PR (`Closes #3132`). Every task ends with `npx nx format:write` and the checks named in it.

1. **Delete the projects and root files.** `git rm -r` the eight folders and `firebase.korbjaeger.json`, `tools/vite/nitro-ts-path-aliases.ts` (and its spec, if any); drop the `.firebaserc` alias, the `tsconfig.base.json` aliases, the `eslint.config.mjs` prefix and the `.oxlintrc.json` globs and override. Check: `npx nx show projects` (acceptance 2), `npx nx graph --file=…` builds. Commit `chore(nx): remove the Korbjäger projects`.
2. **Rework the tools specs.** `tools/ci/deploy-inputs.test.mjs`, `deploy-workflow.test.mjs`, `release-affected.test.mjs` (and the comment in `release-affected.mjs`), `tools/deploy/deploy-targets.spec.ts`, `live-index.spec.ts`, `tools/oxlint/workspace-rules.spec.mjs`, `libs/shared/firebase-domain-cdk` spec comment: real entries drop Korbjäger, fixtures use remaining projects. Check: `npx nx test tools`, `npx nx test tools-deploy`, `npx nx test oxlint-workspace-rules`, `npx nx test shared-firebase-domain-cdk`. Commit `test(tools): …`.
3. **Remove dependencies only Korbjäger used.** For each dependency in `package.json`, grep the remaining sources and configs; remove the unused ones, `npm install`, then `npm ci`. Commit `chore(deps): …`.
4. **Docs and licence.** `LICENSE`, `README.md`, `docs/CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/architecture/README.md`, the three shared READMEs, ADR 0018/0019 status lines, `CLAUDE.md`. Check: acceptance 1 grep. Commit `docs(tools): …`.
5. **Whole check.** `npx nx affected -t lint,lint-templates,test,build,typecheck-specs --base=origin/main`, `npx nx format:check`. Push, open the PR, file the manual teardown step and the follow-up for the obsolete issues.
