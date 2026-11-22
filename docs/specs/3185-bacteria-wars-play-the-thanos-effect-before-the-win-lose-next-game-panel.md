# Bacteria Wars: play the Thanos effect before the win/lose/next game panel

Issue: [#3185](https://github.com/WolfSoko/wol-sok-mono/issues/3185)

## Goal

When a match ends, the arena turns to dust first and the result panel
(`WinnerComponent` in `.stage-panel`, `PlayFlow.panel() === 'over'`) shows
only once the effect is over. Today the panel shows at once over the still
arena, and the dust comes only after the player picked a way on (Again,
Next, Menu, ...).

## Non-goals

- No change to the effect itself (`@wolsok/thanos`, its settings, its
  length or quality budgets).
- No change to a reset that does not follow a match end: "Quit" from the
  pause menu and "Give up" still vaporize the arena on the reset, as today.
- No change to what the result panel shows.

## Decisions

1. **The dissolve belongs to the stage, not to the panel.** `ArenaStage`
   gets `dissolve()`: it runs the same effect as `vaporize()`, and once it is
   over hides the arena frame (`hideUntilPainted`). `PlayFlow` gets a
   `dissolving` signal and `dissolveArena()`, which `MatchEnd` calls as the
   match ends (where it already plays the end's sound and buzz). While
   `dissolving` is true, `panel()` is `null`, as it is while `resetting`.
   Reason: the arena, its frame and the effect are `ArenaStage`'s already,
   the panel is `PlayFlow`'s; `MatchEnd` is where the match end is handled.
2. **The panel shows over an empty stage.** The directive fades its
   container back in when it is done, which would show the last frame
   again. So the frame stays hidden after the dissolve, through the result
   screen, until the reset's existing reveal (`stageRenderedAfterReset` and
   `arenaPaintedAfterReset`) shows the cleared arena or the next match's
   first frame. Reason: the dust is the end of that arena; showing it again
   under the result would undo the effect.
3. **The reset after a choice plays no second effect.** `ArenaStage.vaporize()`
   hands back the dissolve once (the dust left by the match end) instead of
   a new effect, and forgets it then: a reset after a dissolve completes as
   soon as the dissolve is over, without revealing the arena. A reset that
   starts while the dissolve still runs (the online guest whose host starts
   the next match, `OnlineFlow.followOnlineStart`) waits for that dissolve,
   then resets. Every other reset vaporizes as today.
4. **`hideUntilPainted` keeps its meaning.** The dissolve hides the frame
   with it; the reset after the result screen calls it again (as today),
   which re-arms both waits, so the frame comes back only once the stage
   rendered what follows and the arena painted a frame.
5. **"Quality: off" simply clears the arena before the panel.** `vaporize()`
   already completes on the next task without an effect then; the dissolve
   hides the frame the same way, so the panel shows a moment later over the
   empty stage. Reason: "off" means no dust, not "keep the board".
6. **Sound and vibration stay at the match end.** The end jingle and the
   buzz play as the match ends, under the dust (the effect's own snap sound
   plays along, as on a reset today). Reason: they say the match is over;
   holding them back 2.5 s would feel late, and the medallion's sound
   already follows the jingle.
7. **A failing or hanging effect never keeps the result away.** The dissolve
   handles errors and the deadline the same way the reset does (logged,
   cancelled at the set length plus `VAPORIZE_SLACK_MS`): the error handling
   of `resetGame$` moves into one helper both use, so the panel always
   comes.
8. **Screen views and Escape.** While dissolving no screen view is reported
   (as while resetting); Escape is already ignored while the match is over.
9. **The online room on the result screen** is part of the result panel and
   so shows after the dissolve too; an online start from the host during
   the dissolve is decision 3.

## Acceptance

1. When a match ends, the panel is `null` while the effect runs and `'over'`
   once it is over.
2. After the dissolve the arena frame is hidden while the result panel
   shows.
3. Picking a way on after the dissolve plays no second effect (the
   directive's `vaporize$` is called once per match end) and goes on at
   once; Next still switches the level only after the arena is clear.
4. A reset begun while the dissolve runs waits for it and plays no second
   effect.
5. With "Quality: off" the panel shows without an effect, over the hidden
   arena.
6. An effect that throws or never ends still brings the result panel (at the
   deadline at the latest).
7. Quit from the pause menu still vaporizes the arena on the reset.
8. The end sound and buzz play as the match ends, not after the dissolve.
9. After the reset the arena frame shows again once the stage rendered and
   the arena painted (existing "hidden arena" specs stay green).
10. Lint, template lint, spec typecheck, the game lib's tests and the
    remote's e2e (incl. `online.spec.ts`) stay green.

## Open questions

None for the build; the manager may overrule decision 2 (empty stage under
the result) or 6 (sound timing).
