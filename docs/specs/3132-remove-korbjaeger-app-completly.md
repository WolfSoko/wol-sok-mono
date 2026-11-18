# Remove the Korbjäger app completely

Issue: [#3132](https://github.com/WolfSoko/wol-sok-mono/issues/3132)

## Goal

Korbjäger is not needed any more. Remove every project, file, config entry, rule and doc line that exists only for it, so the workspace builds, lints, tests and releases as if it had never been there, and nothing keeps a dead reference to it.

## Non-goals

- **No teardown of live resources from the repo.** The Firebase project `korbjaeger` (Hosting, the Nitro and `konto` functions, Firestore, Auth) and the AWS stack `Korbjaeger` (the CNAME `korb.wolsok.de`) are not destroyed by this change or by a release: removing a project only stops its deploys. Deleting them is irreversible and outside what CI or a cloud session can reach (the sessions cannot read the `korbjaeger` GCP project), so it is a manual step for the owner, filed with the PR.
- **No rewrite of history.** Specs and plans in `docs/specs` and `docs/plans`, the `CHANGELOG.md` and the old ADRs stay as the record of what was built and decided. ADR 0018 and 0019 get a status line saying the app was removed by #3132.
- **No change to the shared libs Korbjäger used besides its own** (`shared-legal`, `shared-theme`, `shared-firebase-emulator`, `shared-e2e-server`, `utils-browser-storage`, `utils-time`, `utils-version`, `shared-firebase-domain-cdk`, `tools-vite`'s `workspace-file.ts`): other apps use them; only their docs and specs lose the Korbjäger mentions.

## Decisions

- **Projects removed** (folders deleted): `apps/korbjaeger`, `apps/korbjaeger-functions`, `apps/korbjaeger-cdk`, `libs/features/basketball-data` (`feat-shared-basketball-data`), `libs/features/korbjaeger-account`, `libs/features/korbjaeger-answers`, `libs/features/korbjaeger-selection`, `tools/korbjaeger`. Each is used by Korbjäger only (the project graph shows no other dependent; `tools` depends on `feat-shared-basketball-data` only through `tools/korbjaeger`).
- **Root files removed**: `firebase.korbjaeger.json`, the `korbjaeger` alias in `.firebaserc`, `tools/vite/nitro-ts-path-aliases.ts` (only Korbjäger's `vite.config.ts` imports it; check for a spec beside it).
- **Root config cleaned**: the six `@wolsok/…` path aliases in `tsconfig.base.json`; `.oxlintrc.json`'s Korbjäger globs (the vitest override keeps pacetrainer and rollapolla-analog; the Node-only restriction override for the two `feat-shared` libs goes); the `korb` prefix in `eslint.config.mjs`.
- **Root dependencies only Korbjäger used are removed** from `package.json` and the lockfile (`npm install` regenerates it): found so far `@material/material-color-utilities`, `@axe-core/playwright`, `superstatic`; the build step checks every dependency of the removed projects' imports with a grep over the remaining `apps`, `libs`, `tools` and configs and removes each with no remaining user.
- **Tools specs keep their coverage with other projects as examples.** `tools/ci/*.test.mjs`, `tools/deploy/*.spec.ts` and `tools/oxlint/workspace-rules.spec.mjs` use Korbjäger names as fixtures or as real entries: real entries (the domain table in `deploy-targets.spec.ts`, the deploy-inputs list) drop it; fixtures switch to another existing project (`pacetrainer`, `rollapolla-analog`, a remaining lib's `/testing` entry) so every case still tests the same thing. A case that exists only because of a Korbjäger trait (`korbjaeger:deploy` going through `build-app`) is kept with another project that has such a chain if there is one, else rewritten on a synthetic graph, never just dropped.
- **Licence**: the root `LICENSE` drops the Korbjäger directories and `firebase.korbjaeger.json`; RollaPolla stays proprietary. `README.md` and `docs/CONTRIBUTING.md` name only RollaPolla.
- **CLAUDE.md**: the section "Korbjäger (basketball parents app)" goes, and every other line naming Korbjäger is reworded without it (rule 10's examples and its #2966/#2967 note, rule 11's two exceptions, the Licence section, the deploy, emulator, theme and `shared-firebase-emulator` lines). Pacetrainer stays the German-UI example of rule 10.
- **Docs**: `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md` and `docs/architecture/README.md` lose the Korbjäger rows and graph nodes; the shared libs' READMEs (`firebase-domain-cdk`, `firebase-emulator`, `theme`) name only their remaining users; the comment in `firebase-domain.spec.ts` names only BacteriaGame.

## Acceptance

1. `git grep -il 'korbj\|basketball-data\|basketball_data'` finds nothing outside `docs/specs`, `docs/plans`, `docs/adr/0018-*`, `docs/adr/0019-*` and `CHANGELOG.md` (and this issue's spec and plan).
2. `npx nx show projects` lists none of `korbjaeger`, `korbjaeger-functions`, `korbjaeger-cdk`, `feat-shared-basketball-data`, `feat-shared-korbjaeger-account`, `feat-korbjaeger-answers`, `feat-korbjaeger-selection`.
3. ADR 0018 and 0019 carry a status line naming #3132.
4. `package.json` holds no dependency that nothing in the workspace imports any more because of the removal; `npm ci` passes on the new lockfile.
5. `npx nx affected -t lint,lint-templates,test,build,typecheck-specs` (against `main`) passes, and `npx nx test tools` (the `tools/**/*.test.mjs`, `release-affected`, `deploy-inputs`, `deploy-workflow`, `target-inputs`) and `npx nx test tools-deploy` and `npx nx test oxlint-workspace-rules` pass.
6. `npx nx format:check` passes.
7. A manual step on the work item tells the owner how to take down the live resources (Firebase project `korbjaeger`, CDK stack `Korbjaeger` with the CNAME `korb.wolsok.de`).

## Open questions

- The open Korbjäger issues and PRs (#3124, #3125, #3126, #3095, #3094, #3038, #3016, #2996, #2976, #2959) become obsolete with this change. Closing them is outside this issue; they go to the manager as a follow-up.
