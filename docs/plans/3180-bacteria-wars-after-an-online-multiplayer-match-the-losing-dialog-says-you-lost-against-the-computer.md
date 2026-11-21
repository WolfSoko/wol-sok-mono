# Plan: the result of an online match keeps naming the opponent ([#3180](https://github.com/WolfSoko/wol-sok-mono/issues/3180))

Spec: `docs/specs/3180-bacteria-wars-after-an-online-multiplayer-match-the-losing-dialog-says-you-lost-against-the-computer.md`

1. **Store and service** (`state/game.states.ts`, `state/game-state.service.ts`,
   `state/game-state.service.spec.ts`): failing specs first (online match ends
   by annihilation → `endedOnline` true and stays after `ended`; forfeit → true;
   local match → false; next start clears it). Add `endedOnline` with its doc
   comment, set it in `endMatch`, clear it next to every `endedBy: null`.
2. **Result dialog** (`winner-info/winner.component.ts`,
   `winner-info/winner.component.spec.ts`): failing spec (lost online match,
   connection gone → opponent headline and the connection line, no Choose a
   level); `online` reads `endedOnline`; existing online specs set it.
3. Run `nx test`, `lint`, `lint-templates`, `typecheck-specs` of
   `feat-lazy-bacteria-game`, `nx format:write`; one commit
   `fix(feat-lazy-bacteria-game): keep naming the opponent on the result of an online match`.
