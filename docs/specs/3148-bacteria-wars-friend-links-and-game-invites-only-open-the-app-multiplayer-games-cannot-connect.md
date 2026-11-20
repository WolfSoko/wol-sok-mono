# Spec: Bacteria Wars friend links and game invites only open the app; multiplayer games cannot connect

Issue: [#3148](https://github.com/WolfSoko/wol-sok-mono/issues/3148)

## Goal

Follow the three user reports to their causes and fix the ones the game's code
can fix:

1. Friend links (`#friend=<token>`) have no effect: following one only opens
   the app.
2. Friend invites to games (challenges) have no effect besides opening the
   app.
3. Multiplayer games cannot connect.

## Analysis

The invite and challenge code works on a fresh page load:
`apps/bacteria-game-remote/e2e/online-social.spec.ts` opens an invitation
link in a new page and plays a challenge, and `online.spec.ts` connects two
devices. These failures happen only on real devices, for two reasons:

- **A. A link into the running app is never read.** `OnlineFlow.start()`
  (`libs/features/lazy/bacteria-game/src/lib/flow/online-flow.ts`) reads
  `document.location.hash` once, when the stage starts (`takeChallenge`,
  `takeInvite`). A link that opens the game while it is already running is a
  same-document navigation that changes only the fragment: in the Android
  app (the Trusted Web Activity hands the link to its open Chrome tab), in
  an installed PWA window that captures the link, or in an open tab. No
  code reads the new hash, so the player only sees the app come to the
  front. That is report 1, and it applies to a shared run's link too.
- **B. Devices behind strict NATs cannot connect.** `peer-link.ts` uses
  public STUN servers only, with no TURN relay (ADR 0009), and stops
  gathering ICE candidates after 3 s, so the offer or answer can go out
  without the server-reflexive candidate a slow mobile network brings
  later. Two phones on mobile data, or behind some Wi-Fi networks, cannot
  reach each other. The player is then told "Could not connect. Try
  again - on the same Wi-Fi it works best.", the same text as for every
  other failure. That is report 3. A friend's challenge joins the room
  through the same connection (`OnlineFlow.playChallenge` calls
  `OnlineMatchService.join`), so report 2 is most likely B as well: the
  challenge opens the online lobby, and the connection then fails.
- **C. Two devices on the same Wi-Fi fail too** (the user's own test). On
  a LAN the host candidates should connect, but Chrome hides the local IP
  behind an mDNS name (`<uuid>.local`), and the other device has to
  resolve it by multicast. Mesh, guest and client-isolated Wi-Fi networks
  often block that, and the server-reflexive fallback then needs the
  router to hairpin (send a packet to its own public address back into
  the LAN), which many home routers do not do for UDP. The e2e
  (`online.spec.ts`) launches Chromium with
  `--disable-features=WebRtcHideLocalIpsWithMdns`, so it never exercises
  this path. Without TURN the game cannot reach such a pair: only a
  relay gets through. On top of that, in matchmaking the host's
  `JOIN_TIMEOUT_MS` (20 s) ran from the claim, not from the guest's
  answer, so it dropped a link that was still connecting (the guest's
  read, candidate wait and answer all counted against it), and the
  link's own `CONNECT_TIMEOUT_MS` never got its turn.

## Scope of this PR (step 1 of the issue)

- A: every new link hash is taken while the game runs, not only the first.
- B, part 1: a longer candidate wait, a notice of its own when the other
  device cannot be reached, and the failure's kind in analytics.
- C, part 1: the matchmaking host's join timeout covers only the wait for
  the guest's answer; a guest who answered gets the link's connect time
  once more before the host goes back to the search.

## Non-goals

- A TURN relay (B and C, part 2). The user chose Cloudflare TURN, as a
  second PR of this issue, with its own spec and plan: short-lived
  credentials from a Cloud Function, the secret, a privacy policy
  paragraph and an ADR that supersedes the "no TURN" part of ADR 0009.
  This PR says "Part of #3148".
- Push notifications for challenges while the friend is not in the game.
- Changes to the Android app: the TWA already passes the link's URL,
  fragment included, to Chrome.

## Decisions

- **Watch `hashchange` on the window rather than every router
  navigation.** A fragment that changes from outside (link capture,
  address bar, back and forward) fires `hashchange`. The game's own
  `dropHash` goes through `router.navigateByUrl(…, { replaceUrl: true })`,
  which calls `history.replaceState` and fires no `hashchange`, so taking a
  link cannot trigger itself. The manager's answer asked for the router's
  navigations; `hashchange` covers the same navigations (the router reacts
  to the same `popstate` and `hashchange`), and the game's own navigations
  don't feed back into it. A link to another path of the game (say from
  `/privacy` to `/#friend=…`) creates the stage anew, and `start()` already
  reads that hash.
- **One entry point, `takeLink()`,** runs the shared-run check and the
  invitation check on the current hash, both at start and on each
  `hashchange`. A hash that is neither does nothing, as today.
- **An invitation that arrives during a match** waits in `inviteOffer` as
  it does today. The notices show on the menu screens.
- **Candidate wait 5 s** (`GATHER_TIMEOUT_MS`, was 3 s). Gathering usually
  completes well before that, so the wait only gets longer on a network
  that really is slow.
- **The handshake's failure is typed.** `PeerLink.opened` rejects with a
  `PeerUnreachableError` whose `kind` is `ice_failed` (the connection state
  went `failed`) or `timeout` (`CONNECT_TIMEOUT_MS` passed without an open
  channel). A close for any other reason (the other side left, or the
  attempt was abandoned) keeps the plain error. `PeerTransport`'s docs name
  the error, and `pairedTransport()` can produce it in specs.
- **A notice of its own:** `online.notices.unreachable`, in English and
  German: "Could not reach the other device. Some mobile and Wi-Fi networks
  block direct connections - try another network, such as the same Wi-Fi."
  `online.notices.failed` stays for every other failure.
- **Analytics:** `online_ended` gets the parameter `failure` (`ice_failed`,
  `timeout` or `none`), and `docs/analytics.md` shows it. It carries no
  personal data. The privacy policy's section 11 already covers it ("how
  the connection came about and ended").

## Acceptance

1. With the game running, setting the address's hash to `#friend=<token>`
   offers the inviter, and the hash leaves the address (unit spec on
   `OnlineFlow`, simulating a same-document navigation with `hashchange`).
2. The same holds for a shared run's hash (unit spec).
3. The game's own `dropHash` does not take the link a second time (unit
   spec: `readInvite` is called once).
4. The existing invitation specs (offer, address moved on, read failure
   kept) still pass, and so does the e2e "an invitation link makes two
   players friends".
5. A connection whose ICE state goes `failed`, or that never opens within
   `CONNECT_TIMEOUT_MS`, ends with `online.notices.unreachable` and
   `online_ended` `{ failure: 'ice_failed' | 'timeout' }`. Every other
   failure keeps `online.notices.failed` with `failure: 'none'` (unit specs
   on `OnlineMatchService` with `pairedTransport()`).
6. `GATHER_TIMEOUT_MS` is 5000.
7. `docs/analytics.md` lists `failure` on `online_ended`.
8. In matchmaking, a host whose claimed guest has answered (`connecting`)
   is not dropped when `JOIN_TIMEOUT_MS` passes; one still `waiting` for
   the answer is, as before, and one still `connecting` after
   `JOIN_TIMEOUT_MS` plus `CONNECT_TIMEOUT_MS` is left too (unit specs on
   `MatchmakerService`).
9. `nx test`, `lint`, `lint-templates` and `typecheck-specs` of
   `feat-lazy-bacteria-game` are green, and so is the game's e2e in CI.

## Open questions

- TURN relay: decided (Cloudflare, second PR), see the non-goals.
- Whether the failing links were opened with the app already running, and
  whether the failing matches were on mobile data: to be asked of the user
  next. The spec goes ahead on the analysis either way.
