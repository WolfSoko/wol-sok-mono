# Plan: play the Thanos effect before the result panel

Spec: [docs/specs/3185-...](../specs/3185-bacteria-wars-play-the-thanos-effect-before-the-win-lose-next-game-panel.md),
issue [#3185](https://github.com/WolfSoko/wol-sok-mono/issues/3185).
All paths below are in `libs/features/lazy/bacteria-game/src/lib/`.

1. **One helper for "the effect is over".**
   - Files: `stage/effect-over.ts` (new), `flow/play-flow.ts`.
   - `effectOver(effect: () => Observable<unknown>): Observable<void>`:
     `defer`, `catchError` (logs "The arena could not be vaporized"),
     `defaultIfEmpty`, `last`. `resetGame$` uses it.
   - Tests: `stage/effect-over.spec.ts` (completes once on complete, on
     empty, on a sync throw and on an error, logging the error); the
     component's existing reset specs stay green.
   - Commit: `refactor(feat-lazy-bacteria-game): one helper for the end of the vaporize effect`.
2. **`ArenaStage.dissolve()` and the dust it leaves.**
   - Files: `stage/arena-stage.ts`, `stage/arena-stage.spec.ts`.
   - `dissolve()` runs the effect through `effectOver`, hides the frame
     (`hideUntilPainted`) when it is over, shared (`shareReplay`) and kept
     as the dust; `vaporize()` hands the dust back once and forgets it,
     else runs a new effect.
   - Tests first: dissolve hides the frame once the effect is over;
     vaporize after a dissolve does not call `vaporize$` again and does not
     reveal the frame; a vaporize during a running dissolve completes with
     it; the next vaporize runs a new effect.
3. **The dissolve at the match end, the panel after it.**
   - Files: `flow/play-flow.ts`, `flow/match-end.ts`,
     `bacteria-game.component.ts`, their specs.
   - `PlayFlow.dissolving` and `dissolveArena()`; `panel()` is null while
     dissolving; `MatchEnd.finishMatch` calls `dissolveArena()` after the
     sound and buzz; screen views null while dissolving.
   - Tests first: panel null during the dissolve, `'over'` after; one
     `vaporize$` per match end with Again/Next/Menu; Next switches the
     level after the clear arena; online start during the dissolve waits;
     "off" shows the panel over the hidden arena; a throwing or hanging
     effect brings the panel; sound and buzz at the end; quit from pause
     still vaporizes. Update the component spec's "shows the result" test.
   - Commit (2 and 3 together, one behaviour): `feat(feat-lazy-bacteria-game): turn the arena to dust before the result panel`.
4. **Docs.** The lib's `CLAUDE.md` section "Clearing the arena" says the
   match end dissolves the arena before the result, and the reset after it
   plays no second effect. Same commit as 3.
5. **Checks.** `npx nx format:write`, `npx nx affected -t lint,lint-templates,test,typecheck-specs`,
   the remote's e2e locally where it runs (`online.spec.ts`,
   `bacteria-game-remote.spec.ts`), a look at the running game.
