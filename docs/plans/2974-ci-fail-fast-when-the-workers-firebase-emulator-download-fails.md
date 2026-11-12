# Plan #2974: CI: fail fast when the workers' Firebase emulator download fails

Spec: [docs/specs/2974-ci-fail-fast-when-the-workers-firebase-emulator-download-fails.md](../specs/2974-ci-fail-fast-when-the-workers-firebase-emulator-download-fails.md)

## Task 1: the workers spec asks for fail-fast (red)

- File: `tools/ci/nx-cloud-workers.test.mjs`
- Add a helper that returns the executable lines of the init step named
  "Download the Firebase emulators" (from its `- name:` line to the next
  `- name:`), and a test that its first command is `set -euo pipefail`, with
  every `npx firebase setup:emulators:` line after it.
- Run `npx nx test tools`: the new test fails on today's template.

## Task 2: the step fails fast (green)

- File: `.nx/workflows/workers.yml`
- Put `set -euo pipefail` first in the step's script; extend the comment
  above the step with why (a failed download would otherwise pass the step
  and leave the jar to the first task).
- Run `npx nx test tools` (green), check once by deleting the line locally
  that the test goes red, `npx nx format:write`,
  `npx nx affected -t lint,lint-templates`.
- Commit: `fix(tools): fail the workers' emulator download step on the first error`
  with spec, plan, spec file and template.
