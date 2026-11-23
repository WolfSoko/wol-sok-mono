# Plan: caught `logger.warn` sites still bypass Sentry ([#3222](https://github.com/WolfSoko/wol-sok-mono/issues/3222))

Spec: [`docs/specs/3222-bacteria-wars-functions-caught-logger-warn-sites-still-bypass-sentry.md`](../specs/3222-bacteria-wars-functions-caught-logger-warn-sites-still-bypass-sentry.md).
One PR, `Closes #3222`. Checks before each commit: `npx nx format:write`,
`npx nx affected -t lint,test,typecheck-specs`, and before the PR
`npx nx run bacteria-wars-functions:test-emulator --output-style=static`.

1. **Level statistics report and never throw** —
   `replays/level-stats.ts`, `replays/level-stats.spec.ts`,
   `replays/accept.ts`. Test first: with a sink set, a fake Firestore whose
   `doc().set()` rejects, `countLevelStats` and `countRerun` resolve and the
   sink gets the error with each message. Then a private
   `addToStatsSafely(db, header, kind, counts, message)` wraps `addToStats`
   with `logCaughtError`; both counters go through it; `countSafely` in
   `accept.ts` goes, `acceptReplay` awaits `countLevelStats` directly.
   Commit `fix(bacteria-wars-functions): report failed level statistics to Sentry`.
2. **Gallery publish reports** — `gallery/feature-best.ts`,
   `gallery/gallery.emulator.ts`. Test first: `publishReplay` spied to
   reject once; the sink gets "Candidate failed to publish", the day is
   marked done. Then `logCaughtError('Candidate failed to publish', { id, error })`.
   Commit `fix(bacteria-wars-functions): report a failed gallery publish to Sentry`.
3. **Play Games sync reports without its message** — `caught-errors.ts`,
   `caught-errors.spec.ts`, `play-games/command.ts`,
   `play-games/sign-in.emulator.ts`. Test first: `withoutMessage` keeps name
   and frames, drops message and cause, names a non-`Error` `unknown`; the
   emulator's failing-sync test expects the sink call and a thrown message
   with the access token in neither sink nor log. Then
   `logCaughtError('Play Games achievement sync failed', { error: withoutMessage(error) })`.
   Commit `fix(bacteria-wars-functions): report a failed achievement sync to Sentry`.
4. **Docs** — `CLAUDE.md` (Cloud Functions, the `logCaughtError`
   sentence: `withoutMessage` for an error whose text may carry a secret).
   Commit `docs(bacteria-wars-functions): name withoutMessage for caught errors`.
