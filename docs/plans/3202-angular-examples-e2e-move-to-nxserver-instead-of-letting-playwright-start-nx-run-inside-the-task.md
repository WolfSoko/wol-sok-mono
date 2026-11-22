# Plan #3202: angular-examples e2e moves to nxServer

Spec: `docs/specs/3202-angular-examples-e2e-move-to-nxserver-instead-of-letting-playwright-start-nx-run-inside-the-task.md`.

Starts once PR #3203 (#3120) is on `main`. The branch
`3202-angular-examples-e2e-nxserver` comes off that `main`.

## Tasks

1. **Page diagnostics for the home spec** (spec decision 2)
   - Files: `apps/angular-examples/e2e/fixtures/page-diagnostics.ts` (new): a
     Playwright fixture that extends `test`. It records `console` messages
     of type `error`, `pageerror`, `requestfailed` and responses with status
     ≥ 400. After a failed test (`testInfo.status !== testInfo.expectedStatus`)
     it prints them as one block to stdout and attaches them as
     `page-diagnostics.txt`. `e2e/home.spec.ts` imports `test`/`expect`
     from it. `playwright.config.ts` adds `screenshot: 'only-on-failure'`.
   - Test: run the spec locally with `/` routed to a failing response (a
     temporary `page.route`, not committed). The output must show the
     block. Then run it unchanged and it passes with no block.
   - Commit: `test(angular-examples): print the page's errors when the home spec fails`
2. **Serve through nxServer** (spec decisions 1 and 5)
   - Files: `apps/angular-examples/playwright.config.ts`. `webServer`
     becomes `nxServer('angular-examples:serve', baseURL, { cwd:
     workspaceRoot, timeout: (CI ? 720 : 180) * 1000 })`, with the comment
     the other configs carry. `apps/angular-examples/package.json` or
     `tsconfig` only if the alias needs it (it is resolved through
     `tsconfig.base.json`, as in pacetrainer). In `CLAUDE.md`, Testing,
     drop the "Exception for now" sentence.
   - Test: `CI=true NX_DAEMON=false npx nx show project angular-examples
     --json` lists `serve` and the gate on `e2e` and
     `e2e-ci--e2e/home.spec.ts` (acceptance 2).
     `CI=true npx nx run angular-examples:e2e-ci--e2e/home.spec.ts` passes
     with Nx starting `serve` (acceptance 3). `npx nx test
     shared-e2e-server` passes; its config check now covers this app too.
   - Commit: `test(angular-examples): take the e2e web server from nxServer`
3. **Checks and PR**
   - `npx nx format:write`, `npx nx affected -t
     lint,lint-templates,typecheck-specs,test`. Open the PR with spec, plan
     and code, `Closes #3202`, and request `@coderabbitai review`.
4. **CI evidence** (spec decisions 3 and 4)
   - Watch `angular-examples:e2e-ci--e2e/home.spec.ts` in the PR's Nx Cloud
     run. Read its task log for the diagnostics block.
   - Red: fix the cause it names in its own commit (`fix(angular-examples):
     …` or `fix(shared-e2e-server): …`, test first where it is code) and
     run CI again. If the cause lies outside the repo, ask the manager a
     `question` before keeping an exception.
   - Green: re-run the CI workflow until three runs passed on the head,
     then note the runs in the PR description.
5. **Review, test, merge** (role steps 5-7)
   - Code review by a fresh subagent against the spec, fixes, review
     comment on the PR. List each acceptance point with its result in the
     PR description, then send the `merge` request once every check is
     green.
