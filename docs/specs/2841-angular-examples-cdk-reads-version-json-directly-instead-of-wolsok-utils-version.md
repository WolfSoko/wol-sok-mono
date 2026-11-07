# angular-examples-cdk reads version.json directly instead of @wolsok/utils-version

Issue: [#2841](https://github.com/WolfSoko/wol-sok-mono/issues/2841), found while reviewing
[PR #2839](https://github.com/WolfSoko/wol-sok-mono/pull/2839).

## Goal

`apps/angular-examples-cdk/src/main.ts` takes the workspace version from
`WORKSPACE_VERSION` (`@wolsok/utils-version`) instead of reading
`version.json` with `readFileSync(join(process.cwd(), 'version.json'))`. The
app then depends on `utils-version` in the project graph, so `version.json`
(the lib's `workspaceVersion` input) is an input of the app's tasks, and the
read no longer depends on the working directory.

## Non-goals

- The other `apps/*-cdk`: none of them reads `version.json`
  (`bacteria-game-remote-cdk`, `fourier-analysis-remote-cdk`, `portfolio-cdk`
  and `shader-examples-remote-cdk` take `RELEASE_VERSION` from the
  environment, as the release workflow sets it). Nothing to change there.
- The `version` tag of the stack keeps `envOrDie('RELEASE_VERSION')`.
- A lint rule that forbids reading `version.json` outside `libs/utils/version`
  (a `readFileSync` slips past the boundary rule). Raised as a follow-up.

## Decisions

- **Boundary tag.** `angular-examples-cdk` is tagged `infra`, which may only
  depend on `infra-shared`. `utils-version` gets the extra tag `infra-shared`
  rather than letting `infra` depend on every `utils` lib: the other utils
  (`gpu-calc`, `measure-fps`, `operators`, …) are browser or RxJS code a CDK
  app has no use for, while `utils-version` imports nothing and is safe in
  Node. Its `utils` constraint stays as it is.
- **No `typeof version !== 'string'` guard.** `WORKSPACE_VERSION` is typed
  `string` from the JSON import, and `version.spec.ts` checks the lib.
- **No new unit test.** `main.ts` is the CDK entry point with side effects
  (needs `RELEASE_VERSION` and the built `dist/apps/angular-examples`); the
  change is verified by a local synth (the version asset holds the version)
  and by the project graph edge.

## Acceptance

1. `apps/angular-examples-cdk/src/main.ts` imports `WORKSPACE_VERSION` from
   `@wolsok/utils-version`; no `readFileSync`, `node:fs` or `node:path` read of
   `version.json` is left.
2. `npx nx graph --file` shows the edge `angular-examples-cdk` → `utils-version`.
3. `npx nx lint angular-examples-cdk` and `npx nx lint utils-version` pass
   (module boundaries included).
4. A local synth (`RELEASE_VERSION=0.0.0-test npx tsx --tsconfig
   apps/angular-examples-cdk/tsconfig.app.json apps/angular-examples-cdk/src/main.ts`
   with a placeholder build output) succeeds, and the `version.json` asset in
   `cdk.out` holds the version from the root `version.json`.
5. No other `apps/*-cdk` reads `version.json` directly.

## Open questions

None.
