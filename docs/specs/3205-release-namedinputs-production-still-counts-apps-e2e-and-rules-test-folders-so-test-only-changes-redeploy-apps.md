# Spec: test-only files still count as production inputs ([#3205](https://github.com/WolfSoko/wol-sok-mono/issues/3205))

## Goal

A change to a file that only tests read selects no deploy in
`tools/ci/release-affected.mjs --target=deploy`, while a change to app or
lib source still selects the apps it did. Three gaps of `namedInputs.production`
in `nx.json` are closed in one edit:

1. `{projectRoot}/e2e/**`: Playwright specs, page objects, fixtures and
   helpers of the apps (`angular-examples`, `bacteria-game-remote`,
   `fourier-analysis-remote`, `pacetrainer`, `rollapolla-analog`,
   `ws-thanos-test-app`).
2. `{projectRoot}/rules-test/**`: the Firestore rules test of
   `bacteria-game-remote` (`jest.config.ts`, `firebase.json`,
   `tsconfig.json`, `firestore-rules.emulator.ts`).
3. `jest.config.cts`: `!{projectRoot}/jest.config.[jt]s` misses the `.cts`
   configs of `portfolio` and `feat-lazy-bacteria-wars-admin`
   ([comment](https://github.com/WolfSoko/wol-sok-mono/issues/3205#issuecomment-7093475399),
   found after PR #3207).

## Today (measured on `main` at 0b99a135)

| Changed file                                                                                                    | Deploys selected                                          |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `apps/bacteria-game-remote/e2e/pos/account.po.ts`                                                               | bacteria-game-remote, angular-examples-cdk, portfolio-cdk |
| `apps/rollapolla-analog/e2e/fixture/home-page-hydrated.fixture.ts`                                              | rollapolla-analog                                         |
| `apps/bacteria-game-remote/rules-test/{jest.config.ts,firebase.json,tsconfig.json,firestore-rules.emulator.ts}` | bacteria-game-remote, angular-examples-cdk, portfolio-cdk |
| `apps/portfolio/jest.config.cts`                                                                                | portfolio-cdk                                             |
| `libs/features/lazy/bacteria-wars-admin/jest.config.cts`                                                        | bacteria-game-remote, angular-examples-cdk, portfolio-cdk |
| `apps/portfolio/src/main.ts`                                                                                    | portfolio-cdk                                             |
| `apps/bacteria-game-remote/src/main.ts`                                                                         | bacteria-game-remote, angular-examples-cdk, portfolio-cdk |

## Decisions

1. **Exclude the folders whole**: `!{projectRoot}/e2e/**/*` and
   `!{projectRoot}/rules-test/**/*`. Nothing in them is read by a build or a
   deploy; each holds only Playwright or rules-test code. Rooted at
   `{projectRoot}`, so `src/environments/environment.e2e.ts` (a build
   configuration of the e2e build) stays an input.
2. **`!{projectRoot}/jest.config.*`** replaces `!{projectRoot}/jest.config.[jt]s`:
   it matches every extension (`.ts`, `.cts`, `.mts`, `.js`, …), as
   `!{projectRoot}/vitest.config.*` already does; no build reads a Jest
   config.
3. **`!{projectRoot}/tsconfig.e2e.json` too**: the Playwright tsconfig of
   `pacetrainer`, `rollapolla-analog` and `ws-thanos-test-app` is test-only
   in the same way and its exclusion rides the same edit (one redeploy).
   The project's `tsconfig.json` names it in `references`, which the
   Angular and Vite builds do not follow.
4. **One `nx.json` edit.** `release-affected.mjs` keeps Nx's verdict for
   `nx.json`, so the merge redeploys every app once; bundling all gaps into
   this edit keeps it to one full redeploy.
5. **The e2e and test targets keep their files**: `e2e`/`e2e-ci--*`
   (inferred by `@nx/playwright`), `test` and `test-emulator` take `default`,
   which still holds `e2e/`, `rules-test/` and the Jest configs, so their
   caches still miss on a change there.
6. **A guard test**: `tools/ci/test-only-inputs.test.mjs` (in `npx nx test
   tools`) lists the tracked test-only files (every `jest.config.*` and
   `tsconfig.e2e.json` at a project root, every file under a project's
   `e2e/` or `rules-test/`) and fails on one that `production` does not
   exclude, and on a project's `src/main.ts` that it does exclude. A new
   test-only folder or config extension thus fails CI instead of
   redeploying apps unseen.

## Non-goals

- Other inputs of the deploys (why `angular-examples-cdk` and
  `portfolio-cdk` follow `bacteria-game-remote`) stay as they are.
- No change to `release-affected.mjs` itself.
- Projects' own `namedInputs` overrides: none overrides `production`.

## Acceptance

1. Each test-only file in the table above selects no deploy with
   `node tools/ci/release-affected.mjs --files=<file> --target=deploy`.
2. `apps/portfolio/src/main.ts`, `apps/bacteria-game-remote/src/main.ts`
   and `libs/features/lazy/bacteria-wars-admin/src/index.ts` select the same
   deploys as today.
3. `npx nx show target inputs bacteria-game-remote:e2e-ci` (or an
   `e2e-ci--*` target) still lists the files of `e2e/`, and
   `portfolio:test` still lists `jest.config.cts`.
4. `tools/ci/test-only-inputs.test.mjs` passes, and fails when one of the
   new exclusions is removed from `nx.json`.
5. `npx nx test tools`, lint and format pass.

## Open questions

None.
