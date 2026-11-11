# Spec #2946: Share the one-retry deploy helper between the Firebase function deploys

Issue: [#2946](https://github.com/WolfSoko/wol-sok-mono/issues/2946), found by
`/simplify` on [PR #2943](https://github.com/WolfSoko/wol-sok-mono/pull/2943)
([#2912](https://github.com/WolfSoko/wol-sok-mono/issues/2912)). The helper
came with [#2838](https://github.com/WolfSoko/wol-sok-mono/issues/2838).

## Goal

A single transient error of Google's API no longer fails a release in any of
the three Firebase function deploys: `bacteria-wars-functions:deploy`,
`korbjaeger:deploy` and `korbjaeger-functions:deploy` all run their Firebase
CLI calls through one shared retry helper in `tools/`. And no target input
names a workspace file that does not exist, starting with
`{workspaceRoot}/jest.preset.js` (the file is `jest.preset.cjs`).

## Non-goals

- No change to what each deploy deploys, its `--only` list or its order.
- `pacetrainer`, `rollapolla-analog` and the game's hosting deploy
  (`bacteria-game-remote:deploy`) keep their commands; the issue names the
  three function deploys. Wrapping them is a follow-up for the manager.
- No change to the retry's behaviour (one retry after 30 s, no retry after a
  signal or a command that cannot start, `::warning::`/`::error::` lines).

## Decisions

- **The helper becomes the nested project `tools-deploy` (`tools/deploy/`).**
  CLAUDE.md gives a module of `tools/` used by apps a project of its own
  (`tools-federation`, `tools-vite`), so a change to it is not a change to
  every script of `tools`. It moves unchanged (`run-with-one-retry.ts`,
  `retry-once.ts`, both specs) with `git mv`; the project gets a Jest `test`
  target, as the specs ran in `bacteria-wars-functions:test` before. Its specs
  import Jest's globals from `@jest/globals`, so `tools:typecheck-tools`
  (all of `tools/**/*.ts`, types `node` only) checks them too.
- **Deploys reference it by path in their command** (`tsx
  tools/deploy/retry-once.ts …`). Nx draws no dependency from a command, so a
  change to the helper redeploys no app; nothing it changes reaches what is
  deployed.
- **Every Firebase CLI call of the three deploys is wrapped**, the
  `functions:artifacts:setpolicy` calls included: they call the same API and
  are idempotent (`--force`), so a hiccup there failed a release just as well.
  The build-mode check of `korbjaeger:deploy` is not wrapped: it fails for a
  real reason only.
- **`korbjaeger:deploy` calls the Firebase CLI itself** (`firebase
  --config=firebase.korbjaeger.json --project=korbjaeger …`) instead of `nx
  run korbjaeger:firebase …`, as both functions' deploys do: a retried nested
  `nx run` would also retry Nx's own failures, and CLAUDE.md records a nested
  run of a Firebase task failing a release. The `firebase` target stays for
  manual use. Its `firebase-deploy.spec.ts` asserts the new commands.
- **A guard keeps file inputs real.** `tools/ci/target-inputs.test.mjs`
  (`npx nx test tools`) fails on any string input `{workspaceRoot}/<path>`
  without glob characters, in a `project.json`, `nx.json`'s `targetDefaults`
  or `namedInputs`, whose file does not exist. The `{projectName}` check of
  `deploy-inputs.test.mjs` moves there, as it is about all target inputs, not
  deploys. Today it finds `jest.preset.js` in `nx.json` (`test`,
  `@nx/jest:jest`), `bacteria-game-remote`, `bacteria-wars-functions` and
  `feat-lazy-bacteria-game`; all become `jest.preset.cjs`.
- **CLAUDE.md** names the shared helper where it described the bacteria one,
  and the Korbjäger deploys use it.

## Acceptance

1. `tools/deploy/` holds the helper and its specs; `apps/bacteria-wars-functions/deploy/` is gone.
2. `npx nx test tools-deploy` runs both specs green.
3. `bacteria-wars-functions:deploy`, `korbjaeger:deploy` and
   `korbjaeger-functions:deploy` run each Firebase CLI call through
   `tsx tools/deploy/retry-once.ts`.
4. `korbjaeger`'s `firebase-deploy.spec.ts` and `korbjaeger-functions`'
   `config.spec.ts` pass with the new commands.
5. `npx nx test tools` passes, and fails when an input names a missing file
   (checked once by hand with a broken input).
6. No input in the workspace names `jest.preset.js`.
7. `npx nx affected -t lint,lint-templates,test,typecheck-tools` passes.

## Open questions

None.
