# Plan: Bacteria Wars: measure whether online matches run direct or through the TURN relay

Spec: `docs/specs/3154-bacteria-wars-measure-whether-online-matches-run-direct-or-through-the-turn-relay.md`.
One PR, `Closes #3154`, one commit per task.

1. **Read the route from the statistics.** New `net/connection-route.ts`
   (`ConnectionRoute`, `connectionRoute(stats)`) with
   `connection-route.spec.ts` first: the three ways to find the selected
   pair, relay on either end, direct, none. Commit
   `feat(feat-lazy-bacteria-game): read an online link's route from its statistics`.
2. **Ask the link for it.** `PeerConnection.route()` in
   `net/peer-transport.ts`; `PeerLink.route()` in `net/peer-link.ts`
   (`getStats()`, `unknown` on a throw) with its case in `peer-link.spec.ts`;
   `PairedEnd.route()` in `testing/paired-transport.ts` with a way to set
   it (`routeNextGuest`-style, kept small). Same commit as task 3.
3. **Report it.** `online_connected` gets `route` in
   `analytics/game-analytics.ts`; `OnlineMatchService.greet` tracks it once
   `route()` resolved; `online-match.service.spec.ts` checks `route` on
   both devices. `docs/analytics.md` and section 11 of
   `apps/bacteria-game-remote/src/app/privacy/privacy.component.html` (DE
   and EN). Commit
   `feat(feat-lazy-bacteria-game): report whether an online match runs direct or through the relay`.
4. Checks: `nx format:write`, `nx affected -t lint,lint-templates,test,typecheck-specs`.
