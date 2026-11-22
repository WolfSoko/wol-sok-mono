# Spec #3202: angular-examples e2e moves to nxServer

Found on [#3120](https://github.com/WolfSoko/wol-sok-mono/issues/3120), whose
fix is PR [#3203](https://github.com/WolfSoko/wol-sok-mono/pull/3203). It
follows [#2915](https://github.com/WolfSoko/wol-sok-mono/issues/2915) (PR
#2941), which left this app out as "its own investigation".

## Goal

`angular-examples` is the one app whose Playwright config still lets
Playwright start its server in CI: `webServer.command` is
`npx nx run angular-examples:serve` with `reuseExistingServer: !CI`
(CLAUDE.md, Testing, "Exception for now"). So in CI its e2e task runs a
nested `nx` call, which builds the project graph with
`NX_TASK_TARGET_PROJECT=angular-examples` set. In #3120 that nested graph
build dropped the other apps' `e2e--wait-for-webserver` gates from the
workers' graphs, because `@nx/playwright/plugin` caches what it inferred under
a key that leaves `NX_TASK_TARGET_*` out. #3203 makes `nxServer` safe against
that, but the nested call is still there.

After this change the shell takes its `webServer` from `nxServer` like every
other app: in CI Nx starts `angular-examples:serve` as the continuous
dependency of the e2e task, the readiness gate waits for it, and Playwright
only waits for the URL. No e2e task starts a nested `nx run` any more.

The exception came from commit 1112a0b4 (#2454): with the inferred serve
dependency, the home page did not render on the Nx Cloud workers
(`#main-toolbar` never appeared, three attempts). The same task passed
locally, alone and next to the other apps. The workers kept no logs of the
continuous task and no Playwright traces, so nobody found the cause. This
change has to find it, or show that it no longer happens.

## Non-goals

- No change to `nxServer` itself. Its contract is the one PR #3203 merges:
  inside a Playwright task (`e2e`, `e2e-ci`, `e2e-ci--<file>`) of the
  target's own project it waits, and everywhere else it gives
  `npx nx run <target>`.
- No upstream Nx report about the plugin's cache key. That is outside this
  repo; at most the PR mentions it.
- No new e2e tests for the shell's pages. The one spec file stays.
- Loading the remotes inside the shell's e2e stays out of scope: the dev
  manifest points at ports 4201-4203, which no dependency of this task
  serves, as today.

## Decisions

1. **Use `nxServer('angular-examples:serve', baseURL, { cwd, timeout })`.**
   This is the same helper and the same target as the other apps. `serve`
   is already `continuous`, and outside CI the plugin already infers
   `serve` plus the gate for `e2e` and `e2e-ci--e2e/home.spec.ts` (checked
   with `nx show project angular-examples`). CI now gets the same graph.
   The CI timeout stays 720 s for the server and the test.
2. **Make a failure on the workers explain itself before relying on it.**
   The old failure left nothing behind. The home spec gets a fixture or
   `beforeEach`/`afterEach` hooks that collect the page's console errors,
   failed requests and responses with status ≥ 400. On a failure it prints
   them to stdout, which lands in the Nx Cloud task log, and attaches them
   to the report. Each entry holds only the URL, the status code and the
   message, never request headers or bodies, since the Nx Cloud log is
   public. The config keeps the screenshot of a failed test
   (`screenshot: 'only-on-failure'`) and the trace on retry, as now.
   Reason: if the CI run on the PR goes red, the log has to name the cause
   (a failed `remoteEntry.json`, a shared bundle 404, a bootstrap error), so
   the fix goes to the root cause and not to a guess.
3. **Fix the root cause the CI run reveals, in this PR.** Candidates to
   check against the evidence:
   - the native-federation dev server answering `/` before its shared
     bundles are ready on a loaded worker (locally both answer together,
     after about 32 s);
   - `initFederation` with remotes on 4201-4203 that another app's e2e
     server holds on the same worker;
   - the Nx-started task running with another environment (`CI`, the
     configuration) than Playwright's nested start.
     If the run passes without a fix, the PR says so. Three green CI runs of
     `angular-examples:e2e-ci--e2e/home.spec.ts` on the PR (re-runs count)
     are then the evidence, and the exception goes away. A run counts only
     when it executed the task (its log shows the Playwright run, not a
     cache hit), and the PR links each run.
4. **If a root cause can't be fixed in this repo, ask the manager** before
   keeping any exception. A new exception would need a reason that names
   the cause.
5. **Drop the exception from CLAUDE.md** (Testing, the `webServer` bullet),
   so the bullet says every app takes its `webServer` from `nxServer`.
   The check in `nx-server.spec.ts` that a config serves only its own
   project's targets then covers this config too.

## Acceptance

1. `apps/angular-examples/playwright.config.ts` takes its `webServer` from
   `nxServer('angular-examples:serve', …)`, and no config under `apps/`
   still sets a raw `npx nx run` command or `reuseExistingServer: !…CI`.
2. With `CI=true`, `nx show project angular-examples --json` lists
   `angular-examples:serve` and `e2e--wait-for-webserver` in the
   `dependsOn` of `e2e` and `e2e-ci--e2e/home.spec.ts`. Before the change
   they are missing under `CI=true`.
3. Locally, `npx nx run angular-examples:e2e-ci--e2e/home.spec.ts` (with
   `CI=true`) passes: Nx starts `serve`, the gate passes, and Playwright
   waits instead of starting a second server (no "already used" or "exited
   early" error).
4. A failing home spec prints the page's console errors and failed
   requests in its output. To check this, run it once locally against a
   broken URL or with a request blocked by hand. Don't commit that.
5. CI on the PR runs `angular-examples:e2e-ci--e2e/home.spec.ts` on Nx Cloud
   and it passes on the final head. The PR describes what the first runs
   showed: the cause found and fixed, or that three runs passed without
   one.
6. CLAUDE.md names no exception for `angular-examples` any more.
7. `npx nx test shared-e2e-server` passes, together with the affected lint,
   lint-templates, typecheck-specs and format checks.

## Open questions

- Was the 2026-10 failure caused by the nested-call graph pollution that
  #3120 later found, or by something in the shell? The CI evidence from
  decision 2 answers that. Nothing to decide upfront.
