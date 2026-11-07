# Plan #2412: CDK apps share one ESNext target

1. **Baseline.** On `main`, record `tsc --showConfig` targets and
   `tsc --noEmit` error counts for the five `apps/*-cdk/tsconfig.app.json`
   (acceptance 1 and 3 compare against them).
2. **Shared config.** Add `tsconfig.cdk.json` (extends
   `./tsconfig.base.json`, `compilerOptions.target: "ESNext"`). Point the five
   `apps/*-cdk/tsconfig.json` at `../../tsconfig.cdk.json` and drop their
   `target`. Add the `cdkTsconfig` named input
   (`{workspaceRoot}/tsconfig.cdk.json`) to each app's `default` in its
   `project.json`. Check: acceptance 1-3 and 6.
3. **Docs.** Target Policy line in `CLAUDE.md` names the shared file.
4. **Checks and commit.** `npx nx format:write`,
   `npx nx run-many -t test,lint -p angular-examples-cdk,bacteria-game-remote-cdk,fourier-analysis-remote-cdk,portfolio-cdk,shader-examples-remote-cdk`,
   `npx nx affected -t lint,lint-templates`; commit
   `fix(portfolio-cdk): share one ESNext target across the cdk apps` with
   spec and plan; open the PR to `main` with `Closes #2412` and
   "Supersedes #2818".
