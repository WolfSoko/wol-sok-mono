# Spec: caught `logger.warn` sites still bypass Sentry ([#3222](https://github.com/WolfSoko/wol-sok-mono/issues/3222))

## Goal

The four places in `apps/bacteria-wars-functions/src` that catch an
unexpected failure, log it with `logger.warn` and go on report it to Sentry
(project `bacteria-wars-functions`) through `logCaughtError`
([#3215](https://github.com/WolfSoko/wol-sok-mono/issues/3215)), capped and
tagged with their fixed message, while the code around them carries on
exactly as today:

| Site                                    | Message                              | What the failure costs                        |
| --------------------------------------- | ------------------------------------ | --------------------------------------------- |
| `replays/accept.ts` (`countSafely`)     | "Level statistics not counted"       | the level statistics lose a match             |
| `replays/level-stats.ts` (`countRerun`) | "Re-run not counted"                 | the statistics lose a verified re-run         |
| `gallery/feature-best.ts`               | "Candidate failed to publish"        | the day's gallery loses a pick                |
| `play-games/command.ts`                 | "Play Games achievement sync failed" | the player's achievements stay locked on Play |

## Decisions

1. **All four report.** Each is a server-side failure nobody expects
   (a Firestore write, a publish transaction, a Games API call or the
   progress read), not a planned outcome, and each loses data silently
   today. A planned outcome stays a warning or info and out of Sentry:
   `Ranked attempt voided`, `featureBest read its limit of replays`, the
   Play Games refusals in `achievements.ts` (Google's answer, not a throw),
   the Realtime Database key skips in `social/`, "Some idle guests were not
   deleted" (a summary; each guest's failure already reports) and the
   skipped count in `error-reports.ts`.
2. **Their log level becomes `error`.** `logCaughtError` logs with
   `logger.error`, as for the seven sites of #3215; a failure that reaches
   Sentry is an error in Cloud Logging too. No level parameter: one level
   for every caught report keeps the function simple.
3. **The level statistics never throw, in one module.** `countLevelStats`
   in `replays/level-stats.ts` takes over the catch of `accept.ts`'s
   `countSafely` (deleted), as `countRerun` beside it already does. Both
   share one private helper that writes and reports, so the "never in the
   way" rule lives once, and both are testable with a fake Firestore in
   the pure `level-stats.spec.ts`.
4. **The Play Games error is reported without its message.** The sync
   today logs only the error's name, since a thrown error may quote
   Google's answer (a `SyntaxError` from `response.json()` quotes the body,
   which may name the access token: the emulator spec "stores and logs the
   access token nowhere" plays exactly that). A new `withoutMessage(error)`
   in `caught-errors.ts` returns an `Error` of the same name and stack
   frames, with an empty message and no `cause`; the sync passes that to
   `logCaughtError`. Sentry gets the type and where it was thrown, Cloud
   Logging gets the same, neither gets the text. The other three sites
   pass the error itself: Firestore's messages name paths at most, which
   `scrubEvent` strips of ids.
5. **Behaviour stays**: results, counts, the day's marker, the sign-in's
   answer and token are unchanged; only the log call changes.

## Non-goals

- The `logger.warn` sites listed as planned outcomes in decision 1.
- Alert rules in Sentry, retries.

## Acceptance

1. A failing level statistics write in `countLevelStats` and in
   `countRerun` resolves, and the sink gets the error with "Level
   statistics not counted" or "Re-run not counted" (`level-stats.spec.ts`).
2. `acceptReplay` still stores a local replay whose statistics fail
   (`countLevelStats` resolves; `replays.emulator.ts` stays green).
3. A candidate whose publish throws reports "Candidate failed to publish",
   and `featureBest` still marks the day done and publishes the others
   (`gallery.emulator.ts`).
4. A failing achievement sync keeps result and token, and the sink gets an
   `Error` of the thrown error's name with "Play Games achievement sync
   failed"; a thrown message naming the access token reaches neither the
   sink nor the log (`sign-in.emulator.ts`).
5. `withoutMessage` keeps name and stack frames and drops message and
   cause, also for a non-`Error` (`caught-errors.spec.ts`).
6. No `logger.warn` is left at the four sites; no handler module imports
   `@sentry/node`.
7. `CLAUDE.md`'s Cloud Functions Sentry paragraph names `withoutMessage`
   for an error whose text may carry a secret.

## Open questions

None.
