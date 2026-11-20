# Plan: Bacteria Wars friend links and game invites only open the app; multiplayer games cannot connect

Spec: [docs/specs/3148-…](../specs/3148-bacteria-wars-friend-links-and-game-invites-only-open-the-app-multiplayer-games-cannot-connect.md).
Issue: [#3148](https://github.com/WolfSoko/wol-sok-mono/issues/3148), step 1.
Branch `3148-bacteria-wars-friend-links-and-game-invites`. One PR, `Part of #3148`
while the TURN decision is open, else `Closes #3148`.

All paths are below `libs/features/lazy/bacteria-game/src/`.

## Task 1: take every new link hash (spec A)

- Test first, `lib/flow/online-flow.spec.ts`: after `start()`, set
  `location.hash` to `#friend=<token>` and dispatch `hashchange`. The
  inviter is offered and the address drops the hash. The same goes for a
  shared run (`offerChallenge` called with the new hash). A
  `navigateByUrl` (the game's own drop) fires no second `readInvite`.
- `lib/flow/online-flow.ts`: `takeLink()` runs `takeChallenge` and
  `takeInvite`. `start()` calls it once, then on each `hashchange` of
  `document.defaultView` (`fromEvent`, `takeUntilDestroyed`). Update the
  class's doc comment.
- Commit: `fix(feat-lazy-bacteria-game): take a friend or run link that opens the running game (#3148)`

## Task 2: name an unreachable device (spec B, part 1)

- `lib/net/peer-transport.ts`: `PeerUnreachableError` (`kind:
  'ice_failed' | 'timeout'`), documented on `opened`.
- `testing/paired-transport.ts`: `PairedEnd.failUnreachable(kind)`, which
  closes the end with that error, exposed through `lastGuest`'s type.
- Test first, `lib/net/online-match.service.spec.ts`: a guest whose link
  fails `ice_failed` or `timeout` ends with `online.notices.unreachable`,
  and `RecordingAnalytics` (or the spec's analytics fake) sees
  `online_ended` with `failure`. A plain failure keeps
  `online.notices.failed` and `failure: 'none'`.
- `lib/net/peer-link.ts`: `GATHER_TIMEOUT_MS = 5000`. `close(reason?)`: the
  connection state `failed` closes with `ice_failed`, `giveUpLater` with
  `timeout`, and `opened` rejects with `PeerUnreachableError` for those
  two.
- `lib/net/online-match.service.ts`: `fail()` maps the error to the notice
  and the failure kind, and `endWith` passes `failure` to `online_ended`.
- `lib/analytics/game-analytics.ts`: `online_ended: { reason; notice;
  failure }`.
- `lib/i18n/texts/en/online.ts`, `de/online.ts`: `notices.unreachable`.
- `docs/analytics.md`: `failure` on `online_ended`.
- Commit: `fix(feat-lazy-bacteria-game): tell an unreachable device apart and wait longer for its candidates (#3148)`

## Task 3: checks and PR

- `npx nx format:write`, then `npx nx affected -t lint,lint-templates,test,typecheck-specs`.
- Open the PR with spec, plan and code, the acceptance list and the
  release check (`tools/ci/release-affected.mjs`).
