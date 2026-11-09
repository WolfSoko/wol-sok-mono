# shared-firebase-emulator

Helpers for specs that run against the Firebase emulators (`test-emulator`
targets, `*.emulator.ts`), shared by `bacteria-wars-functions`,
`korbjaeger-functions` and `korbjaeger`. Test code only: no app or function
imports it outside its specs.

- `emulatorEnv(name)`: a variable `firebase emulators:exec` sets, with an
  error naming `test-emulator` where it is missing.
- `firestoreEmulatorFromEnv()`: host and port of the Firestore emulator
  from `FIRESTORE_EMULATOR_HOST`, an IPv6 host included.
- `rulesTestEnvironment(projectId, firestore, rules)`, from its own entry
  `@wolsok/shared-firebase-emulator/rules` (it loads the Firebase web SDK):
  a project on the Firestore emulator under `rules`, with the denials the
  specs expect kept out of the log.

Every app whose specs import it depends on it in Nx, so a change here marks
those apps affected (accepted in #2945: the lib is small and rarely
changes).

Run its specs with `npx nx test shared-firebase-emulator`.
