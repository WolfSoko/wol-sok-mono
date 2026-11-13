# Bacteria Wars: start the game after a countdown

Issue: [#3066](https://github.com/WolfSoko/wol-sok-mono/issues/3066)

## Goal

Every match the stage starts opens with a short countdown over the arena:
the colonies stand at their start, "3", "2", "1" count down, one second
each, and only then the war ticks. Players get a moment to find their keys
or pads instead of losing the first second of the match.

## Non-goals

- No countdown for the replay viewer, the balance lab, the CPU bench or the
  Cloud Functions' verification: they play through `MatchRun`, never
  through the stage.
- No setting to switch the countdown off, no countdown sounds or haptics
  of their own (the match music and haptics start on the tap, as today).
- No change to the engine, the simulation or what a replay records: the
  countdown lies before tick 0.

## Decisions

1. **A state of its own, `GameState.COUNTDOWN`**, set by
   `GameStateService.startMatch` instead of `RUNNING`. The match is set up
   exactly as now (players, online seat, daily attempt, series, analytics)
   when the countdown begins, so the host's online start reaches the guest
   at once and both devices count down together; the lockstep evens out
   the rest at tick 0. `start()` alone (the specs' entry) still runs at
   once.
2. **A countdown is a match that is on** (`isMatchOn` true): the HUD, the
   arena and the seats show, no menu panel opens, the stored setup and
   presence treat it as a match. It is not `playing`: the frame loop
   does not tick, input (`StageInput`, `fireWeapon`) is ignored, pause is
   not offered (the pause button and the P key do nothing), and the HUD's
   notes for a playing match (mission goal, waiting for the peer) wait.
3. **3 seconds** (`MATCH_COUNTDOWN_SECONDS`), a whole number of seconds
   shown as `countdown` in the store (3, 2, 1, null outside it). Ranked
   attempts allow 5 s for it (`COUNTDOWN_MS`, ADR 0012); a spec keeps the
   game's countdown within that, and ADR 0012's note "the countdown does
   not exist in the game" is updated.
4. **The countdown ends only from `COUNTDOWN`**: a reset, a quit, an online
   forfeit or a new start meanwhile leaves the state elsewhere, and the
   timer, which `cleanup()` also stops, then changes nothing.
5. **The overlay** is a big number in the middle of the stage, a component
   of its own (`countdown/match-countdown.component.ts`, so the stage's
   stylesheet stays within its budget), announced through a `role="status"`
   region ("The match starts in 3", `stage.countdown`) that stays in the
   stage, empty outside the countdown, so screen readers read the first
   number too, animated per number
   except with reduced motion. The arena is painted once at the countdown's
   start, so the new match's start position shows, not the last board.
   The pads are disabled during it, so a tap waits for the start; the
   level's music starts with the countdown, on the tap.
6. **Leaving fullscreen during the countdown pauses the match**, as it
   pauses a running one, so it never starts behind the page. Space is kept
   from scrolling the page during the countdown, as during the match.
   An online opponent who leaves during the countdown gives the match up,
   as during the match (accepted: the countdown is part of the match).
7. **The countdown's length is a token** (`MATCH_COUNTDOWN_SECONDS`,
   default 3): the specs that drive a match tick by tick from its start
   provide 0.

## Acceptance

1. Starting any match from the stage (new game, restart, next level,
   ghost, ranked, online host and guest) shows 3, 2, 1, then the match
   runs; `timePassed` stays 0 and no tick runs during the countdown.
2. Keys, pads and weapons do nothing during the countdown; pause is not
   possible during it.
3. Resetting or quitting during the countdown returns to the menu and no
   match starts afterwards.
4. The countdown fits ranked attempts' allowance (`COUNTDOWN_MS`).
5. The overlay is announced to screen readers and respects reduced motion.
6. Lint, template lint, spec typecheck, unit tests and the production build
   (with its budgets) of the game pass.

## Open questions

- None blocking. Sounds per count could follow in an issue of their own.
