# Spec: Better online game experience

Issue: [#3164](https://github.com/WolfSoko/wol-sok-mono/issues/3164).

## Goal

An online match between two connected devices gets a room both players
share, before the first match and between matches:

1. **The room** (`OnlineRoomComponent`, `menu/online-room.component.ts`):
   once the lobby is `connected`, the start step shows the two players face
   to face (avatar, name, colony colour, "You" marked), the room's tally,
   and the next match's level as a card with its preview. The host picks
   the level right there from the levels that play online
   (`MATCH_LEVELS`); the guest sees the host's pick change live, with a
   short highlight and the line "{name} is choosing the level" until the
   host starts.
2. **The result dialog of an online match** gets a header of its own: both
   players' cards with the room's tally after this match (`2 : 1`), the
   winner marked, and below it the same room: the host picks the next
   level and starts it ("Play {level}"), the guest watches the pick. The
   "Choose level" button the dialog hides online today is no longer needed.
3. **Starting online is clearer:** the lobby's idle state explains the
   three ways in one line each, and a room opened with a code is no longer
   bound to the level picked before opening it: the level is chosen in the
   room once the opponent is there. Opening a match therefore skips the
   level step (`stepsOf('online')` is always `mode, start`).

## Non-goals

- A new net message (a guest's "ready", a guest's level wish, chat). What
  the guest sees comes from the host's `setup` message, which every
  connected guest already receives, so `NET_VERSION` stays `3/…` and both
  devices of different releases keep playing.
- Changes to the matchmaking's level choice (`matchLevel`, `pickMatchLevel`):
  its first match starts at once as today; the room then decides the next.
- Series between online players (`seriesLength`), ranked online matches,
  boards.
- Changes to the analytics catalog or the privacy policy: nothing new is
  sent or stored.

## Decisions

- **The host picks, the guest watches.** The host already sets every match
  up (`OnlineSeatSync.hostSetup` → `OnlineMatchService.share`); the guest
  already applies `setup` to its `online` seat. The room only gives the
  host a picker and the guest a view of `online.levelId`. Reason: no
  protocol change, no race between two pickers.
- **One room component for both places.** The start step and the result
  dialog embed the same `OnlineRoomComponent`, so the between-games lobby
  and the first lobby look and behave alike, and the logic lives once.
- **The tally is the room's, kept by a small service** (`RoomTally`,
  `net/room-tally.ts`, root): wins per seat for the matches of the current
  connection, reset on `connected` and `ended`, fed by the match result the
  game already reports. Pure counting logic in a function with its spec.
- **The level picker is a list of level cards** (the existing
  `LevelCardComponent`), not the full level map: online levels are few and
  the room has to fit beside the result on a phone. Material buttons and
  `mat-icon` only, no custom primitives.
- **Texts in English and German**, keys under `online.room.*`.

## Acceptance

1. Connected, host: the start step shows both players, tally `0 : 0`, the
   next level with preview, a picker of every `MATCH_LEVELS` level, and
   Start. Picking a level changes the card and, on the guest, its card
   (spec: the host's pick calls `setLevel`; the guest's card follows a
   `setup` event).
2. Connected, guest: the same room without picker and Start, with
   "{name} is choosing the level" (or "Your opponent …" without a profile).
3. After an online match the result dialog shows both players, the tally
   counting that match for its winner, and the room: the host can pick a
   level and start it, the guest sees the pick and waits. A draw counts for
   nobody.
4. The tally resets when the connection ends or a new one is made.
5. Opening a match with a code no longer asks for a level first.
6. With the connection gone the result dialog says so and offers no start,
   as today.
7. `npx nx test feat-lazy-bacteria-game`, lint, lint-templates,
   typecheck-specs and the remote's production build (budgets) pass.

## Open questions

- Should the guest be able to suggest a level? Left out here (needs a net
  message and a version bump); a follow-up if wanted.
