# 20. Bacteria Wars relays online matches through Cloudflare Realtime TURN

- Status: accepted
- Date: 2026-11-20
- Scope: `libs/features/lazy/bacteria-game`, `apps/bacteria-wars-functions`,
  `apps/bacteria-game-remote`, `tools/relay`
- Partly supersedes: [ADR 0009](0009-bacteria-wars-online-lockstep.md) (its
  "no TURN")

## Context

ADR 0009 connected the two devices of an online match directly over WebRTC,
helped only by public STUN servers. Two devices that cannot reach each other
directly were told so. Players' reports in
[#3148](https://github.com/WolfSoko/wol-sok-mono/issues/3148) showed this to
be common, not rare:

- two phones on mobile data (carrier-grade and symmetric NATs);
- two devices on the same Wi-Fi where mDNS is blocked (mesh, guest and
  client-isolated networks) and the router does not hairpin.

Only a relay gets such a pair through. The owner decided on Cloudflare
Realtime TURN on 2026-11-20.

## Decision

**Shared, short-lived credentials in Firestore.** The game calls no function
(the repo's rule). The scheduled function `refreshRelay` asks Cloudflare
every 30 minutes for credentials valid for an hour (`RELAY_TTL_S`), and
writes the TURN entry flat to `relay/turn`: `urls` (without port 53, which
browsers block), `username`, `credential`, `expireAt` and `refreshedAt`. The
rules let any signed-in player who is not banned `get` it. Nobody can list it
or write it. The 1 h lifetime and 30-minute refresh were the manager's
condition, to keep misuse of the shared credentials short.

**The game connects through it when it can.** Before the offer and the
answer, `OnlineMatchService` asks `GameRelay` (`FirestoreGameRelay`: one
`getDoc`, given up on after 2 s, kept while more than 20 minutes are left).
It hands the TURN server to `RTCPeerConnection` beside the STUN servers. ICE
still prefers a direct path. Without usable credentials the devices connect
as before, without a relay.

**The Cloudflare side is code.** `tools-relay:turn-key` reads the account API
token from the secret `CLOUDFLARE_API_TOKEN` (the one manual input) and does
two things:

- It makes sure the TURN key `bacteria-wars-online` exists and is stored as
  `CLOUDFLARE_TURN_KEY` (`{ id, token }`), the only secret the function
  reads.
- It makes sure the spend alert `bacteria-wars-spend` exists
  (`billing_budget_alert` at $1, sent to the site owner's address).
  Cloudflare offers no usage alert for Realtime TURN, and TURN is free up
  to its monthly allowance, so the first paid dollar is the sign of
  misuse.

A second run changes nothing. A replaced key stays until a run with `--prune`, because the deployed function keeps the secret version it was deployed with. `tools-relay:check` connects two peers
in one browser page through the relay only, and holds the channel past its
credentials' expiry.

**The host renews the relay of an open link.** A relayed connection dies
once its credentials expired and the browser refreshes its allocation:
measured over 11 minutes with 60 s credentials, in Chromium and Firefox.
Fresh credentials through `setConfiguration` alone do not save it. An ICE
restart with them does. So every 15 minutes the host takes fresh
credentials, restarts ICE and sends its offer over a second negotiated
data channel, `signal`; the guest answers the same way (`RelayRenewal`).
The game's channel and the lockstep protocol stay as they were. A device
of an older version never answers, and the host takes its offer back.

## Consequences

- Cloudflare receives every online player's IP address, ports and
  connection times at connection setup, not only for relayed matches,
  because the browser gathers a relay candidate up front. The privacy policy
  (section 4, "Online-Matches") says so. A relayed match's content stays
  DTLS-encrypted.
- Anyone signed in can relay traffic on our key for up to an hour. Cloudflare
  bills egress at $0.05/GB beyond the free tier, and a lockstep match is
  about 6 MB. The spend alert reports misuse, and `RELAY_ON` in the
  functions' `config.ts` takes the function out of the next deploy. The game
  is STUN-only again within the hour.
- A deploy fails for a function whose secret does not exist. So
  `CLOUDFLARE_TURN_KEY` has to exist before `RELAY_ON` ships, and
  `turn-key` runs before such a merge.
- A host waiting in a room keeps the credentials of its offer, with 20
  minutes left at least. A guest joining much later may reach a host on a
  strict NAT no more.
- Safari's engine (WebKit) is untested by the check. It needs a real
  device.
- Per-player credentials (a command document per uid and a trigger) were
  rejected. Anonymous accounts cost nothing, so a per-uid limit gains
  little, and the trigger's cold start would delay every first match.
