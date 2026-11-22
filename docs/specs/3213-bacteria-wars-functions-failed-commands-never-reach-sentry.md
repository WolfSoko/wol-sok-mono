# Spec: failed commands never reach Sentry ([#3213](https://github.com/WolfSoko/wol-sok-mono/issues/3213))

## Goal

A command document (`adminCommands`, `replayCommands`, `playGamesSignIns`,
`playGamesAdoptions`) whose run throws shows up in Sentry (project
`bacteria-wars-functions`) as an issue with the original error and stack,
while the writer still gets its `internal` result and the owner's audit
still records the failure.

## Cause

`runCommandDocument` (`apps/bacteria-wars-functions/src/commands/run-command-document.ts`)
and `runAudited` (`src/admin/records.ts`) catch every throw, log it with
`logger.error` and answer `internal`. The handler then returns normally, so
`withSentry` (`src/error-reports.ts`), which reports only what a handler
throws, never sees it. Every `toggles.set` failed this way since
[#2653](https://github.com/WolfSoko/wol-sok-mono/pull/2653) (fixed by
[#3212](https://github.com/WolfSoko/wol-sok-mono/issues/3212)) without a
Sentry issue.

## Decisions

1. **Rethrow, don't capture in place.** After the failure is recorded,
   `runCommandDocument` throws the original error on, so the existing
   `withSentry` wrapper reports it. Reason: `CLAUDE.md` keeps handler
   modules free of Sentry, and one wrapper already does the capture, the
   flush and the rethrow; a second reporting path (`captureException` in
   the command code, or an injected reporter) would duplicate it.
2. **Order stays: record first, throw last.** `runCommandDocument` writes
   `result: { ok: false, error: 'internal', at }` before it rethrows, so the
   writer's client gets its answer as today. `runAudited` completes the
   audit (`ok: false`, `error: 'internal'`) before it rethrows, so the
   owner sees the failure in the audit as today; the throw then reaches
   `runCommandDocument`, which answers `internal` exactly as `runAudited`
   did.
3. **Retries stay off.** The four command triggers run without `retry`, so
   a thrown error ends the event as before: nothing runs twice. The only
   visible change outside Sentry is that Cloud Functions counts the
   execution as failed, which is what it was.
4. **One log line per failure.** `runCommandDocument` keeps its
   `logger.error('Command failed', { path, error })`; `runAudited` drops its
   own, since the same error now passes through `runCommandDocument`.
5. **The original error goes on**, no wrapper class: Sentry groups it by its
   own type and stack, and `scrubEvent` already strips ids from its message.

## Non-goals

- Other places that log and swallow an error (`admin/guests.ts`,
  `admin/bans.ts`, `boards/hourly.ts`, `checkLink` in `main.ts`): they keep
  a batch going on purpose; raised to the manager as a follow-up.
- No change to results, rules, the game or the admin area.

## Acceptance

1. A command whose run throws is answered `{ ok: false, error: 'internal' }`
   on its document, and `runCommandDocument` then rejects with that same
   error (emulator spec).
2. An audited action that throws completes its audit with `ok: false`,
   `error: 'internal'` and the command's result is `internal`; the error
   reaches the caller of `runAdminCommand` (emulator spec, `toggles.set`
   with failing Remote Config).
3. The same for an audited replay command (`runReplayCommand`, covered by
   the shared `runAudited` path and acceptance 2).
4. A command refused (`not-writer`, `malformed`, any `ok: false` the run
   answers) or answered null still resolves without a throw (existing
   specs stay green).
5. `withSentry` reports a rejected handler and rethrows (existing
   `error-reports.spec.ts`).
6. `test`, `test-emulator`, `lint` and `typecheck-specs` of
   `bacteria-wars-functions` pass.

## Open questions

None.
