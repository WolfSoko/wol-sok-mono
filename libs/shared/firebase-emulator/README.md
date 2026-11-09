# shared-firebase-emulator

Helpers for specs that run against the Firebase emulators (`test-emulator`
targets, `*.emulator.ts`), shared by `bacteria-wars-functions`,
`korbjaeger-functions` and `korbjaeger`. Test code only: no app or function
imports it outside its specs.

- `emulatorEnv(name)`: a variable `firebase emulators:exec` sets, with an
  error naming `test-emulator` where it is missing.
- `rulesTestEnvironment(projectId, firestore, rules)`: a project on the
  Firestore emulator under `rules`, with the denials the specs expect kept
  out of the log.

Run its specs with `npx nx test shared-firebase-emulator`.
