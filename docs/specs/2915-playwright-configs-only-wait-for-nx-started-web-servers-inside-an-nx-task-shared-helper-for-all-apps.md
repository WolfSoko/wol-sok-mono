# Spec #2915: Playwright configs only wait for Nx-started web servers inside an Nx task

Found on PR [#2911](https://github.com/WolfSoko/wol-sok-mono/pull/2911)
([#2873](https://github.com/WolfSoko/wol-sok-mono/issues/2873), part of
[#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861)).

## Goal

On an Nx Cloud agent, Nx stops continuous tasks between batches and starts them
again for the next batch, but the `e2e--wait-for-webserver` gate does not run
again. Playwright then finds a server still booting (the Firebase emulators are
slow), starts its own nested `nx run`, and that run exits on the taken ports:
"Process from config.webServer exited early".

Korbjäger fixed this in `apps/korbjaeger/e2e/server/`: inside an Nx task
(`NX_TASK_TARGET_PROJECT` set) its `webServer` command only waits for the URL.
Every other app that starts its servers through Nx targets gets the same fix,
from one shared helper.

## Non-goals

- `angular-examples` keeps its exception (CLAUDE.md, Testing): Playwright
  starts its server in CI with `reuseExistingServer: !CI`, and the inferred
  serve dependency did not render its page on the Nx Cloud workers. Changing
  that is its own investigation.
- `libs/features/lazy/bacteria-game` (GPU cross-check) has no server.
- No change to the Nx targets, ports, timeouts or the CI workflow.

## Decisions

- **A new lib `libs/shared/e2e-server`** (`@wolsok/shared-e2e-server`, tag
  `shared`, project `shared-e2e-server`): module boundaries forbid importing
  Korbjäger's helper across apps, and `shared` is a tag both `app` and `e2e`
  sources may depend on. It is a Node helper for Playwright configs, not an
  Angular lib, so it gets no test setup of Angular's.
- **Its API is Korbjäger's, in English:** `nxServer(target, url, { cwd,
  timeout }, env = process.env)` returns a `webServer` entry; outside an Nx task
  its command is `npx nx run <target>`, inside one `node
  libs/shared/e2e-server/src/wait-for-server.mjs <url> <timeout>`. The plugin
  reads the config outside any task, so it still infers the dependency from
  the `nx run` command.
- **The waiting script moves with it** (`abwarten.mjs` →
  `wait-for-server.mjs`), unchanged in behaviour: any status below 404 counts
  as up (as Playwright's own check), it stays up until Playwright ends it, and
  exits 1 after the timeout. It is plain `.mjs`, so `node` runs it without a
  build.
- **Korbjäger's own copy goes**, and its `e2e-server.spec.ts` moves into the
  lib's spec, so there is one helper and one spec.
- **Every target-started server uses it:** `bacteria-game-remote` (game and
  emulators), `rollapolla-analog` (dev server and Auth emulator),
  `pacetrainer`, `fourier-analysis-remote`, `ws-thanos-test-app` and
  `korbjaeger`.

## Acceptance

1. `nxServer` returns `npx nx run <target>` without `NX_TASK_TARGET_PROJECT`
   and the waiting command with it; `reuseExistingServer` is `true`, `cwd` and
   `timeout` pass through (lib spec).
2. The waiting script waits for a server that comes up late and stays up, and
   exits 1 with "No server answered" where none answers in time (lib spec).
3. Every Playwright config named above takes its `webServer` entries from
   `nxServer`; `angular-examples` is unchanged.
4. Nx still infers each app's server targets as dependencies of its `e2e` /
   `e2e-ci--*` tasks (`nx show project <app>` lists them as before).
5. Inside an Nx task the configs only wait: an e2e run of one app through Nx
   passes locally (Korbjäger or pacetrainer).
6. `apps/korbjaeger/e2e/server/` is gone; CLAUDE.md's Testing section names the
   shared helper.
7. Lint, lint-templates, tests and format checks of the affected projects pass.

## Open questions

None.
