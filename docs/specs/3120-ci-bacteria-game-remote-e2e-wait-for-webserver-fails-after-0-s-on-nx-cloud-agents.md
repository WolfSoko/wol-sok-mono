# Spec: the e2e readiness gate goes missing on Nx Cloud workers (#3120)

## What happens

`bacteria-game-remote:e2e--wait-for-webserver` fails after 0 s on an Nx Cloud
worker, and every `e2e-ci--*` task of the game ends with "Dependencies failed".
The task log on Nx Cloud (run `PdjEiO2Lzb`, CI run 45036426145) says:

```
NX   Cannot find target 'e2e--wait-for-webserver' for project 'bacteria-game-remote'
```

So the worker's project graph lacks the gate that the main job's graph
scheduled. In all three failed runs checked (`EiwVr6KMbf`, `epXrwul8iO`,
`PdjEiO2Lzb`), `angular-examples:e2e-ci--e2e/home.spec.ts` had started on the
same worker shortly before. In `EiwVr6KMbf` the gate of `ws-thanos-test-app`
failed the same way on that worker.

## Root cause

1. `nxServer` (`libs/shared/e2e-server/src/lib/nx-server.ts`) gives Playwright a
   different `webServer.command` when `NX_TASK_TARGET_PROJECT` is set: the
   waiting script instead of `npx nx run <target>`.
2. `@nx/playwright/plugin` infers the serve dependencies and the gate from that
   command. A wait command names no Nx target, so it infers neither.
3. `angular-examples`' e2e lets Playwright start `npx nx run angular-examples:serve`
   inside its task (the exception in CLAUDE.md), and `tools:test` runs
   `npx nx show project …` (`release-affected.test.mjs`). That nested `nx` builds
   the project graph with `NX_TASK_TARGET_PROJECT` set (to `angular-examples` or
   `tools`). So every `nxServer` config reads as "inside a task", and the
   plugin infers no gate for any of them.
4. The plugin caches its result in `.nx/workspace-data/playwright-*.hash` under
   a key built from the file hashes and `hashDaemonClientEnv()`. That hash leaves
   `NX_TASK_TARGET_*` out on purpose. So the result without a gate is served to
   the worker's next graph, and the next batch asks for a target that no longer
   exists.

Reproduced locally (`NX_DAEMON=false`):

```
npx nx reset
NX_TASK_TARGET_PROJECT=angular-examples npx nx show project bacteria-game-remote --json  # no gate
npx nx show project bacteria-game-remote --json                                          # still no gate, no dependsOn
```

## Goal

Building the graph gives every `nxServer` config the same targets, whichever
task outside the project's own Playwright tasks the `nx` call is nested in. So
a nested `nx` call there can no longer drop the gate or the serve dependencies
from a worker's graph. Inside the project's own Playwright tasks no graph is
built (no `globalSetup`, no `nx` call in `e2e/`); CLAUDE.md keeps that as a
convention.

## Non-goals

- Moving `angular-examples` to `nxServer` (the documented exception: its page
  did not render on the workers with the inferred serve dependency). It is a
  separate change.
- Changing Nx's plugin cache key. That belongs upstream; raised as a follow-up.
- The flaky `online.spec.ts` ICE failures seen in the same runs.

## Decisions

- **Only wait inside a task of the server's own project's Playwright target.**
  `nxServer` takes the project from its `target` (`app:serve-e2e` → `app`). It
  returns the waiting script only when `NX_TASK_TARGET_PROJECT` is that project
  and `NX_TASK_TARGET_TARGET` is a Playwright target (`e2e`, `e2e-ci` or an
  atomized `e2e-ci--<file>`, but not the gates `e2e--wait-for-webserver` and
  `e2e-ci--wait-for-webserver` or `e2e-ci--merge-reports`). So the server's
  target has to belong to the project whose config names it. Any other task, and every nested graph build in
  them, gets `npx nx run <target>`. The plugin then infers the same targets
  there as in the main job.
  _Why:_ this is the smallest signal that tells "Playwright runs this config
  for its own tests" apart from "Nx reads it to build a graph inside some other
  task". Both target names come from `nx.json` (`targetName: "e2e"`, the
  default `ciTargetName`), and a spec reads `nx.json` to keep them equal.
- **No change to the plugin cache or to `nx.json`.** The fix keeps graph-time
  output independent of the surrounding task, so the cache key Nx uses is
  correct again for these configs.

## Acceptance

1. `nxServer` returns `npx nx run <target>` when `NX_TASK_TARGET_PROJECT`
   names another project, or names the project with a target that is not a
   Playwright target (unit specs).
2. `nxServer` returns the waiting script inside `e2e`, `e2e-ci` and
   `e2e-ci--<file>` tasks of its own project (unit specs).
3. After `npx nx reset`, `NX_TASK_TARGET_PROJECT=angular-examples
   NX_TASK_TARGET_TARGET=e2e-ci--e2e/home.spec.ts npx nx show project
   bacteria-game-remote --json` lists `e2e--wait-for-webserver`, and a following
   plain `nx show project` does too (checked by hand, noted in the PR).
4. The game's e2e still passes locally through `nx` (`nx run
   bacteria-game-remote:e2e` with the servers started by Nx).
5. CI on the PR is green. The gate no longer depends on which tasks share a
   worker.
6. CLAUDE.md's Testing section and the `nxServer` doc comment describe the new
   condition.

## Open questions

None.
