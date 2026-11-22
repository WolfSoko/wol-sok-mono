# Plan #3142 — CDK stacks' deploy inputs

1. **Guard first** — `tools/ci/deploy-inputs.test.mjs`: add "every deploy
   target declares inputs" (exempt `bacteria-wars-android` with its reason) and
   "every `@wolsok/nx-aws-cdk-v2:deploy` target reads `production` and
   `^production`". Run `npx nx test tools`: red on the five stacks.
2. **Inputs** — add `"inputs": ["production", "^production"]` to `deploy` in
   `apps/{angular-examples,bacteria-game-remote,fourier-analysis-remote,portfolio,shader-examples-remote}-cdk/project.json`.
   `npx nx test tools` green.
3. **Docs** — CLAUDE.md, Testing → "Deploy inputs": the CDK rule and the guard.
4. **Verify** — acceptance 1–6 with `release-affected.mjs --target=deploy`
   (each file alone) and `nx show target inputs portfolio-cdk:deploy`, outputs
   into the PR description; acceptance 7 is steps 1–2; `nx format:write`, `nx affected -t lint,lint-templates`.
5. **Commit** — one commit `fix(tools): read only production inputs in the CDK stacks' deploy`
   (scope `tools`: the guard; the stacks' project.json ride along), with spec
   and plan. Its first release redeploys the five stacks once (their
   project.json changed); the deploy watch checks each stack green with no
   unexpected resource change.
