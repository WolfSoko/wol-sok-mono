# Spec: PeerTransport port and shared online fakes

Issue: [#2787](https://github.com/WolfSoko/wol-sok-mono/issues/2787), candidate 11 of
[`docs/bacteria-game/architecture-deepening.md`](../bacteria-game/architecture-deepening.md).

## Goal

The online match's one true-external dependency, WebRTC, sits behind an
injectable port with two adapters, and the specs share one fake of each
seam they cross instead of building their own:

1. **`PeerTransport`** (`lib/net/peer-transport.ts`): an injectable port
   with `supported()`, `offer()` and `answer(offer)`, each handing back a
   `PeerConnection` (`messages$`, `closed$`, `opened`, `accept`, `send`,
   `close`). `OnlineMatchService` injects it instead of calling
   `PeerLink`'s statics.
   - Production adapter: `WebRtcTransport` (`lib/net/peer-link.ts`), the
     port's default (`providedIn: 'root'`); `PeerLink` loses its statics.
   - In-memory adapter: `pairedTransport()` in `src/testing`: an offer made
     on it is answered on it, and once the host accepts the answer both
     ends open and pass messages to each other, ordered and asynchronous,
     like the data channel. Closing one end closes the other.
2. **`FakeOnlineMatch`** (`src/testing/fake-online-match.ts`): the whole
   public surface of `OnlineMatchService` (it `implements` it), with `jest.fn`
   spies, `connect(seat)` and `events` for the spec to play the other
   device. It replaces the copies in `game-state.service.spec.ts`,
   `online-colors.spec.ts`, `matchmaker.service.spec.ts` and
   `social.service.spec.ts`, and the cast to the real service's private
   `events` in `online-flow.spec.ts`.
3. **`provideFakeGameCloud({ … })`** (`src/testing/fake-game-cloud.ts`): a
   `GameCloud` without a project, so every optional backend (`rooms`,
   `social`, `presence`, `boards`, `moderation`, `ranked`) is null and
   storage, replays and toggles are this device's, unless the spec passes
   one. The 14 hand-built partial `GameCloud`s move to it.
4. **`FakeGameRooms`** (`src/testing/fake-game-rooms.ts`): rooms in memory
   that carry the host's offer to the guest and the answer back, so two
   real `OnlineMatchService`s can meet through them.

## Non-goals

- No change to the wire protocol (`net-message.ts`, `NET_VERSION`), the
  lockstep or the engine: `golden-replay.json`, the GPU goldens and
  `SELF_TEST_GOLDEN` stay byte-equal, no `BALANCE_VERSION` bump.
- No change to `PeerLink`'s WebRTC behaviour (ICE servers, timeouts,
  negotiated channel).
- No change to `GameCloud` itself or to what the game does at runtime.
- The other candidates of the architecture analysis (e.g. candidate 12,
  one fake Firebase SDK for the storage adapters) stay out.

## Decisions

- **Abstract class as the port and DI token**, `providedIn: 'root'` with
  `useClass: WebRtcTransport`: specs override it with
  `{ provide: PeerTransport, useValue: pairedTransport() }`, nothing else in
  the game needs a provider. An `InjectionToken` would need an extra type.
- **One transport object for both ends.** `pairedTransport()` returns a
  single `PeerTransport`; both services' injectors get the same instance,
  as both devices reach the same network. The offer string is the key that
  pairs them.
- **Asynchronous delivery** (a microtask per message) so a reply never
  re-enters the sender mid-call, as with a real data channel.
- **`provideFakeGameCloud` takes values, not functions**: every spec knows
  its backends when it configures the module. It builds on a real
  `GameCloud` without connection, so the defaults are exactly what the
  game does without a project, rather than a second copy of them.
- **The in-process protocol spec replaces `online-match.service.spec.ts`'s
  `jest.mock` spec**: the room tests (stub taken once the guest connected,
  play on when it cannot be written, room closed when the host leaves) move
  to the two-service setup; nothing mocks a module any more.
- **Two services in one spec** through `createEnvironmentInjector` children
  of the TestBed injector, each with its own `OnlineMatchService`,
  `GameAccount` and `PlayerService`, sharing the transport and the rooms.

## Acceptance

1. `OnlineMatchService` no longer imports `PeerLink`; it injects
   `PeerTransport`. `PeerLink` has no static `offer`/`answer`/`supported`.
2. No spec in the lib uses `jest.mock('./peer-link')` (or mocks any module
   for the online match).
3. One in-process spec plays hello, setup, colours, start and lockstep
   inputs between two real `OnlineMatchService`s over `pairedTransport()`
   and `FakeGameRooms`, plus a version mismatch, `bye` and a lost link.
4. The room tests of the old spec still hold (stub taken, failure warned,
   unjoined room closed on leave).
5. `game-state.service.spec.ts`, `online-colors.spec.ts`,
   `matchmaker.service.spec.ts`, `social.service.spec.ts` and
   `online-flow.spec.ts` define no online fake of their own; they use
   `FakeOnlineMatch`.
6. No spec in the lib provides `GameCloud` with an object literal; all use
   `provideFakeGameCloud`.
7. `nx test feat-lazy-bacteria-game`, `lint`, `lint-templates` and
   `format:check` pass; the game builds (`bacteria-game-remote:build`).
8. `CLAUDE.md` names the port and the shared fakes where it describes the
   online match's testing, if it describes it; else no change.

## Open questions

- None blocking. Whether `FakeGameRooms` should also simulate a taken
  room (second guest gets `permission-denied`) is covered by one test; a
  fuller Firestore-rules simulation stays with the emulator tests.
