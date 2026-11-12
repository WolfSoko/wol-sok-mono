# Spec #2974: CI: fail fast when the workers' Firebase emulator download fails

Issue: [#2974](https://github.com/WolfSoko/wol-sok-mono/issues/2974). Found by
CodeRabbit on [PR #2973](https://github.com/WolfSoko/wol-sok-mono/pull/2973)
([#2960](https://github.com/WolfSoko/wol-sok-mono/issues/2960)).

## Goal

The Nx Cloud workers' init step "Download the Firebase emulators"
(`.nx/workflows/workers.yml`) fails as soon as one of its
`npx firebase setup:emulators:<name>` commands fails, so a worker never starts
tasks without the jars and the race of #2960 (an emulator task starting Java
on a partially copied jar) cannot come back unnoticed.

## Non-goals

- The other inline `script` steps of the template ("Install necessary
  binaries", "Install Node Modules"). The first runs several `apt-get`
  commands without `set -e` too; that goes to the manager as a follow-up.
- Retrying a failed download. A failed init step fails the worker's start
  visibly, which is what the issue asks for.

## Decisions

- **`set -eu` as the script's first line**, rather than `&&` between the
  commands or a check after each. Nx Cloud's launch template reference
  documents `init-steps[*].script` as an inline script but neither its shell
  nor how it treats a failing line, so the step must not rely on the runner
  using `-e`. POSIX `set -eu`, not `set -eu`: should the shell be
  dash, `-o pipefail` would stop every worker on the `set` line itself, and
  the script has no pipe. A `set` line holds for every command added below it, which the
  workers spec already asks to be added whenever a Firebase config uses a new
  downloadable emulator.
- **`tools/ci/nx-cloud-workers.test.mjs` guards it**: the step that runs the
  downloads starts with `set -eu`, and every download command of the
  template sits in that step, so none slips into a step without it. Text
  checks as the spec already does (no YAML parser in the workspace): the
  step's `script` block is read from the line after
  `- name: Download the Firebase emulators` up to the next `- name:`.

## Acceptance

1. The script of "Download the Firebase emulators" starts with
   `set -eu`.
2. `npx nx test tools` fails when that line is missing or comes after a
   download command, or when a download runs in another step, and passes
   otherwise.
3. Every emulator a Firebase config uses is still downloaded after
   `npm install` (the existing check stays green).
4. The comment above the step says why the script fails fast.

## Open questions

None.
