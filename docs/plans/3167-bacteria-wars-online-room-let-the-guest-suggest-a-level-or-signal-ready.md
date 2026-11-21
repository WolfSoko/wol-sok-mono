# Plan: Online room, the guest suggests a level and signals ready

Spec: [3167](../specs/3167-bacteria-wars-online-room-let-the-guest-suggest-a-level-or-signal-ready.md).
All paths below are under `libs/features/lazy/bacteria-game/src/lib/` unless
they say otherwise. Each task is test first and ends with
`npx nx test feat-lazy-bacteria-game`, `lint` and `lint-templates`.

1. **Wire format** (`net/net-message.ts`, `net/net-message.spec.ts`)
   - `NET_FEATURES = ['room'] as const`, `hello` gains `f: NetFeature[]`
     (parsed: an array that keeps only known names, else `[]`).
   - New message `{ k: 'room'; wish: string | null; ready: boolean }`, with
     `wish` checked by `isLevelId` and `playableOnline(getLevel(...))`.
   - Specs: round-trip, rejection of bad wish or ready, an old hello without
     `f` giving `[]`, unknown features dropped, `NET_VERSION` unchanged.
   - Commit: `feat(feat-lazy-bacteria-game): a room message and features in the online hello`.
2. **Service wire** (`net/online-match.service.ts`, its spec,
   `testing/fake-online-match.ts`)
   - Send `f` in the hello, keep the peer's in a `peerFeatures` signal
     (reset by `restart`), add `sendRoom(state)` (guest, connected, and the
     peer has `room` only), and a `{ type: 'room'; room }` event for the
     host.
   - Specs over `pairedTransport()`: host hears the guest's room state. A
     peer without `room` gets nothing. A host's `sendRoom` sends nothing.
   - Fake gains `peerFeatures` and `sendRoom` (`jest.fn`).
   - Commit: `feat(feat-lazy-bacteria-game): carry the guest's room state over the peer link`.
3. **Guest room state** (`net/guest-room.ts`, `net/guest-room.spec.ts`)
   - Pure `guestRoomAfter(state, event)`: a setup with another level drops
     ready, a setup equal to the wish drops the wish, a start drops ready.
   - Root service `GuestRoom`: `state`, `available` (`computed`: connected,
     and the peer has `room`), `suggest`, `toggleReady`. The guest applies the
     reset rules on `setup` and `start` events and resends when the state
     changed. The host mirrors `room` events. Both clear on `connected` and
     `ended`.
   - Commit: `feat(feat-lazy-bacteria-game): the guest's wish and ready in the online room`.
4. **Room UI** (`menu/online-room.component.{ts,html,scss,spec.ts}`,
   `menu/level-card.component.{ts,html,scss}`, `i18n/texts/{en,de}/online.ts`)
   - Level card: optional `tag` input, shown as a small label.
   - Room: guest picker plus a Ready toggle when `GuestRoom.available`. The
     host sees the wish tag on the card, the suggests line, and a Ready tag
     on the guest's player card. Without the feature the guest keeps the
     #3164 view.
   - Specs: the guest's tap calls `suggest` and does not call `setLevel`.
     The guest's second tap withdraws the wish. The host sees the tags and the
     line. With the feature off, the guest sees the #3164 view.
   - Commit: `feat(feat-lazy-bacteria-game): let the guest suggest a level and say ready in the room`.
5. **Checks**: `npx nx run-many -t test,lint,lint-templates,typecheck-specs`
   on the affected projects, the `bacteria-game-remote` production build
   (budgets), `npx nx format:write`.
