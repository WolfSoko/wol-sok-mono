# Plan: Better online game experience

Spec: `docs/specs/3164-better-online-game-experience.md`. One PR, tasks in
order, test first in each.

1. **Room tally.** `net/room-tally.ts`: pure `countResult(tally, winnerSeat)`
   and the root service `RoomTally` (signal `[number, number]`), reset on
   the online `connected`/`ended` events, counted where `GameStateService`
   ends an online match. Spec `room-tally.spec.ts`.
   Commit: `feat(feat-lazy-bacteria-game): count the wins of an online room`.
2. **Room component.** `menu/online-room.component.{ts,html,scss}`: player
   cards (own and opponent, from `SocialService.opponent` and the colony
   names), tally, next level card with preview, host picker
   (`LevelCardComponent` per `MATCH_LEVELS`, calling
   `GameStateService.setLevel`), guest line, Start output. Texts
   `online.room.*` (en, de). Spec `online-room.component.spec.ts`: host
   picks → `setLevel`; guest has no picker and follows the store's level.
   Commit: `feat(feat-lazy-bacteria-game): show online players a shared room`.
3. **Lobby uses the room.** The `connected` case of
   `online-lobby.component.html` embeds the room; the new game's start
   step shows no separate briefing online when connected; `stepsOf` drops
   the level step for online; idle texts clearer. Update
   `online-lobby.component.spec.ts`, `play-kind`/new-game specs.
   Commit: `feat(feat-lazy-bacteria-game): pick the online level in the room`.
4. **Online result dialog.** `winner.component` shows the players' header
   with the tally and embeds the room for online matches (host starts the
   next match with `action 'again'` after picking). Update
   `winner.component.spec.ts`.
   Commit: `feat(feat-lazy-bacteria-game): give online results a room for the next match`.
5. **Checks.** format, lint, lint-templates, test, typecheck-specs,
   `bacteria-game-remote` production build (budgets; a component near the
   style limit gets split).
