# reaction-diffusion-kernels: tsconfig.json references a tsconfig.spec.json that does not exist

Issue: [#3143](https://github.com/WolfSoko/wol-sok-mono/issues/3143)

## Goal

`libs/features/reaction-diffusion-kernels/tsconfig.json` (project `feat-shared-reaction-diffusion-kernels`) references `./tsconfig.lib.json` and `./tsconfig.spec.json`. The lib has no `tsconfig.spec.json`, no specs and no `test` target, so TypeScript and tsgolint skip the dangling reference with an error, and the [#3133](https://github.com/WolfSoko/wol-sok-mono/issues/3133) guard (`tools/ci/script-tsconfig.test.mjs`) silently treats it as owning nothing.

Drop the dangling reference, and fail CI on the next one, so a config naming a file that is gone is caught where it is made, not found by chance.

## Non-goals

- Adding specs or a `test` target to the lib.
- Other tsconfig hygiene (`extends`, `include` globs that match nothing).

## Decisions

- **Drop the `./tsconfig.spec.json` reference** rather than create an empty spec config: the lib has nothing to test, and an empty `tsconfig.spec.json` would also give it a `typecheck-specs` target ([#3131](https://github.com/WolfSoko/wol-sok-mono/issues/3131)) checking no file.
- **Guard in `tools/ci/script-tsconfig.test.mjs`**, as a second `describe`: every tracked `tsconfig*.json` resolves each of its `references` to an existing config (`ts.resolveProjectReferencePath`, as the guard's `ownedFiles` already resolves them); the failure lists `<config> → <missing reference>`. That file is the one place where references are followed, and CI already runs it on every run as the uncached step "Scripts belong to their tsconfig": a lib's tsconfig change makes only that lib affected, never `tools`, so a guard run only by `nx test tools` would miss it. A new file of its own would need a CI step of its own for the same reason; one step suffices.
- **Shipped alone.** The issue proposed piggybacking on [#3131](https://github.com/WolfSoko/wol-sok-mono/issues/3131) to avoid an extra release, but [#3131](https://github.com/WolfSoko/wol-sok-mono/issues/3131) is merged. Measured on `main` (53108c3a), `node tools/ci/release-affected.mjs --files=libs/features/reaction-diffusion-kernels/tsconfig.json`: `--target=build --projects='tag:published'` selects nothing (no package bump); `--target=deploy` keeps `angular-examples-cdk` and `portfolio-cdk`, only because CDK `deploy` targets declare no inputs ([#3142](https://github.com/WolfSoko/wol-sok-mono/issues/3142)). Their redeploy ships unchanged output and is harmless; the manager chose to ship now rather than wait for [#3142](https://github.com/WolfSoko/wol-sok-mono/issues/3142).

## Acceptance

1. `libs/features/reaction-diffusion-kernels/tsconfig.json` references only `./tsconfig.lib.json`.
2. `node --test tools/ci/script-tsconfig.test.mjs` passes, and fails (naming the config and the reference) when the dangling reference is put back.
3. `npx nx build feat-shared-reaction-diffusion-kernels` and `npx nx lint feat-shared-reaction-diffusion-kernels` pass.
4. `npx nx test tools` passes.
5. `release-affected.mjs` on the branch's changes selects no published package for `build`, and for `deploy` no project beyond the two CDK stacks [#3142](https://github.com/WolfSoko/wol-sok-mono/issues/3142) explains.

## Open questions

None.
