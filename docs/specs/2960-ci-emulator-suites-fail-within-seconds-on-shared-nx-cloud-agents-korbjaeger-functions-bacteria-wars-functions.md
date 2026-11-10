# Spec #2960: CI: emulator suites fail within seconds on shared Nx Cloud agents

Issue: [#2960](https://github.com/WolfSoko/wol-sok-mono/issues/2960).

## Finding

The Nx Cloud task logs need a login, so the cause was reproduced locally.

- Every emulator suite (`test-emulator` of `bacteria-game-remote`,
  `bacteria-wars-functions`, `korbjaeger`, `korbjaeger-functions`) and every
  e2e emulator server (`bacteria-game-remote:firebase-emulators`,
  `korbjaeger:emulatoren`) already has ports and a project id of its own, so
  ports and the hub locator do not clash.
- The workers' launch template (`.nx/workflows/workers.yml`) installs a JVM but
  never downloads the emulators. The Firebase CLI downloads
  `cloud-firestore-emulator-v<version>.jar` (136 MB) into
  `~/.cache/firebase/emulators/` the first time a task on a fresh worker needs
  it: to a temporary file first, then with a plain, non-atomic copy into place.
- A second emulator task starting on the same worker during that copy finds the
  jar present (`fs.existsSync`), skips the download and starts Java on a
  partial file. Reproduced: with the jar cut at the size a concurrent download
  left it (4.5 MB of 136 MB), `korbjaeger-functions:test-emulator` fails in
  1.4 s with "Firestore Emulator has exited with code: 1", before any test, as
  in run 42647719867 (1 s). Run 42635871764's `bacteria-wars-functions` (5 s)
  shared its worker with two other emulator suites.
- `.nx/ci-config.yaml`'s `stop-after` lists the targets after which the workers
  are released, and says to keep it equal to the `nx affected -t` call; it
  lacks `typecheck-specs`, `typecheck-tools` and `test-emulator`, so a run whose last tasks are of those targets may lose its
  workers while they still run.

## Goal

No emulator task on an Nx Cloud worker ever starts on a partial emulator
download, and the workers stay until every target of the CI call is done.

## Non-goals

- New ports or hubs per suite: they are separate already.
- `parallelism: false` on `test-emulator`: it would hide the race only for
  that target (the e2e servers download the same jar) and slow CI.
- A start retry: it would mask the cause and still fail on a corrupt jar.
- The GitHub-hosted runner of `ci-cd.yml`: it only coordinates; the tasks run
  on the workers.

## Decisions

1. **Download the emulators once, in the workers' init steps**, after
   `npm install` (so the Firebase CLI of `package-lock.json` picks the jar
   versions): `npx firebase setup:emulators:firestore` and
   `npx firebase setup:emulators:database` (the Realtime Database emulator of
   `firebase-emulators` is a jar too) and `npx firebase setup:emulators:ui`
   (a zip the CLI fetches for every config that does not switch the UI off,
   such as `rollapolla-analog:auth-emulator`'s). The init steps run before the worker
   takes any task, so no two downloads overlap. The Auth emulator needs no
   download.
2. **Sync `stop-after` with the CI call**: add `typecheck-specs`,
   `typecheck-tools` and `test-emulator`.
3. **A spec keeps both in step** (`tools/ci/nx-cloud-workers.test.mjs`, named like `tools/firebase/grant-admin.test.mjs` so the wider target of [#2955](https://github.com/WolfSoko/wol-sok-mono/issues/2955) picks it up,
   `node --test`, a new `test` target on the project `tools`, like
   `oxlint-workspace-rules`): every downloadable emulator (`firestore`,
   `database`, `pubsub`, `storage`, `dataconnect`) named in an `emulators`
   block of a Firebase config in the repo has its `setup:emulators:<name>`
   in `workers.yml` after `npm install`, and `stop-after` holds exactly the
   targets of the `nx affected -t` call in `ci-cd.yml`. Plain text checks, no
   YAML parser: the workspace declares none.
4. CLAUDE.md's Testing section says where the emulators are downloaded and
   that a new emulator gets its step there.

## Acceptance

1. `workers.yml` downloads the Firestore and Database emulators and the
   Emulator UI in an init step after `npm install`.
2. `ci-config.yaml`'s `stop-after` equals the targets of `ci-cd.yml`'s
   `nx affected -t` call.
3. `npx nx test tools` passes, and fails when a step or a target is removed.
4. All four `test-emulator` targets pass locally.
5. CI on the PR is green, its emulator suites included.

## Open questions

None.
