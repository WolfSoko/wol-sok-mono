# #3142 — CDK stacks' deploy targets declare no inputs

## Goal

A change that only touches tests or test configs (spec files, `jest.config.ts`,
`vitest.config.mts`, `tsconfig.spec.json`) of a CDK stack, its app or the libs
it uses no longer selects the stack in `tools/ci/release-affected.mjs`, so a
release does not redeploy it. A change to what the stack really deploys still
selects it.

## Background

The `deploy` targets of the five CDK stacks (`angular-examples-cdk`,
`bacteria-game-remote-cdk`, `fourier-analysis-remote-cdk`, `portfolio-cdk`,
`shader-examples-remote-cdk`, executor `@wolsok/nx-aws-cdk-v2:deploy`) declare
no `inputs`, and `targetDefaults.deploy` holds only `dependsOn`. Nx then takes
`default` and `^default`, so every spec, Jest/Vitest/Playwright config and e2e
file of the stack, its app and every lib below them is a deploy input.
`release-affected.mjs --files=libs/public/spa-cdk-stack/vitest.config.mts
--target=deploy` keeps all five stacks today.

The Firebase deploy targets already declare
`["production", "^production", <root firebase config>, ".firebaserc"]`.

## Decisions

1. **Inputs per stack in its `project.json`:** `"inputs": ["production",
   "^production"]` on each stack's `deploy`. Not a `targetDefaults` entry keyed
   by the executor: an `nx.json` edit keeps Nx's verdict in
   `release-affected.mjs` and would redeploy every app once; a `project.json`
   edit redeploys only the five stacks. It also matches the Firebase deploys,
   which name their inputs in their own `project.json`.
2. **`production` keeps what a stack reads:** resolved in the stack's context,
   `production` builds on the stack's own `namedInputs.default`
   (`{projectRoot}/**/*`, `sharedGlobals`, `cdkTsconfig`), so `cdk.json`,
   `src/**`, its tsconfigs and the root `tsconfig.cdk.json` stay inputs. Its
   app's build output reaches it through `dependsOn: ["^build"]` (the app's
   `build` reads `production`), and libs it imports through `^production`.
3. **Guard in `tools/ci/deploy-inputs.test.mjs`:** every `deploy` target
   declares `inputs`, and every `@wolsok/nx-aws-cdk-v2:deploy` target reads
   `production` and `^production`. `bacteria-wars-android` is exempt from the
   first by name, with its reason: a Gradle project with no Nx dependencies,
   whose implicit `default` is already exact, and whose `project.json` edit
   would upload an unchanged app to Play.
4. **CLAUDE.md** names the rule under Testing, "Deploy inputs", so a new stack
   gets it.

## Non-goals

- The `@wolsok/nx-aws-cdk-v2` generator (published package) stays as it is; the
  guard catches a stack it generates without inputs.
- `production` still counts `e2e/**` and `rules-test/**` of apps; that is a
  matter of the global `namedInputs.production` and the apps' `build`, raised as
  a follow-up, not changed here.
- The Android app's inputs from outside its folder (assetlinks, achievements):
  a follow-up.

## Acceptance

1. `node tools/ci/release-affected.mjs --files=libs/public/spa-cdk-stack/vitest.config.mts --target=deploy`
   selects no CDK stack.
2. Same for `apps/portfolio/src/app/app.component.spec.ts` and
   `apps/portfolio-cdk/jest.config.ts`.
3. `apps/portfolio/src/app/projects.ts` and
   `apps/portfolio-cdk/src/portfolio.stack.ts` still select `portfolio-cdk`;
   `libs/public/spa-cdk-stack/src/index.ts` and `tsconfig.cdk.json` still
   select all five stacks.
4. `npx nx show target inputs portfolio-cdk:deploy` lists no `*.spec.ts` and
   still lists `apps/portfolio-cdk/cdk.json` and `tsconfig.cdk.json`.
5. A non-code file the app's build ships (`apps/portfolio/public/robots.txt`)
   still selects `portfolio-cdk`.
6. `apps/portfolio-cdk/cdk.json` alone still selects `portfolio-cdk`.
7. `npx nx test tools` is green and fails when a stack's `deploy` loses its
   inputs.

## Open questions

None.
