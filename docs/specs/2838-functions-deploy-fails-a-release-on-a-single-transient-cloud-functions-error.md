# Spec #2838: Functions deploy fails a release on a single transient Cloud Functions error

Related: [#2830](https://github.com/WolfSoko/wol-sok-mono/issues/2830),
[#2748](https://github.com/WolfSoko/wol-sok-mono/issues/2748).

## Goal

A single transient error from Google's API during
`bacteria-wars-functions:deploy` no longer fails the release. The deploy runs
`firebase deploy` a second time when the first run fails, logs both attempts,
and fails only when the second run fails too.

Today the target (`apps/bacteria-wars-functions/project.json`) runs
`firebase deploy --config=firebase.bacteria-game-remote.json --project=bacteria-game-remote --only functions:bacteria --force --non-interactive`
once. In [run 42348992065](https://github.com/WolfSoko/wol-sok-mono/actions/runs/42348992065)
18 of 19 functions updated and only `deletePlayerReplays` failed on Google's
side; in [run 41641364172](https://github.com/WolfSoko/wol-sok-mono/actions/runs/41641364172)
the API answered `rankProgress`'s update with an HTML page. Each time the
non-cdk leg of `deploy.yml` failed, no `-non-cdk-deployed` tag was set and a
bug issue opened that the next release healed.

## Non-goals

- No retry for the other Firebase deploys (`pacetrainer`, `rollapolla-analog`,
  `bacteria-game-remote` hosting): no transient failure of theirs is on
  record. The runner is generic, so they can adopt it later.
- No retry at the workflow level (`deploy.yml`): rerunning `nx affected -t deploy`
  would redeploy every affected app, not only the failed one.
- No parsing of firebase-tools' output to tell transient from real errors.

## Decisions

- **One retry of the whole command, after a pause of 30 s.** firebase-tools
  skips functions whose source is unchanged, so the second run updates only
  what the first left behind. A real error (a broken build, a rejected
  config) fails both runs and still fails the release; it costs one extra
  run. 30 s lets a short API hiccup pass without stretching the deploy much.
  Rejected: several retries with backoff (hides longer outages, doubles a
  real failure's time again for nothing); matching error texts (firebase-tools
  printed no detail in #2830, so there was nothing to match).
- **A small runner script, `apps/bacteria-wars-functions/deploy/retry-once.ts`,
  run with `tsx`**, which takes the command after its own path and runs it
  with inherited output. The retry decision is a pure function
  (`runWithOneRetry(run, { pause, log })`) with the process start and the
  pause passed in, so its spec runs in milliseconds. It lives in the app,
  outside `src/` (not bundled: `build` leaves `deploy/**` out of its inputs), and its spec runs
  with the app's Jest `test` target, so CI covers it.
  Rejected: an `.mjs` in `tools/firebase/` with `node --test`
  (`grant-admin.test.mjs`): no CI target runs it.
- **No retry after a signal** (a cancelled job): the runner stops and exits
  with `128 + signal number`, as a shell does.
- **A retried attempt is visible**: the failed first attempt prints a
  GitHub `::warning::` line naming the exit code, so a healed transient
  error shows in the run's annotations instead of vanishing.
- **Release type `fix(bacteria-wars-functions)`**: it changes how the app
  deploys, and the release it cuts deploys the functions through the new
  runner, which is the live check.

## Acceptance

1. `bacteria-wars-functions:deploy` runs the same `firebase deploy` command
   through `deploy/retry-once.ts`.
2. First run succeeds: one run, exit code 0, no retry.
3. First run fails, second succeeds: two runs with one 30 s pause between
   them, a warning naming the first exit code, exit code 0.
4. Both runs fail: two runs, the runner exits with the second run's code and
   says that both attempts failed.
5. A run ended by a signal is not retried and exits with `128 + signal`.
6. The runner without a command exits with a usage error (code 2) and runs
   nothing.
7. `npx nx run-many -t test,lint -p bacteria-wars-functions` passes, the new
   spec included; `CLAUDE.md`'s description of the target names the runner.
8. After the merge, the release's non-cdk deploy runs
   `bacteria-wars-functions:deploy` through the runner and succeeds.

## Open questions

None.
