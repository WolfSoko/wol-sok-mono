# Input guard and deploy retry: three small gaps from the #2946 review

Issue: [#3051](https://github.com/WolfSoko/wol-sok-mono/issues/3051). Related: [#2946](https://github.com/WolfSoko/wol-sok-mono/issues/2946) (PR [#3048](https://github.com/WolfSoko/wol-sok-mono/pull/3048)), [#3034](https://github.com/WolfSoko/wol-sok-mono/issues/3034), [#2955](https://github.com/WolfSoko/wol-sok-mono/issues/2955).

## Goal

1. The target-input guard (`tools/ci/target-inputs.test.mjs`) also catches a `{projectRoot}/<file>` input and a `fileset` input that names a missing file, so a typo such as korbjaeger's `{projectRoot}/firestore.rules` no longer passes silently.
2. The guard runs on every CI run, so renaming a file that an input names fails the PR that renames it, not some later PR that touches a `project.json` or `nx.json`.
3. `tools/deploy/retry-once.ts` does not start the retry when the job was cancelled during the pause before it.

## Non-goals

- No change to the retry's pause, its count, or how a signal or a start error ends the first attempt (#2946's spec froze them).
- `{projectRoot}` inputs in `nx.json` (`targetDefaults`, `namedInputs`) stay unchecked: they resolve per project that uses them, and a default can name a file only some projects have.
- Glob and negated inputs stay unchecked, as now.
- Hosting deploys without the retry (#3034) and a target for every `tools/**/*.test.mjs` (#2955) are their own issues.

## Decisions

- **`{projectRoot}` resolves against the folder of the `project.json` it is in.** That is the project root Nx uses for a `project.json` project, so the check needs no Nx graph and stays as fast as now.
- **A `fileset` object input is checked like a string input.** `{ "fileset": "…" }` is the object form of the same file pattern; other object inputs (`runtime`, `env`, `externalDependencies`, `dependentTasksOutputFiles`, `input`) name no workspace file and stay out. `stringInputs` in `workspace-projects.mjs`, which `deploy-inputs.test.mjs` also uses, keeps its meaning; the guard gets a helper of its own for the file patterns.
- **The guard also runs as a plain CI step, uncached.** Making `tools:test` see the rename is not enough: the rename makes only the renamed file's project affected, never `tools`, so `nx affected` would not run the guard at all. An implicit dependency of `tools` on every project would fix that but turn the dependency the other way round from what `tools` is for and rerun every `tools` test on each app change. Running `node --test tools/ci/target-inputs.test.mjs` in `ci-cd.yml`'s main job, next to the format and sync checks, costs well under a second (it reads the tracked `project.json` files and `nx.json`) and needs nothing but Node. The guard stays in `tools:test` too, for local runs. A check in the same test file keeps the CI step there.
- **The retry checks the cancel after the pause, inside `runWithOneRetry`.** `RetryDeps` gets `cancelledBy: () => NodeJS.Signals | null`; when it answers a signal after the pause, the run ends as a signal outcome (`::error::Deploy ended by <signal>, not retried.`, exit 128 + signal number) without a second attempt. The decision sits in the pure function so its spec covers it, and `retry-once.ts` only hands over its `cancelledBy`.

## Acceptance

1. `npx nx test tools` fails, naming the project file and target, when a `project.json` target input `{projectRoot}/<file>` names a file missing in that project's folder, and when a `fileset` input (`{workspaceRoot}/…` or `{projectRoot}/…`, no glob) names a missing file; it passes on the workspace as committed.
2. `.github/workflows/ci-cd.yml` runs `node --test tools/ci/target-inputs.test.mjs` as a step of its main job, uncached; `npx nx test tools` fails when that step is gone.
3. `runWithOneRetry` returns `128 + <signal number>` and starts no second attempt when `cancelledBy` reports a signal after the pause; its spec covers it. Without a cancel it behaves as before (existing specs green).
4. The PR's CI run is green, the new step included.

## Open questions

None.
