# Spec: bacteria-game-remote rules test on `rulesTestEnvironment` ([#2981](https://github.com/WolfSoko/wol-sok-mono/issues/2981))

## Goal

`apps/bacteria-game-remote/rules-test/firestore-rules.emulator.ts` sets up its
rules environment through `rulesTestEnvironment` from
`@wolsok/shared-firebase-emulator/rules`, like the Korbjäger app and
`korbjaeger-functions`, instead of its own `setLogLevel('silent')` and
`initializeTestEnvironment` call.

## Non-goals

- No change to what the rules test checks, to `firestore.rules`, or to the
  ports in `rules-test/firebase.json`.
- No other emulator spec moves (the rest already use the lib).

## Decisions

1. **The helper needs no change.** The issue asks to give
   `rulesTestEnvironment` an optional emulator address; it already has one
   since [#2945](https://github.com/WolfSoko/wol-sok-mono/issues/2945)
   (`firestore?: FirestoreEmulator`, without it the emulator
   `FIRESTORE_EMULATOR_HOST` names, which `firebase emulators:exec` sets).
   The rules test calls it without an address, as `korbjaeger-functions` does.
2. **The project id stays `demo-bacteria-rules`**, the one `test-emulator`
   passes to `firebase emulators:exec`.
3. **`CLAUDE.md` names the rules test among the lib's users**, so the list of
   users stays complete.

## Acceptance

- A1: the rules test imports neither `initializeTestEnvironment` nor
  `setLogLevel`; it calls `rulesTestEnvironment('demo-bacteria-rules', rules)`.
- A2: `npx nx run bacteria-game-remote:test-emulator` passes with as many
  tests as on `main`.
- A3: denials are still not logged (the output shows no `PERMISSION_DENIED`
  warnings from the SDK).
- A4: lint and format pass for the affected projects.

## Open questions

None.
