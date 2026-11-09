# Deploy inputs of pacetrainer and rollapolla-analog miss their Firebase config

Issue: [#2904](https://github.com/WolfSoko/wol-sok-mono/issues/2904)

## Goal

A change to an app's root Firebase config (`firebase.<app>.json`) makes that app affected, so the next release redeploys it.

Today `apps/pacetrainer/project.json` and `apps/rollapolla-analog/project.json` name `{workspaceRoot}/firebase.{projectName}.json` as a `deploy` input. Nx interpolates `{projectName}` in commands, not in inputs, so the input matches no file: `nx show projects --affected --files=firebase.pacetrainer.json` gives only `wolsok` and `tools` (checked on 2026-11-09, same for `firebase.rollapolla-analog.json`). `bacteria-game-remote` has the same gap: its `deploy` has no inputs at all, so `firebase.bacteria-game-remote.json` reaches only `bacteria-wars-functions`, never the game's hosting deploy. `korbjaeger`, `korbjaeger-functions` and `bacteria-wars-functions` already name their config literally and are affected.

## Non-goals

- Moving `firebase-domain.ts` (in `bacteria-game-remote-cdk` and `korbjaeger-cdk`) into a shared infra lib, the issue's second point: a refactor of its own, raised as a follow-up instead.
- [#2888](https://github.com/WolfSoko/wol-sok-mono/issues/2888) (root config changes redeploying every app).
- `{projectName}` in commands, which Nx does interpolate.

## Decisions

- **Name the files literally** in each `deploy`'s inputs (`{workspaceRoot}/firebase.pacetrainer.json`, `{workspaceRoot}/firebase.rollapolla-analog.json`), as `korbjaeger` does. Reason: the only form Nx resolves.
- **Include `bacteria-game-remote`**: give its `deploy` the same inputs as the other hosting apps (`production`, `^production`, `{workspaceRoot}/firebase.bacteria-game-remote.json`, `{workspaceRoot}/.firebaserc`). Reason: same root cause; fixing only the two named apps would leave the defect class open, and the guard below would fail on it.
- **One workspace-wide guard, not one spec per app**: a `node:test` file `tools/ci/deploy-inputs.test.mjs`, run by `nx test tools` beside `nx-cloud-workers.test.mjs`. It reads every `project.json` and fails when
  1. any target's `inputs` holds `{projectName}` (Nx leaves it unresolved, so the input silently matches nothing), or
  2. a project whose targets pass a root `firebase.*.json` to the Firebase CLI (`--config=firebase.<x>.json` / `--config firebase.<x>.json`, with `{projectName}` resolved to the project's name) has a `deploy` target that does not list `{workspaceRoot}/firebase.<x>.json` in its inputs.
     Reason: a static check runs in milliseconds and needs no project graph; the `tools` test already takes every `*.json` as input, so a change to any `project.json` reruns it. Emulator-only configs under `apps/` (`--config apps/...`) are project files and need no input.
- **Document the rule** in `CLAUDE.md` (Testing, next to the Nx Cloud workers check), so a new Firebase app names its config literally.

## Acceptance

1. `npx nx show projects --affected --files=firebase.pacetrainer.json` lists `pacetrainer`.
2. `npx nx show projects --affected --files=firebase.rollapolla-analog.json` lists `rollapolla-analog`.
3. `npx nx show projects --affected --files=firebase.bacteria-game-remote.json` lists `bacteria-game-remote` (and still `bacteria-wars-functions`).
4. `npx nx show projects --affected --files=firebase.korbjaeger.json` still lists `korbjaeger` and `korbjaeger-functions`.
5. `npx nx test tools` passes, and fails when a `deploy` input goes back to `firebase.{projectName}.json` or the literal input is removed (checked by hand once).
6. `CLAUDE.md` names the rule and the check.

## Open questions

None.
