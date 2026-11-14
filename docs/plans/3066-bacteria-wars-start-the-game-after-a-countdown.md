# Plan: Bacteria Wars: start the game after a countdown

Spec: [3066](../specs/3066-bacteria-wars-start-the-game-after-a-countdown.md)

1. **State and timer** — `state/game.states.ts` (`GameState.COUNTDOWN`,
   `countdown` field, `isMatchOn`, `isCountingDown`), `state/game-state.service.ts`
   (`startMatch` begins the countdown, ticks it down each second, ends it
   only from `COUNTDOWN`; `cleanup` stops it; pause does nothing during it),
   `state/match-countdown.ts` (`MATCH_COUNTDOWN_SECONDS`). Tests first in
   `game-state.service.spec.ts` (fake timers: 3, 2, 1, running; reset
   during it; no pause) and a spec tying the constant to `COUNTDOWN_MS`.
   Commit `feat(feat-lazy-bacteria-game): count down before a match starts`.
2. **Stage** — `hud/hud-state.ts` (`countdown`, `playing` false during it),
   `flow/play-flow.ts` (pause button ignored during it; paint the arena at
   the start), `stage/stage-input.ts` unchanged (RUNNING only),
   `countdown/match-countdown.component.*` (overlay, reduced motion) placed by `bacteria-game.component.html`, texts in
   the engine's `i18n/en|de/stage.ts`. Specs in `hud-state.spec.ts`,
   `play-flow.spec.ts`, `bacteria-game.component.spec.ts`. Same commit
   or `feat(feat-lazy-bacteria-game): show the countdown over the arena`.
3. **Docs** — ADR 0012's note on the countdown, in the feature commit.
4. Checks: format, lint, lint-templates, typecheck-specs, test, the
   remote's production build.
