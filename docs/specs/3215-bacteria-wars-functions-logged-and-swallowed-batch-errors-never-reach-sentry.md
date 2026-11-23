# Spec: logged-and-swallowed batch errors never reach Sentry ([#3215](https://github.com/WolfSoko/wol-sok-mono/issues/3215))

## Goal

Every error a batch in `apps/bacteria-wars-functions` catches, logs and
goes on past shows up in Sentry (project `bacteria-wars-functions`) with
its original type and stack, while the batch keeps going exactly as today:

- `admin/guests.ts`: "Could not lower the account count", "Could not erase
  an idle guest"
- `admin/bans.ts` (`expireBans`): "Could not lift an ended ban"
- `boards/hourly.ts`: "Could not close a replay", "Could not clean up ended
  bans", "Could not write the statistics"
- `main.ts` (`checkLink`): "Could not check a Google link"

## Cause

These sites catch on purpose, so one failure does not stop the sweep; the
handler then returns normally, and `withSentry` (`src/error-reports.ts`)
reports only what a handler throws. [#3213](https://github.com/WolfSoko/wol-sok-mono/issues/3213)
fixed the commands by a rethrow, which is wrong here.

## Decisions

1. **A Sentry-free sink, set by `main.ts`.** A new module
   `src/caught-errors.ts` exports `logCaughtError(message, fields)`, which
   logs `logger.error(message, fields)` as today and hands `fields.error`
   with the message to a sink, and `reportCaughtErrorsTo(sink)`. The sink
   does nothing until `initErrorReports` (called once by `main.ts`) sets it
   to `captureCaughtError` from `error-reports.ts`, so it is set exactly
   where Sentry runs. Reason: `CLAUDE.md` keeps handler modules free of
   Sentry, and threading a reporter through every port and signature
   (`runHourly` → `expireBans`, `closeNotReported`, `sweepGuests`) adds a
   parameter to six functions for one cross-cutting concern, like the
   logger, which they import too.
2. **Capture, don't throw.** `captureCaughtError(error, message)` calls
   `Sentry.captureException(error, { tags: { caught: message } })`. The
   message is a fixed text, never ids; the log fields (uid, replay id)
   stay in Cloud Logging only. `scrubEvent` strips ids from the error's
   own message as before.
3. **Flush before the handler returns.** A captured event is queued; an
   instance may be frozen once the handler returns. `withSentry` therefore
   awaits `Sentry.flush(FLUSH_MS)` after a handler that returned normally
   when anything was captured since the last flush; a handler that
   captured nothing pays nothing.
4. **A cap per run and message** (condition of the approval):
   `captureCaughtError` reports at most `CAUGHT_PER_MESSAGE` (5) errors of
   one message per handler run, so a batch failing for every item on one
   cause does not use up the quota; the rest are only logged, and the run
   logs once how many of each it left out. The count lives in an
   `AsyncLocalStorage` store `withSentry` opens per run, so concurrent runs
   on one instance count apart. The flush stays bounded by `FLUSH_MS`.
5. **Batches stay as they are**: same order, same counts, same results;
   only the `logger.error` call becomes `logCaughtError`.
6. **Not in scope**: `givesUp` in `main.ts` (no error, a decision),
   `publicSite` (reports already), `runCommandDocument`/`runAudited`'s
   "could not answer/audit" (the original error is rethrown and reported).

## Non-goals

- Retries, alerting rules in Sentry, the game client's reports.

## Acceptance

1. Each of the seven sites calls `logCaughtError` with its message and the
   error, and the batch result is unchanged (`guests.spec.ts`, existing
   emulator specs stay green).
2. `logCaughtError` logs and passes error and message to the sink; without
   a sink set it only logs (`caught-errors.spec.ts`).
3. `captureCaughtError` calls `captureException` with the error and the tag
   `caught`; `withSentry` flushes after a successful handler only when
   something was captured (`error-reports.spec.ts`).
4. `initErrorReports` sets the sink once Sentry is started
   (`error-reports.spec.ts`); specs reset the sink after each test.
5. A run reports at most `CAUGHT_PER_MESSAGE` of one message, logs the
   skipped count once, and concurrent runs count apart
   (`error-reports.spec.ts`).
6. No handler module imports `@sentry/node` (checked by grep in review).
7. `CLAUDE.md`'s Cloud Functions Sentry paragraph names the sink.

## Open questions

None.
