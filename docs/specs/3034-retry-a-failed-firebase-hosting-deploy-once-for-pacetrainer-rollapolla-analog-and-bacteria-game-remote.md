# Retry a failed Firebase Hosting deploy once for pacetrainer, rollapolla-analog and bacteria-game-remote

Issue: [#3034](https://github.com/WolfSoko/wol-sok-mono/issues/3034). Related: [#2946](https://github.com/WolfSoko/wol-sok-mono/issues/2946), [#2838](https://github.com/WolfSoko/wol-sok-mono/issues/2838), [#3073](https://github.com/WolfSoko/wol-sok-mono/issues/3073).

## Goal

`pacetrainer:deploy`, `rollapolla-analog:deploy` and `bacteria-game-remote:deploy` run their `firebase deploy` through `tools/deploy/retry-once.ts`, as the function deploys and `korbjaeger:deploy` do since #2946, so a single transient error of Google's API no longer fails their leg of a release.

## Non-goals

- No change to the helper itself (pause, count, signals) or to `check-live-index.ts`, which stays each deploy's last command.
- No change to what each deploy ships (`--only hosting,firestore,database` for the game; everything in its config for pacetrainer and rollapolla-analog).
- The `firebase` targets of the three apps stay as they are, for running the CLI by hand.
- Making `tools-deploy:test` rerun when an app's `project.json` changes is a separate topic (raised to the manager).

## Decisions

- **Each deploy calls the Firebase CLI directly, not through `nx run <app>:firebase`.** The helper wraps one command; wrapping `nx run …:firebase deploy` would retry a nested Nx run, which CLAUDE.md already names as the cause of failed function deploys (a second, nested run of `bacteria-game-remote:firebase` in the same release). The direct call is what the `firebase` target ran: `firebase --config=firebase.<app>.json --project=<app> deploy …` (the project is the `.firebaserc` alias, as before).
- **`--non-interactive`**, as in the other retried deploys: a prompt in CI would hang the retry.
- **Retrying a Hosting deploy is safe:** a Hosting release, Firestore rules and Realtime Database rules are set as a whole, and the `predeploy` installs rerun from scratch.
- **The check lives in `tools/deploy/deploy-targets.spec.ts`,** which already holds every Hosting deploy's last command (#3073): its next-to-last command is now exactly `tsx --tsconfig tools/tsconfig.tools.json tools/deploy/retry-once.ts firebase --config=firebase.<app>.json --project=<app> deploy[ …]`, and no command of a Hosting deploy runs `nx run`. Korbjäger's deploy already has that shape, so all four Hosting apps are held by one rule.

## Acceptance

1. The `deploy` targets of the three apps run `tsx --tsconfig tools/tsconfig.tools.json tools/deploy/retry-once.ts firebase --config=firebase.<app>.json --project=<app> deploy … --non-interactive` (the game with `--only hosting,firestore,database`), followed by the unchanged `check-live-index.ts` call; none runs `nx run`.
2. `npx nx test tools-deploy` fails when a Hosting deploy's next-to-last command is not that retried call, or when one of its commands runs `nx run`; it passes on the workspace as committed (korbjaeger included).
3. CLAUDE.md says that every Firebase Hosting deploy, not only the function deploys and Korbjäger's, runs its CLI call through the helper.
4. The PR's CI run is green; after the merge the release's `non-cdk` leg deploys whichever of the three apps it selects without error.

## Open questions

None.
