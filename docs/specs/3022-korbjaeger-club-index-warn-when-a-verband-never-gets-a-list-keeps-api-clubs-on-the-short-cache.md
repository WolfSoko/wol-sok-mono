# Spec #3022: Korbjäger club index: warn when a Verband never gets a list (keeps /api/clubs on the short cache)

Issue: [#3022](https://github.com/WolfSoko/wol-sok-mono/issues/3022), from the
review of [PR #3021](https://github.com/WolfSoko/wol-sok-mono/pull/3021)
([#3005](https://github.com/WolfSoko/wol-sok-mono/issues/3005)). Related:
[#3017](https://github.com/WolfSoko/wol-sok-mono/issues/3017).

## Goal

`parseClubIndex` calls the index complete only once every offered Verband
holds a list. A Verband whose crawl always fails keeps `/api/clubs` on the
short cache for good, silently. Each run of `clubIndex` now says how many
offered Verbände have no list, and logs a warning once one has had none for
a week, naming its id and its last error.

## Non-goals

- No change to which Verband is crawled when, or to the completeness rule:
  the short cache stays the right answer while a Verband is missing.
- No Sentry: `korbjaeger-functions` reports to none. Cloud Logging's
  warning is the signal (a log-based alert can be added by hand).
- No alert on a Verband whose old list stays while its recrawls fail: its
  Clubs are findable and the index counts as complete.

## Decisions

- **"No list since" is stored, not guessed.** The state holds only the
  latest attempt, so the run cannot tell how long a Verband has been
  without a list. `markAttempt` of a Verband without a list also writes
  `listlessSince`: the start of its first attempt that found no list,
  kept from the state on later attempts. `save` replaces the document, so
  a list clears it. Every Verband without a list is due at once (or a day
  after its failed attempt), so each gets its `listlessSince` within a day
  of being noted; one never attempted yet is not overdue.
- **The last error is stored beside it.** When the crawl throws, the run
  writes `lastError` (`markFailure`) and rethrows, so the scheduler's error
  log stays as it is. The text is the error's kind (`BasketballDataError`)
  or name, then its message, cut to 200 characters: no Club, no person (the
  DBB's messages and ours name paths and status codes only). A crawl killed
  by the function's timeout writes none; the warning then says
  `none recorded`.
- **The warning comes before the crawl,** through a `warn` port on
  `ClubIndexRun`, since the failing crawl rejects the run: one warning per
  overdue Verband per run (hourly), with `association`, `listlessSince`
  (ISO) and `lastError`. `main.ts` passes `logger.warn`.
- **The result counts them:** `withoutList`, the offered Verbände that held
  no list at the run's start (placeholders and attempt-only documents).
- **The week is the schedule's:** `ClubIndexSchedule.warnListlessAfterMs`,
  in `config.ts` from `CLUB_INDEX_CRAWL_DAYS.maxAge` (a list is renewed
  weekly; a Verband without one for a whole cycle is stuck). The pure
  `overdueListless(associations, state, schedule, now)` beside
  `associationToCrawl` decides it.

## Acceptance

1. A run with an offered Verband whose `listlessSince` lies more than a
   week back calls `warn` once, with its id, that time and its stored last
   error (or `none recorded`), before it crawls.
2. A run where every offered Verband has a list, or the one without has
   been so for less than a week, or has no `listlessSince` yet, warns
   nothing.
3. The result carries `withoutList` (the count at the run's start).
4. An attempt of a Verband without a list writes `listlessSince` (the
   attempt's start, or the stored one where there is one); an attempt of
   one with a list writes none.
5. A failed crawl stores its error text (kind or name, message, at most 200
   characters) and the run still rejects with the error.
6. The Firestore store writes and reads `listlessSince` and `lastError`,
   and `save` drops both (emulator spec).
7. `CLAUDE.md`'s club index paragraph names the warning.
8. `nx affected -t lint,lint-templates,test,typecheck-specs` green;
   `korbjaeger-functions:test-emulator` green.

## Open questions

None.
