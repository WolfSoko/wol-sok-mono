# Plan #2960: CI: emulator suites fail within seconds on shared Nx Cloud agents

Spec: `docs/specs/2960-ci-emulator-suites-fail-within-seconds-on-shared-nx-cloud-agents-korbjaeger-functions-bacteria-wars-functions.md`.

1. **Spec first.** `tools/ci/nx-cloud-workers.test.mjs` (`node --test`) and a
   `test` target on `tools/project.json` (inputs: the spec, `.nx/workflows/`,
   `.nx/ci-config.yaml`, `.github/workflows/ci-cd.yml`, the Firebase configs).
   It fails on `main` (no download step, `stop-after` short).
2. **Fix.** Init step "Download the Firebase emulators" in
   `.nx/workflows/workers.yml` after "Install Node Modules"; the missing
   targets in `.nx/ci-config.yaml`'s `stop-after`. The spec passes.
3. **Docs.** CLAUDE.md, Testing: one line on the download step.
4. Checks: `nx test tools`, `nx lint tools`, the four `test-emulator` targets,
   `nx format:check`. One commit `fix(tools): ...` with spec, plan and code;
   PR to `main`, `Closes #2960`.
