# Spec: `replayVerdict()`: the engine judges a replay

Issue: [#2781](https://github.com/WolfSoko/wol-sok-mono/issues/2781), candidate 5 of
[`docs/bacteria-game/architecture-deepening.md`](../bacteria-game/architecture-deepening.md)
([#2776](https://github.com/WolfSoko/wol-sok-mono/issues/2776)).

## Goal

The engine says whether a replay plays out as its header claims. Today
`playReplay` returns `null` without a reason, so the Cloud Functions'
`verifyReplay` (`apps/bacteria-wars-functions/src/boards/verify.ts`) checks
`balanceVersion` again before calling it (a clause of `canPlayBack`) and then
compares ticks, checksum, `endedBy` and `winnerSeat` against the header field
by field: engine knowledge in the functions.

A new engine function `replayVerdict(replay)` plays the replay and returns a
discriminated verdict:

| `state`            | when                                                                                   | carries                         |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------- |
| `balance-mismatch` | `header.balanceVersion !== BALANCE_VERSION` (not played)                               | nothing                         |
| `unplayable`       | any other reason `canPlayBack` refuses it (format, ruleset, ladder, float GPU)         | nothing                         |
| `unverified`       | played, but ticks, checksum or outcome differ from the header, or it ended without one | `result`                        |
| `verified`         | played to exactly the header's ticks, checksum and outcome                             | `result`, `outcome` (as header) |

`verifyReplay` in the functions keeps only what is the functions' own: the
timing (`ms`), the summary with its thinned timeline (`TIMELINE_POINTS`) and
`medalOf`.

## Non-goals

- No change to what the functions store: `VerifiedState` stays
  `verified | unverified | balance-mismatch`. The engine's `unplayable` maps to
  the stored `unverified`, as `playReplay`'s `null` does today. The client's
  replay records, the rules and "My matches" are untouched.
- No change to `playReplay`, `canPlayBack` or `replayEngine` and their callers
  (the game, the viewer, the goldens).
- No change to the tick order: `golden-replay.json`, the GPU goldens and
  `SELF_TEST_GOLDEN` stay byte-equal; no `BALANCE_VERSION` bump.
- `MatchRun` ([#2780](https://github.com/WolfSoko/wol-sok-mono/issues/2780)) is
  not waited for; `replayVerdict` builds on `playReplay` as it is.

## Decisions

1. **New file `state/replay-verdict.ts`** beside `replay.ts`, not inside it:
   `replay.ts` is 900 lines already; the verdict is one concern with one
   entry point. Exported from the engine's `index.ts` with its type.
2. **Balance is checked first, then `canPlayBack`.** The balance mismatch is
   the one refusal the boards treat apart (`verify-endless.ts`), so it keeps
   its own state; every other refusal is `unplayable`. Reason: the engine owns
   which refusals exist; the functions only map them.
3. **`unplayable` stays an engine state, mapped to `unverified` in the
   functions.** Reason: storing a new state would change the client's types,
   the rules and the privacy-relevant replay record for no user-visible gain.
4. **The verdict carries the `ReplayResult`** (for `verified` and
   `unverified`), so the functions build the summary and the medallion from
   it without a second run, and `verified` carries the `ReplayOutcome` it
   matched, so the functions do not call `replayOutcome` again.
5. **Tests move to the new seam.** `verify.spec.ts` mocks `replayVerdict`
   instead of `playReplay` and keeps only the functions' part (timing,
   summary, timeline, medallion, state mapping). The field-by-field mismatch
   cases move into the engine's `replay-verdict.spec.ts`, played for real on
   `recordedReplay()` fixtures (CPU) with tampered headers.
6. **`CLAUDE.md`** names `replayVerdict` where it says `verify.spec.ts` mocks
   `playReplay`.

## Acceptance

1. A recorded match that ended (`recordedReplay('meltdown', 600)`: the
   computer wipes out the idle human after some 500 ticks) is `verified`,
   with the result's ticks and checksum equal to the header's and the
   header's outcome. The default `recordedReplay()` (given up after 90 ticks,
   claimed as a forfeit) is `unverified`.
2. A header with another checksum, another tick count or another outcome
   (`endedBy` or `winnerSeat`) gives `unverified`; so does a header without an
   outcome.
3. A header of another `balanceVersion` gives `balance-mismatch` without
   playing.
4. A header the engine cannot play otherwise (float `gpu` simulation, unknown
   version) gives `unplayable`.
5. `verifyReplay` returns the same `Verdict` as before for every case:
   `verified` with summary, timeline and medallion; `unverified` for
   `unverified` and `unplayable`; `balance-mismatch`; `ms` from the clock.
6. `verify.spec.ts` mocks only `replayVerdict`; `verify.ts` no longer imports
   `BALANCE_VERSION`, `playReplay` or `replayOutcome`.
7. `golden-replay.spec.ts`, the engine's and the functions' tests, lint and
   format pass; the goldens are unchanged.

## Open questions

None.
