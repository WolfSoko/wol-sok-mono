# Spec: Online room, the guest suggests a level and signals ready

Issue: [#3167](https://github.com/WolfSoko/wol-sok-mono/issues/3167), follow-up of
[#3164](https://github.com/WolfSoko/wol-sok-mono/issues/3164)
([spec](3164-better-online-game-experience.md)).

## Goal

In the shared online room (`OnlineRoomComponent`, before the first match and
in the result dialog), the guest stops being only a spectator:

1. **Suggest a level.** The guest taps a level card of `MATCH_LEVELS` in the
   room, the same picker the host has. That does not change the level. It
   marks the card as the guest's wish: on the host's picker the card gets a
   "{name} wants this" tag (the guest's own card shows "Your wish"). The host
   status line reads "{name} suggests {level}". Taking it is the host's
   ordinary pick of that card. Tapping the wished card again on the guest
   takes the wish back.
2. **Signal ready.** The guest gets a toggle button "Ready", which turns into
   "Ready ✓" ("Not ready" to undo). The host sees a "Ready" tag on the
   guest's player card. Ready is only a signal. The host can start without
   it, and the matchmaking's automatic first match ignores it.
3. **Both reset when they no longer fit.** A wish is dropped once the host
   picks the wished level (fulfilled). Ready is dropped whenever the host's
   level changes (the guest agreed to another level), when a match starts,
   and on a new connection.

## Non-goals

- Gating the host's Start on the guest's ready.
- A host's wish or ready (the host starts, so it needs neither), chat, or
  emotes.
- Changes to matchmaking (`matchLevel`, `pickMatchLevel`), series, ranked
  online matches.
- Analytics events or privacy policy changes: nothing goes to a server. The
  wish and ready travel only over the direct peer link, which already carries
  the setup.

## Decisions

- **No `NET_VERSION` bump. Instead, a feature flag in `hello`.** The issue
  asks whether breaking play between releases is acceptable. It need not be:
  `parseNetMessage` of every released client drops an unknown `k` (returns
  `null`) and rebuilds `hello` from its known fields, so an older peer ignores
  both a new message and a new hello field. The new `hello` therefore carries
  `f: string[]`, the features this device understands (`['room']`). A device
  shows the guest's controls, or reads the guest's state, only when the peer's
  hello named `room`. Old and new clients keep playing each other. The guest
  of an old host simply gets no suggest or ready controls, and an old guest
  sends none. Unknown feature names are dropped while parsing, so a later
  feature can join the list the same way.
- **One message carries the guest's whole room state**:
  `{ k: 'room', wish: string | null, ready: boolean }`, sent by the guest
  only, with the level checked by `isLevelId` and `playableOnline` on
  receipt. Last write wins and the message is idempotent. That leaves no
  ordering between separate "wish" and "ready" messages to get wrong, and a
  reset is a resend.
- **The guest owns the state, and the resets happen on the guest.** It
  applies them when it receives the host's `setup` (a changed level drops
  ready, a level equal to the wish drops the wish) or a `start` (drops
  ready). Each reset is sent to the host. The rules are one pure function,
  `guestRoomAfter(state, event)`, in `net/guest-room.ts`, with its own spec.
  The host only mirrors what it receives, and clears its mirror on
  `connected` and `ended`.
- **A root service `GuestRoom`** (`net/guest-room.ts`, beside `RoomTally`)
  holds the state as a signal for both seats (`state`, `available`), with
  `suggest(levelId)` and `toggleReady()` for the guest. The wire stays in
  `OnlineMatchService`: `sendRoom(state)` (guest only), a `room` event for
  the host, and `peerFeatures`, read from the hello.
- **The picker serves both seats.** The guest's card tap calls
  `GuestRoom.suggest`, the host's calls `setLevel` as before. The
  `LevelCardComponent` gets an optional `tag` input for the wish label, so
  no second card component is needed. Material buttons and `mat-icon` only.
- **Texts in English and German** under `online.room.*`.

## Acceptance

1. Connected to a peer that sent `f: ['room']`, as guest: the room shows the
   picker and a Ready toggle. Tapping a card sends
   `{k:'room', wish:<id>, ready:false}` and tags that card "Your wish".
   Tapping it again sends `wish: null`. The level itself stays the host's.
2. As host: the guest's wish tags its card "{name} wants this" (or "Your
   opponent wants this" without a profile), and the status line reads
   "{name} suggests {level}". The guest's Ready shows as a tag on its player
   card. Picking the wished card makes the guest drop the wish, and the tag
   goes away.
3. The host changing the level drops the guest's ready on both devices. A
   match start drops it too. A new connection starts with no wish and not
   ready.
4. Against a peer whose hello has no `f` (an older release), the guest sees
   the room as in #3164 (no picker, no Ready, "… is choosing the level"),
   sends no `room` message, and the match connects and plays.
5. `parseNetMessage` rejects a `room` message with a level that is unknown
   or does not play online, or with a non-boolean `ready`. It keeps only
   known names in a hello's `f`. `NET_VERSION` is unchanged.
6. The result dialog's room behaves the same, since it embeds the same
   component.
7. `npx nx test feat-lazy-bacteria-game`, lint, lint-templates,
   typecheck-specs and the remote's production build (budgets) pass.

## Open questions

- None blocking. If the owner prefers the host to be unable to start until
  the guest is ready, that is a later, separate decision (it would need the
  `room` feature on both sides, so it could only apply between new clients).
