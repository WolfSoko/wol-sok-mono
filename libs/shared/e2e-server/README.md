# shared-e2e-server

`nxServer(target, url, { cwd, timeout })` builds a Playwright `webServer`
entry for a server an Nx target runs (`npx nx run app:serve-e2e`):

- Run by hand, Playwright starts the target where nothing answers at `url` yet
  (`reuseExistingServer: true`).
- Inside an Nx task (`NX_TASK_TARGET_PROJECT` set), Nx already runs the target
  as a continuous dependency, so the command only waits for `url`
  (`src/wait-for-server.mjs`). Nx stops and restarts continuous tasks between
  the batches of an Nx Cloud agent; a second start from Playwright would fail
  on the taken ports ("Process from config.webServer exited early").

`@nx/playwright` reads the config outside any task, so it still infers the
dependency on the target from the `nx run` command.

So a target that runs Playwright must depend on its servers: the inferred
`e2e` and `e2e-ci--*` targets do. A hand-written target without that
`dependsOn` only waits inside its task, and fails after `timeout` with "No
server answered".

`npx nx test shared-e2e-server` runs its spec (Jest).
