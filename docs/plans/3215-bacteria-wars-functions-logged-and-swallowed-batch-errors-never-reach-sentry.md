# Plan: logged-and-swallowed batch errors never reach Sentry ([#3215](https://github.com/WolfSoko/wol-sok-mono/issues/3215))

Spec: [docs/specs/3215-bacteria-wars-functions-logged-and-swallowed-batch-errors-never-reach-sentry.md](../specs/3215-bacteria-wars-functions-logged-and-swallowed-batch-errors-never-reach-sentry.md)

## Task 1: the sink

- Test first: `src/caught-errors.spec.ts`: logs; passes error and message
  to a set sink; only logs without one.
- Code: `src/caught-errors.ts` (`logCaughtError`, `reportCaughtErrorsTo`).

## Task 2: capture and flush

- Test first: `src/error-reports.spec.ts`: `captureCaughtError` tags the
  capture; `withSentry` flushes after success only after a capture; the
  cap of `CAUGHT_PER_MESSAGE` per run and message, its skipped count, and
  concurrent runs counting apart; `initErrorReports` sets the sink.
- Code: `src/error-reports.ts`.

## Task 3: wire and use

- `initErrorReports` sets the sink; `main.ts`'s `checkLink` uses
  `logCaughtError`.
- `admin/guests.ts`, `admin/bans.ts`, `boards/hourly.ts`: `logger.error`
  → `logCaughtError`; `guests.spec.ts` expects the sink to get both of its errors.
- `CLAUDE.md`: the Sentry paragraph of Cloud Functions.

One commit: `fix(bacteria-wars-functions): report caught batch errors to Sentry`.

## Checks

`npx nx run-many -p bacteria-wars-functions -t test,test-emulator,lint,typecheck-specs`, `npx nx format:write`.
