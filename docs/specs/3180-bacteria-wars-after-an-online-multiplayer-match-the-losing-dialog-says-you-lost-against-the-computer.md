# Spec: the result of an online match keeps naming the opponent ([#3180](https://github.com/WolfSoko/wol-sok-mono/issues/3180))

## Goal

After an online match the result dialog of the player who lost says
"The computer wins - your colony was eaten!" instead of naming the opponent.
It must keep the online lines ("Your opponent ate the other colony - they
win.") for as long as the result of an online match is shown.

## Cause

`WinnerComponent.online` asks the live connection
(`GameStateStore.online`), not the match that ended. The winner usually
leaves (or closes the tab) right after the match; `GameStateService.endOnline`
then sets `online` to `null`. The match ended by `annihilation`, `time`,
`hold`, … and not by `forfeit` or `desync`, so `online()` turns `false` and
the headline falls through to the local lines, where the opponent's colony is
a bot: "The computer wins". The same flip shows the local actions (Choose a
level, Next level, Play again) instead of "The connection is gone".

## Decisions

- **The store remembers how the ended match was played**: a new field
  `endedOnline: boolean` in `GameStateState`, next to `endedBy` and
  `endedOn`, set by `endMatch` from whether a connection was on when the
  match ended, and cleared wherever `endedBy` is cleared. The result is a
  fact of the match, not of the connection; this fixes the root cause instead
  of guessing from `endedBy`.
- `WinnerComponent.online` reads `endedOnline`; the special case for
  `forfeit`/`desync` goes, since both end through `endMatch` while the
  connection is still on. `connected` keeps asking the live connection.
- The same live-connection guess sat in two more readers of the result,
  fixed with it: the couch rivalry (`WinnerComponent.duel`, which read the
  next match's rules, the setup's again once the connection is gone) and the
  arena's grid (`ArenaStage.simResolution`, which kept the online grid only
  after a `forfeit`, so a player with another grid setting saw the board
  rebuilt under the result).
- No new texts: once the connection is gone the dialog shows the existing
  "connection gone" line.

## Non-goals

- No change to the online room, the headlines themselves or the engine.

## Acceptance

1. A match that ended online by annihilation, lost at this device, keeps the
   headline "Your opponent ate the other colony - they win." after the
   connection is gone (component spec).
2. The same result shows "The connection to your opponent is gone." text in place of the local
   level actions once the connection is gone (component spec).
3. `GameStateService` sets `endedOnline` true for an online match (also a
   forfeit) and false for a local one, and a new match clears it (service
   spec).
4. After an online match whose connection is gone, the result shows no
   couch rivalry and the arena keeps the online grid (component and stage
   specs).
5. In the two-device e2e, once the guest's device leaves the result, the
   host's result says the connection is gone and never names the computer.
6. Lint, template lint, `typecheck-specs` and the lib's tests pass.

## Open questions

None.
