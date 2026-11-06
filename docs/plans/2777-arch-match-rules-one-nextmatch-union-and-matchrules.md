# Plan: match rules (#2777)

Spec: [`docs/specs/2777-arch-match-rules-one-nextmatch-union-and-matchrules.md`](../specs/2777-arch-match-rules-one-nextmatch-union-and-matchrules.md).
All paths below are in `libs/features/lazy/bacteria-game/src/lib/`.

1. **`matchRules` test first.** Write `state/match-rules.spec.ts` (table of
   every variant and field), then `state/match-rules.ts` with `OneMatch`,
   `NextMatch`, `RulesSetup`, `MatchRules`, `matchRules()`,
   `nextMatchOf(next, online)`, `rankedOutcomeOf(next)` and
   `rematchOf(next)`. Commit
   `feat(feat-lazy-bacteria-game): match rules as one pure function`
   (squashed with the rest in the PR).
2. **Store.** `state/game.states.ts`: replace the five fields with
   `next: OneMatch`, add the computeds `nextMatch` and `matchRules`, derive
   `level` and `matchMode` from them, drop `rankedMatch`.
3. **Service.** `state/game-state.service.ts`: `playGhost`, `playDaily`,
   `playMission`, `continueEndless`, `oneMatch`, `replayOneMatch` and
   `reset` write `next`; `initPlayers`, `endMatch`, `recordMatch`, `start`,
   `togglePause` read `matchRules`; delete `evolves()`, `recordsLocal()`,
   `planModeOf` and `NO_ONE_MATCH`. Move `state/game-state.service.spec.ts`
   to the new field.
4. **Readers.** `analytics/match-analytics.ts` (kind and ranked from the
   rules), `flow/play-kind.ts` and `flow/play-flow.ts` (`playKindOf` takes
   the rules' kind), `flow/match-end.ts` (rematch), `hud/hud-state.ts`
   (pause, restart, locks, mission goal, endless), `stage/arena-stage.ts`
   (grid), `winner-info/winner.component.ts`,
   `replays/replay-note.component.ts`; their specs move with them, the
   cases the table spec now covers are deleted.
5. **Checks.** `npx nx format:write`, `npx nx affected -t lint,lint-templates,test`,
   `npx nx run bacteria-game-remote:build` for the budgets; grep for the
   removed fields.
