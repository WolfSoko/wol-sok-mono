# Spec: Bacteria Wars: measure whether online matches run direct or through the TURN relay

Issue: [#3154](https://github.com/WolfSoko/wol-sok-mono/issues/3154).
Follow-up of [#3148](https://github.com/WolfSoko/wol-sok-mono/issues/3148) part 2
(Cloudflare TURN relay, ADR 0020).

## Goal

Since part 2 of #3148, an online match may run through Cloudflare's TURN
relay. Nothing tells us how often it does. That share drives the relay's
cost (beyond the free tier) and is the evidence that the relay fixes the
connection reports of #3148. The game reports it: every linked online
match says whether its data channel runs direct or through the relay.

## Non-goals

- Bytes or duration through the relay (Cloudflare's own dashboard and the
  spend alert cover the cost).
- Following route changes after the link opened: the host's ICE restart
  every 15 minutes (`RelayRenewal`) keeps the route the devices found; a
  late change is not reported.
- A `route` on `online_ended`: that event fires only on endings with a
  notice and mostly for links that never opened, so it would miss most
  matches and have no route for the rest.

## Decisions

1. **`route` goes on `online_connected`**, not `online_ended` as the issue
   proposed: `online_connected` fires once for every linked match on both
   devices, when the route is known (the channel is open). Values
   `direct`, `relay`, `unknown`.
2. **`relay` when either end of the selected candidate pair is a relay
   candidate** (local or remote `candidateType: 'relay'`). The issue named
   only the local candidate; with one device behind a strict NAT only that
   device allocates the relay, and its peer sees a remote relay candidate.
   Counting both ends makes both devices report the same route.
3. **The selected pair** is the transport's `selectedCandidatePairId`
   (Chromium, Safari), else the candidate pair with `selected: true`
   (Firefox), else a `succeeded` and `nominated` pair. None found, or
   `getStats()` throws: `unknown`.
4. **The reading is a pure function** `connectionRoute(stats)` in
   `net/connection-route.ts`, spec'd on hand-made stats reports;
   `PeerConnection` gets `route(): Promise<ConnectionRoute>`, which
   `PeerLink` answers from `getStats()` and the paired test transport
   answers `direct` (settable for specs).
5. **`OnlineMatchService.greet` tracks after the route resolved**; the
   `connected` event and the phase change stay synchronous, so the game
   never waits for the statistics. A link replaced meanwhile still reports
   the route it had.
6. No personal data: the route is a fixed value of three, no address or
   candidate goes out. The privacy policy's section 11 names it beside
   "how the link came about and ended" in both languages;
   `docs/analytics.md` gets the parameter.

## Acceptance

1. `online_connected` carries `route` (`direct`, `relay` or `unknown`) on
   both devices, with `role` and `matchmade` unchanged.
2. `connectionRoute` reports `relay` for a selected pair with a relay
   candidate on either end, `direct` for host, srflx or prflx on both, and
   `unknown` without a selected pair, for each of the three ways to find it.
3. A failing `getStats()` reports `unknown` and breaks nothing.
4. `docs/analytics.md` and section 11 of the privacy policy (German and
   English) name the route.
5. Lint, template lint, tests and spec typecheck of the touched projects
   pass.

## Open questions

None.
