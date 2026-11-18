# Typecheck coverage: spec typecheck for the other Jest projects, and the inferred typecheck targets CI never runs

Issue: [#2822](https://github.com/WolfSoko/wol-sok-mono/issues/2822)

## Goal

Every spec in the workspace is type-checked in CI, and every `typecheck` target Nx infers runs in
CI, so a fake or a call in a spec can no longer drift from the real types unnoticed, and an app's or
lib's own type errors fail the PR that makes them.

## Where it stands (measured on `main` at 74.172.5)

Since the issue was written, 14 projects got a `typecheck-specs` target (the game lib, the engine,
the admin, the rendering and sound libs, Korbjäger and its libs, `korbjaeger-functions`,
`nx-aws-cdk-v2`, `utils-browser-storage`, `shared-firebase-emulator`). Of the 50 projects with a
`test` target and without one, 47 have a `tsconfig.spec.json`; `tsc -p <project>/tsconfig.spec.json
--noEmit` passes on 41 of them and fails on six:

| Project | Errors | Cause |
| --- | --- | --- |
| `angular-examples` | 1 | `src/environments/version-tag.generated.ts` is written by its `generate-version` target and absent before it ran |
| `bacteria-game-remote` | 3 | `error-reports.spec.ts` names `Sentry.Integration`, which `@sentry/angular` no longer exports |
| `shared-data-access` | 1 | `vite.config.ts` reads `process.env.NX_TASK_TARGET_CONFIGURATION` with a dot (`noPropertyAccessFromIndexSignature`) |
| `spa-cdk-stack` | 2 | `stack-spa.spec.ts` types `findResources`' answer narrower than it is |
| `utils-version` | 1 | `tsconfig.spec.json` lacks `resolveJsonModule`, which `src/version.ts` needs for `version.json` |
| `ws-thanos` | 3 | `snap-sound.service.spec.ts` reads `mock.calls` of `jest.fn(() => this)`, typed as calls without arguments |

The three without a `tsconfig.spec.json` (`tools`, `oxlint-workspace-rules`,
`federation-shared-singletons`) run `node --test` on scripts: `tools` has `typecheck-tools`, the
others test `.mjs` files.

The inferred `typecheck` targets (`@nx/vite`'s `tsc --noEmit -p tsconfig.app.json`/`tsconfig.lib.json`)
exist on eight projects today: `pacetrainer`, `rollapolla-analog`, `korbjaeger`,
`feat-korbjaeger-answers`, `feat-korbjaeger-selection`, `shared-analytics`, `shared-data-access`
and `spa-cdk-stack`. All eight pass (`nx run-many -t typecheck --skip-nx-cache`). CI's
`nx affected -t …` list in `ci-cd.yml` does not name `typecheck`, so none of them runs there.

## Non-goals

- No `typecheck-specs` for projects without a `tsconfig.spec.json` (the `tools` scripts and the
  `.mjs`-only projects): `tools` is covered by `typecheck-tools`, the rest have no TypeScript specs.
- No change to a published package's compiler targets (`libs/public/*`): only their specs are fixed.
- No new `typecheck` targets beyond what `@nx/vite` infers, and no move of the libraries' build
  `tsc` into a check.
- No type-aware lint changes.

## Decisions

1. **Add `typecheck` to CI rather than drop the inferred targets.** They are cheap (one `tsc
   --noEmit`, cached), already green, and the only check of the Vite apps' sources outside their
   build; dropping them would leave `pacetrainer`'s and `rollapolla-analog`'s app sources to the
   Analog build alone, which does not type-check (esbuild). `typecheck` goes into the `nx affected
   -t` call of `ci-cd.yml` and into `stop-after` of `.nx/ci-config.yaml` (which
   `tools/ci/nx-cloud-workers.test.mjs` keeps equal).
2. **Every project with a `test` target and a `tsconfig.spec.json` gets `"typecheck-specs": {}`**,
   the one-line target whose command, inputs and caching are `nx.json`'s `targetDefaults`. All of
   them, not a chosen few: 41 are green already, and the rule "a spec project typechecks its specs"
   is easier to keep than a list of exceptions.
3. **A guard keeps it so.** A new `tools/ci/typecheck-specs.test.mjs` (run by `npx nx test tools`)
   fails on a `project.json` whose project has a `test` target and a `tsconfig.spec.json` but no
   `typecheck-specs` target, so a new project cannot slip out of the check. It reads the
   `project.json` files, as `deploy-inputs.test.mjs` does, not the Nx graph, so it stays fast and
   needs no daemon.
4. **Specs follow the types, as in #2815**; configuration follows the sources:
   - `bacteria-game-remote`: the spec takes the integration type from what `sentryOptions` declares
     (its `integrations` parameter), not from a named export that moved.
   - `spa-cdk-stack`: the spec types the resources as `findResources` returns them.
   - `ws-thanos`: the fake's chainable `jest.fn`s declare their parameters, so `mock.calls` carries
     them.
   - `shared-data-access`: `process.env['NX_TASK_TARGET_CONFIGURATION']`, as the other Vite configs
     write it.
   - `utils-version`: `resolveJsonModule` in its `tsconfig.spec.json`, as its lib config has it
     through the base.
   - `angular-examples`: its `typecheck-specs` depends on its `generate-version` target
     (`dependsOn`), as its build does, so the generated file exists when `tsc` runs.
5. **`CLAUDE.md`'s Testing section** says the new rule (every spec project, the guard) and that CI
   runs `typecheck` too, replacing "a project whose specs must typecheck gets…".

## Acceptance

1. `npx nx run-many -t typecheck-specs --skip-nx-cache` passes, and lists every project with a
   `test` target and a `tsconfig.spec.json`.
2. `npx nx run-many -t typecheck --skip-nx-cache` passes.
3. `ci-cd.yml`'s `nx affected -t` call and `.nx/ci-config.yaml`'s `stop-after` both name
   `typecheck`; `npx nx test tools` passes.
4. `tools/ci/typecheck-specs.test.mjs` fails when one such project's `typecheck-specs` target is
   removed (checked by hand once) and passes on the branch.
5. The specs of the six fixed projects still pass (`nx test` of each).
6. `CLAUDE.md` describes the rule and the CI target.
7. CI on the PR is green.

## Open questions

None.
