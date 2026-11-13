# CI: fail fast in the workers' "Install necessary binaries" init step

Issue: [#3067](https://github.com/WolfSoko/wol-sok-mono/issues/3067). Related: [#2974](https://github.com/WolfSoko/wol-sok-mono/issues/2974), [#2960](https://github.com/WolfSoko/wol-sok-mono/issues/2960).

## Goal

Every inline `script:` init step of the Nx Cloud workers (`.nx/workflows/workers.yml`) stops on its first failing command, so a failed `apt-get` (say of the JDK the Firestore emulator needs) or `npm install` fails the worker's setup where it happens instead of showing up later as an emulator or e2e failure.

## Non-goals

- No change to which packages are installed or to the reusable steps (`uses:`), whose scripts Nx Cloud maintains.
- No YAML parser in the workspace; the guard stays a plain text check.

## Decisions

- **POSIX `set -eu`, not `set -euo pipefail`.** Nx Cloud documents neither the shell nor fail-fast for inline scripts; under `dash` the `set -o pipefail` line itself fails and would fail every worker start. No script pipes, so `pipefail` adds nothing. Same reasoning as #2974's "Download the Firebase emulators".
- **"Install Node Modules" gets it too.** Its only command is `npm install`, so the step's result already is that command's; `set -eu` costs nothing and keeps one rule for every inline script, which the guard can then check without exceptions.
- **The guard covers every inline script, not a list of step names.** `tools/ci/nx-cloud-workers.test.mjs` checks that each init step with `script:` starts it with `set -eu`, so a new inline step cannot slip in without it. The existing check that every emulator download runs in the download step stays.

## Acceptance

1. "Install necessary binaries", "Install Node Modules" and "Download the Firebase emulators" each start their script with `set -eu`.
2. `npx nx test tools` fails when an inline init step's script does not start with `set -eu`, naming the step, and passes on the template as committed.
3. The Nx Cloud workers of the PR's CI run start and the CI run is green.

## Open questions

None.
