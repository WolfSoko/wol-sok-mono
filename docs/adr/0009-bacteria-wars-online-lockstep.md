# 9. Bacteria Wars plays online in lockstep over WebRTC, signalled through Firestore

- Status: accepted
- Date: 2026-10-22
- Scope: `libs/features/lazy/bacteria-game`, `apps/bacteria-game-remote`

## Context

The game had two humans only on one screen. The design notes
(`docs/bacteria-game/design-ideas.md`, 5.3) sketched online play as
host-authoritative: one device runs the simulation (the GPU one allowed) and
streams the owner grid to the other, which only sends its crosshair.

Since then the groundwork for the other way has landed: a fixed 60 Hz tick,
one seed per match through the simulation, the pellets and the bots, an
Angular-free `MatchEngine` whose seats can be played by a recording
(`GhostController`), and replays that the CPU simulation plays out to the
same bit. Streaming state would need a state codec, a guest-side stand-in
for the simulation and the engine (HUD, sound events, outcome, minimap all
read the engine) and a painter path for received state.

The game already has its own Firebase project with anonymous accounts
(ADR 0007), so a place for two devices to meet costs nothing new.

## Decision

**Lockstep on the CPU simulation.** Both devices run the same `MatchEngine`
with the same seed; each tick is played only once both seats' inputs for it
are in. What a player puts in is played `INPUT_DELAY_TICKS` (6, 100 ms)
later on both devices, so it usually arrives before the other device needs
it; when it does not, that device waits rather than guesses. Both seats are
driven through the engine's seat drivers (`SeatDriver`, which the ghost
already implements), so the engine needed no new code path. Online matches
run on the CPU simulation at the _Normal_ grid on both devices, whatever
their settings, and only on base-size maps.

**Desync is detected, not repaired.** Once a second each device sends a
checksum of the players (colony sizes, scores, crosshairs); should they
differ, the match ends as "out of step". The CPU simulation uses a handful
of `Math` functions whose last bit browsers are free to round differently
(`hypot`, `sin`, `cos`); replays have not shown it, and the checksum makes
it visible if it ever happens.

**WebRTC data channel, Firestore signalling, no TURN.** The host opens a
room `rooms/{code}` (six letters and digits) with its offer, the guest
writes its answer into it; offers and answers carry all their ICE
candidates, so each side writes one string. The rules let anyone signed in
read a room by its code but not list rooms, and only one guest answer one.
A TTL policy on `expireAt` deletes old rooms. The data channel is ordered
and reliable: inputs are a few dozen bytes 60 times a second. Without a
TURN server two devices behind strict NATs cannot connect and are told so.

**The host decides.** The host plays the left colony, picks the level and
colours and starts every match (sending the seed); the guest follows. A
device that leaves or loses the connection forfeits the match under way.
Online matches earn no medallions, XP or totals.

## Consequences

- Both players have the same input delay, and a slow device or connection
  slows the match for both instead of putting one side behind.
- A big map, or the GPU simulation's look and speed, is not available
  online. Lifting either means the host-authoritative design after all.
- Pausing on one device holds the match on both (the other waits).
- The rooms need a TTL policy on `expireAt`, or they pile up. It is
  declared in `apps/bacteria-game-remote/firestore.indexes.json` and
  deployed with the rules, so the release sets it up.
- Without a Firebase project (development builds) the mode is shown but
  says it is not available.
