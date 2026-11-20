# Spec: Bacteria Wars online matches relay through Cloudflare TURN (part 2 of #3148)

Issue: [#3148](https://github.com/WolfSoko/wol-sok-mono/issues/3148).
Part 1: [PR #3153](https://github.com/WolfSoko/wol-sok-mono/pull/3153),
spec `docs/specs/3148-bacteria-wars-friend-links-and-game-invites-only-open-the-app-multiplayer-games-cannot-connect.md`.

## Goal

Two devices that cannot reach each other directly still get an online match,
through a TURN relay of Cloudflare Realtime. Part 1's analysis found the
causes (B and C there): strict NATs on mobile networks, and Wi-Fi networks
that block mDNS or don't hairpin. Only a relay gets through either. The
owner decided on Cloudflare on 2026-11-20 (request 1431).

The Cloudflare side (the TURN key) is created by code from the repo through
Cloudflare's API, idempotently. The one manual input is an account API
token, kept as a secret.

## Non-goals

- Using the relay only after a direct attempt failed (a second negotiation).
  The browser asks the relay for an address while it gathers candidates
  anyway, and ICE prefers a direct path when there is one. A second round
  would add a wait for every pair that needs the relay.
- Measuring how often the relay carries a match (a `route` parameter on
  `online_ended`; follow-up request 1443). It is worth having for cost and value, but it reads
  `getStats()` and changes the analytics catalog and section 11. It goes to
  the manager as a follow-up.
- Swapping Google's STUN servers for Cloudflare's.
- Per-player credentials (see Decisions).
- Changes to the Android app.

## Decisions

- **The game reads shared, short-lived credentials from one Firestore
  document. It calls no function.** A scheduled function `refreshRelay`
  (`apps/bacteria-wars-functions/src/relay/`) runs every 30 minutes. It asks
  Cloudflare for credentials valid for `RELAY_TTL_S` (1 h, the manager's
  condition on request 1442, to limit misuse) and writes them
  to `relay/turn` as `{ urls, username, credential, expireAt, refreshedAt }`.
  A reader always gets at least 30 minutes. The game reads the document right
  before it builds the offer or the answer (`getDoc`, given up on after
  `RELAY_READ_TIMEOUT_MS`, 2 s). It passes the TURN server to
  `RTCPeerConnection` next to Google's STUN servers.
  - Why: the repo's rule is that the client never calls a function. A
    document read is fast at match start. Generating credentials every
    30 minutes costs 48 calls a day, not one per match.
  - The alternative was a command document per player (`relayRequests/{uid}`)
    with a trigger writing credentials back. It would let us throttle per
    uid, but an anonymous account costs nothing to create, so the gain is
    small. It also adds a trigger's cold start to every first match.
  - Trade-off: anyone signed in and not banned can read the credentials and
    relay traffic on our key for up to an hour. Cloudflare charges only
    egress ($0.05/GB). Docs say the first 1,000 GB a month are free,
    shared with the SFU. A lockstep match sends a few kB a second, about
    6 MB in a 10-minute match. The ADR records this risk, the spend alert and
    the off switch (`RELAY_ON`).
- **Firestore stores the TURN entry flat.** Cloudflare's answer is
  `iceServers: [{ urls: [stun…] }, { urls: [turn…], username, credential }]`.
  Only the TURN entry is stored, its `urls` a plain array, because Firestore
  in this repo holds no arrays in arrays. URLs on port 53 are dropped
  (Cloudflare: browsers block it and the URL times out without trickle ICE,
  which the game does not use).
- **No usable credentials means STUN only, as today.** Covered cases: no
  document, an unreadable one, one expired more than an hour ago by the
  device's clock (`CLOCK_SLACK_MS`: a phone whose clock runs ahead still
  uses fresh ones; Cloudflare refuses really expired ones, and ICE goes on
  without them), a read that fails or takes longer than 2 s, and
  `RELAY_ON` off. A failed refresh keeps the credentials the device has. A
  missing relay never blocks a match (review of PR #3158).
- **The record is described once, in the engine.**
  `state/cloud/records/relay.ts` holds `RelayCredentials` and
  `parseRelayCredentials(data, toMillis)`. It is exported from the engine's
  `/cloud` entry, which the functions (writing) and the game (reading) both
  take.
- **Transport interface.** `PeerTransport.offer(relay)` and
  `answer(offer, relay)` take the relay servers (`readonly RTCIceServer[]`,
  empty for none). `OnlineMatchService` gets them from a new `GameRelay`
  port of `GameCloud` (`FirestoreGameRelay` in the game, a fake in specs).
  The transport stays free of Firestore.
- **Rules.** `match /relay/{doc} { allow get: if signedIn() && notBanned(); }`.
  Only the functions write it. There is no `list`. `PLAYER_DATA` keeps it
  with the reason "shared relay credentials, no player data".
- **Secrets.**
  - `CLOUDFLARE_API_TOKEN` (Secret Manager, project `bacteria-wars`) is the
    only manual input. It is an API token with the permission Cloudflare's
    API reference calls "Calls Write" (Account > Calls/Realtime > Edit)
    and "Notifications Write" (Account > Notifications > Edit, for the
    spend alert) on the account that should own the TURN key. The owner sets it once with
    `npx firebase functions:secrets:set CLOUDFLARE_API_TOKEN --project bacteria-wars`,
    which prompts for the value. No function reads it. Only the provisioning
    tool does.
  - `CLOUDFLARE_TURN_KEY` is written by that tool, as JSON
    `{ "id": "<key uid>", "token": "<key secret>" }`. `refreshRelay` names it
    in `secrets`. The key's token can only use TURN. It cannot change the
    account.
- **Provisioning tool, `tools/relay/turn-key.ts`** (a new nested project
  `tools-relay`, tag `tools`, Jest like `tools-deploy`, run as
  `tsx --tsconfig tools/tsconfig.tools.json`, target `tools-relay:turn-key`):
  1. Reads `CLOUDFLARE_API_TOKEN` through
     `firebase functions:secrets:access` into memory. It never prints it.
  2. Works on the account `CLOUDFLARE_ACCOUNT_ID`, a constant in the tool
     (the owner's answer on request 1447; the token may not list accounts,
     and the id is no secret). `--account-id` names another.
  3. Lists the TURN keys (`GET /accounts/{id}/calls/turn_keys`) and looks
     for the name `bacteria-wars-online`.
  4. Does nothing when the key exists and `CLOUDFLARE_TURN_KEY` names its
     uid. Otherwise it creates a new key
     (`POST …/turn_keys { name }`; the response's `secret` is shown only
     then), stores it with
     `firebase functions:secrets:set CLOUDFLARE_TURN_KEY --data-file=-`.
     Older keys of the name stay until a run with `--prune`: the deployed
     `refreshRelay` keeps the secret version it was deployed with (the CLI
     redeploys nothing from a script), so the old key stays in use until
     the functions are deployed again. A secret read that fails for any
     reason but "not found" stops the tool rather than set up a new key.
  - Every run after the first changes nothing. Its decision
    (`planTurnKey(keys, storedUid)`, returning `keep`, `create` and the uids
    to delete) is a pure function with a spec. The HTTP and CLI calls sit
    behind small ports that the spec fakes.
  - `--check` makes the tool generate credentials for one minute, open
    two `RTCPeerConnection`s in Playwright's Chromium with
    `iceTransportPolicy: 'relay'` and send one message across. That proves
    the relay works without any device and without mDNS.
- **A live connection outlives its credentials: the host renews the relay
  (the manager's answer on request 1450).** `tools-relay:check` measured
  it. Two Chromium peers, relay only, credentials of 60 s, channel held
  11 minutes, past Chrome's refresh of the TURN permission (about every
  4 minutes) and of the allocation (its 10-minute lifetime less a minute):
  - without a refresh, the channel dies;
  - with `setConfiguration` and fresh credentials every 30 s, it still
    dies;
  - with that and an ICE restart, it lives.
    So `PeerLink` makes a second negotiated channel, `signal` (id 1; the
    game's stays id 0, and the lockstep protocol does not change).
    `RelayRenewal` (`net/relay-renewal.ts`) runs on it:
  - Every `RELAY_RENEW_MS` (15 minutes) the host takes fresh credentials
    (`Relay.fresh`, which is `GameRelay.servers`), sets them with
    `setConfiguration`, restarts ICE and sends its offer.
  - The guest also takes fresh credentials and answers.
  - Only the host offers, so the two never offer at once.
  - A device of an older version has no `signal` channel and never
    answers. The host takes its offer back after
    `RENEW_ANSWER_TIMEOUT_MS` (20 s, `rollback`), and the link goes on as
    before.
  - Without credentials, nothing is renewed.
- **Known limit: a long wait in a room.** The host's offer carries the
  credentials it had when it opened the room, which have 20 minutes left
  at least. A guest who joins much later than that may reach a host on a
  strict NAT no more. A room code is usually typed in within minutes. The
  ADR records the limit.
- **Browsers.** The check runs in Chromium and Firefox
  (`--browser=chromium|firefox|webkit`). WebKit (Safari) is untested: its
  Playwright build needs system libraries this machine lacks. Safari on
  iOS gets the relay all the same; whether its renewal holds is checked on
  a real device after the deploy.
- **A spend alert at Cloudflare** (the manager's condition on request 1442,
  settled on request 1448). The account offers usage alerts
  (`billing_usage_alert`), but none for Realtime TURN: 28 product names
  were refused. So `turn-key` creates, idempotently by its name, the
  budget alert `bacteria-wars-spend` (`billing_budget_alert`,
  `total_spend_dollars` 1, `SPEND_ALERT_DOLLARS`). It sends email to
  `SITE_OWNER`'s address (`@wolsok/shared-legal`, public already). TURN is
  free up to Cloudflare's monthly allowance, so misuse costs nothing until
  it is used up. The first paid dollar, from any product, then alerts at
  once. The account's own "Default budget alert (auto-created)" at $10
  stays.
- **Off switch.** `refreshRelay` is exported only with `RELAY_ON` in
  `src/config.ts`, as `HOURLY_ON` is. With it off the next deploy (`--force`)
  removes the function. The document expires within 1 h, after which the
  game is STUN-only again.
- **Deploy order.** `firebase deploy` fails for a function whose secret does
  not exist. So `CLOUDFLARE_API_TOKEN` is set and `turn-key` has run before
  the merge. `RELAY_ON` ships as `true` only once `CLOUDFLARE_TURN_KEY`
  exists. Until the first scheduled run, up to 30 minutes after the deploy, the
  game connects STUN-only as today.
- **ADR 0020** "Bacteria Wars relays online matches through Cloudflare
  Realtime TURN" partly supersedes ADR 0009 (its "no TURN"). ADR 0009's
  status line points to it.
- **Privacy policy, "Online-Matches" / "Online matches" (section 4, German
  and English), same PR, for the owner to check before the merge.**
  - Text: so the connection also works where a direct one is blocked, the
    devices also use Cloudflare's TURN servers (Cloudflare, Inc., USA, EU-US
    Data Privacy Framework).
  - Cloudflare receives the device's IP address, ports and connection
    times at every connection setup, not only for relayed matches. If no
    direct path is found, the match runs through Cloudflare. Its content is
    encrypted end to end (DTLS), so Cloudflare cannot read it.
  - "The match itself does not go through our servers" stays true: they are
    Cloudflare's, not ours. The sentence names that exception.
  - The "Stand" date moves to the merge date.

## Acceptance

1. `parseRelayCredentials` accepts `{ urls, username, credential, expireAt }`
   and returns `null` for anything else, an empty `urls` included (engine
   spec).
2. `refreshRelay`'s handler posts `{ ttl: 3600 }` to Cloudflare's
   `generate-ice-servers` URL with the key's bearer token. It writes only
   the TURN entry, without port-53 URLs, and with `expireAt` = now + 1 h, to
   `relay/turn`. A failed Cloudflare call throws and leaves the document as
   it was (spec with a faked `fetch` and Firestore emulator spec).
3. `main.ts` exports `refreshRelay` only with `RELAY_ON`, wrapped in
   `withSentry`, with `secrets: [CLOUDFLARE_TURN_KEY]`.
4. The rules let a signed-in player who is not banned `get` `relay/turn`.
   They refuse a banned one, a signed-out one, `list` and every write
   (`bacteria-game-remote:test-emulator`).
5. `player-data.spec.ts` passes with the new `relay/{doc}` entry.
6. With valid credentials, the host's offer and the guest's answer are made
   with `[googleStun, { urls, username, credential }]`. With a missing or
   unreadable document, one expired more than an hour ago, or a read longer
   than 2 s, they are made
   with Google's STUN only, and the match still connects (game specs with
   the fake `GameRelay` and `pairedTransport()`).
7. `planTurnKey` returns `keep` for an existing key named in the secret. It
   returns `create` for no key, a key the secret does not name, or several
   keys of the name. Older keys are removed only with `--prune`
   (tools-relay spec).
8. The spend alert exists after `turn-key`, and a second run neither
   creates nor changes it (`planSpendAlert` spec, and the run by hand).
   `npx nx run tools-relay:turn-key` run twice in a row against the real
   account changes nothing the second time (checked by hand, noted in the
   PR). `--check --refresh=restart` keeps a relayed channel alive 11
   minutes past a 60 s credential in Chromium and Firefox; without the
   restart it dies (run by hand, outputs in the PR).
   8a. On the host, an open link renews the relay every 15 minutes: fresh
   credentials, `setConfiguration`, ICE restart, its offer on `signal`. The
   guest answers with fresh credentials of its own. An unanswered offer is
   taken back after 20 s, a closed link renews nothing, the guest never
   offers (`relay-renewal.spec.ts`, `peer-link.spec.ts`).
9. The privacy policy names Cloudflare in "Online-Matches" and "Online
   matches" (`privacy.component.spec.ts` checks the German and English
   paragraph).
10. ADR 0020 exists, and ADR 0009's status names it.
11. `nx test`, `lint`, `lint-templates` and `typecheck-specs` of the touched
    projects are green, and the game's e2e (`online.spec.ts`,
    STUN-only on the emulator) still passes in CI.
12. After the deploy, `relay/turn` exists within 30 minutes. A real-device
    check, two phones on mobile data, is asked of the owner and noted in
    the PR. CI cannot test real NATs, and the relay-only check (8) covers
    the relay itself.

## Open questions

- Which Cloudflare account owns the key: decided, the owner named it on
  request 1447 (`CLOUDFLARE_ACCOUNT_ID`).
- The owner checks the privacy policy paragraph before the merge.
