# Plan: bacteria-game-remote rules test on `rulesTestEnvironment` ([#2981](https://github.com/WolfSoko/wol-sok-mono/issues/2981))

Spec: [`docs/specs/2981-bacteria-game-remote-use-rulestestenvironment-from-shared-firebase-emulator-in-the-rules-test.md`](../specs/2981-bacteria-game-remote-use-rulestestenvironment-from-shared-firebase-emulator-in-the-rules-test.md)

1. **Baseline** — run `npx nx run bacteria-game-remote:test-emulator` on the
   branch before the change and note the test count (A2). No commit.
2. **Switch the rules test** — `apps/bacteria-game-remote/rules-test/firestore-rules.emulator.ts`:
   drop `initializeTestEnvironment` and `setLogLevel` from the imports, build
   `env` with `rulesTestEnvironment('demo-bacteria-rules', rules)` from
   `@wolsok/shared-firebase-emulator/rules`. `CLAUDE.md`: name the rules test
   among the lib's users. Check: `test-emulator` (same count, no denial
   logs), `nx format:write`, `nx affected -t lint,lint-templates`.
   Commit `refactor(bacteria-game-remote): rules test on rulesTestEnvironment (#2981)`.
