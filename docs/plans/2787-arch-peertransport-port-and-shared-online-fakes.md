# Plan: PeerTransport port and shared online fakes

Spec: [`docs/specs/2787-arch-peertransport-port-and-shared-online-fakes.md`](../specs/2787-arch-peertransport-port-and-shared-online-fakes.md).
Lib: `libs/features/lazy/bacteria-game` (project `feat-lazy-bacteria-game`); paths
below are relative to its `src/`.

1. **Port and WebRTC adapter.** Add `lib/net/peer-transport.ts`
   (`PeerConnection`, `PeerTransport` interfaces; token `PEER_TRANSPORT` in `online-match.service.ts`, default `WebRtcTransport`);
   move `supported/offer/answer` out of `PeerLink` into `WebRtcTransport`
   in `lib/net/peer-link.ts`. Inject the port in `OnlineMatchService`.
   Tests: the existing spec still green (temporarily overriding the port
   instead of `jest.mock`). Commit `refactor(feat-lazy-bacteria-game): put WebRTC behind a PeerTransport port`.
2. **In-memory adapters.** Add `testing/paired-transport.ts` and
   `testing/fake-game-rooms.ts`, each with a small spec of its own
   (pairing, ordered async delivery, close both ends; offer to guest,
   answer to host, taken room).
3. **In-process protocol spec.** Rewrite `lib/net/online-match.service.spec.ts`
   on two real services (child environment injectors) over the paired
   transport: hello and connected events, setup, colours, start and
   `takeStart`, lockstep inputs both ways, version mismatch, `bye`, lost
   link, and the three room tests. Commit together with 2:
   `test(feat-lazy-bacteria-game): play the online protocol between two real services`.
4. **`FakeOnlineMatch`.** Add `testing/fake-online-match.ts`; move
   `game-state.service.spec.ts`, `online-colors.spec.ts`,
   `matchmaker.service.spec.ts`, `social.service.spec.ts` and
   `online-flow.spec.ts` to it and delete their copies. Commit
   `test(feat-lazy-bacteria-game): share one FakeOnlineMatch`.
5. **`provideFakeGameCloud`.** Add `testing/fake-game-cloud.ts` and move the
   14 specs that build a `GameCloud` by hand to it. Commit
   `test(feat-lazy-bacteria-game): build fake game clouds with provideFakeGameCloud`.
6. **Docs.** Update `CLAUDE.md` / the architecture doc's candidate 11 if
   they describe the changed code. Run `nx format:write`,
   `nx affected -t lint,lint-templates,test`, build the remote. Open the PR.
