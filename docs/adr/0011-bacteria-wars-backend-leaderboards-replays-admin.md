# 11. Bacteria Wars: match replays, a public gallery of the best matches, and the game's first Cloud Functions

- Status: accepted
- Date: 2026-10-23
- Scope: `libs/features/lazy/bacteria-game`, `apps/bacteria-game-remote`,
  new `apps/bacteria-wars-functions`, `firebase.bacteria-game-remote.json`,
  `tools/federation/workspace-federation.js`, `tools/firebase/grant-admin.mjs`

## Context

Players want to watch their matches again, and the best matches should be
public, on a page anyone can open and share.

Most of a replay system exists already. `state/replay.ts` has a format (a
`MatchPlan` header plus sparse, change-only steer, drag and boost inputs),
`playReplay` plays one out headless on the CPU simulation, and
`state/replay-link.ts` packs a run into a `#ghost=` link for ghost races.
What is missing:

- **Online matches are not recorded.** Both seats are lockstep drivers. The
  engine records only live seats, and lockstep seats apply drags in
  `playGhosts()` straight to `dragTargets`, past the recorder. `endMatch`
  sets `lastReplay` to null.
- **An online plan would not play back as an online match.** `planOnline`
  plays with `mode: 'two-players'` and no head start, but `replayOf` stores
  the original plan, and `playReplay` builds ghosts only for seats that are
  not bots. Seat 1 would come back as a live bot.
- **Most local matches cannot be replayed faithfully.** With WebGL2 they run
  on the GPU simulation, which reads back late and differs between drivers.
  `playReplay` refuses GPU replays, and the bot, which reads the simulation,
  would play differently.
- **Nothing is stored.** A replay lives in the signal store until the next
  match; a link carries the whole run in the URL.
- **Nothing can check a replay.** ADR 0010 runs without server code. A
  public gallery fed by clients alone would show whatever a client claims.
- **The engine does not load in Node.** `replay.ts` imports `isGameMode`
  from `game.states.ts`, which pulls in Angular and NgRx. The type import of
  `ColonyLayer` from `arena/colony-renderer` (in `simulation.ts` and
  `bacteria-simulation.ts`) also drags Angular and DOM types into any type
  check. With those stubbed, a bundle of the engine has no `node_modules`
  input, and a 3-minute vs-computer replay on `petri-dish` at 320x180 ran
  twice in Node 22 with identical results, matching the live engine: about
  **3.8 ms per tick, 41 s of CPU for 3 minutes** on a dev core. A Cloud Run
  vCPU may be slower.
- **No renderer can be reused on its own.** The render loop and painter
  wiring sit inside `bacteria-game.component.ts` (about 1800 lines).

The owner has accepted the Blaze plan for the `bacteria-wars` project.
ADR 0008 already expected "functions behind Hosting".

Leaderboards, an admin area with moderation and bans, and a level
preference for matchmaking have been discussed alongside, but are not part
of this decision. They get their own ADR (ADR 0012). This one leaves hooks
for them:
the functions codebase, the admin claim, a no-op `assertActive(uid)` every
function calls, and server-verified match results.

## Decision

### What is recorded

- **Online matches are always recorded** in memory. They already run on the
  CPU simulation at the online grid, so recording costs nothing extra.
- **Local vs-computer matches (including daily and endless) are recorded
  too, with "Record local matches" on by default (the owner's decision).**
  The setting can turn it off on a weak device. Recording moves a
  match from the GPU to the CPU simulation at the online grid
  (`ONLINE_SIM_RESOLUTION`), which costs about a fifth of a desktop core and
  far more on a weak phone, and changes how the bots see the field. The
  medallion limits were tuned on the GPU, so they are checked again on the
  CPU before this setting ships.
  (Changed by ADR 0012: daily-level and endless matches started as ranked
  attempts always run on the CPU and are recorded and uploaded, whatever
  this setting says.)
- **"Save my matches" (on by default)** decides whether recorded matches
  are uploaded. Off, a replay stays on the device until the next match.
  (Changed by ADR 0012: it governs local matches only. Online matches are
  always uploaded, since the online leaderboard needs both reports and the
  opponent uploads the same match anyway.)
- Couch matches (two players, one screen), ghost races and GPU matches are
  not recorded. The result screen says why.

**The engine records the seats it is told to.** `MatchOptions` gets
`recordedSeats: ReadonlySet<number>`; lockstep-driven seats in it are
recorded from `playGhosts()` as well as live ones, and ghost-race ghosts,
bots and neutral colonies never. Online the recording is therefore the
inputs as played, on the input grid, already change-only; no second
recorder in `Lockstep`. `MatchEngine` also gets an `onSecond` hook that
samples both colony sizes once per second, which feeds the client's score
hint and the server's summary.

**Online matches have an id both devices know without a protocol change.**
The id is `o_` + a hash of the room code, the match number `n` and the
`seed` from `start`, computed by a pure `onlineReplayId()` in the engine.
The client and the server compute the same value. `NET_VERSION` stays as it
is, so old and new builds still play each other.

**Online matches are bound to their room.** Today the host deletes the room
once the guest has connected. Instead, it now replaces it with a stub
`{ host, guest, createdAt, expireAt, taken: true }` without the offer and
answer (whose ICE candidates carry IP addresses), with `expireAt` at most
6 hours after `createdAt`. The server reads the two players' uids from that
stub; nothing a peer says over WebRTC (the `hello` uid) is trusted. A match
reported after the stub expired is stored for whoever reported it, but is
never a public candidate.

### Replay format, version 2

`REPLAY_VERSION` goes to 2. The header carries:

- the **effective plan**: for online matches `mode: 'two-players'`,
  `headStart: 0`, both seats human, so the replay plays both seats as
  ghosts;
- `seats`: per seat `{ isBot }`. **No uids in the replay**; uids live only
  in server metadata;
- online only: `roomCode` and `n` (for the id and the room check);
- `outcome`: `endedBy` and the winner seat as the client saw it;
- `checksum`: the final `matchChecksum` (moves from `net/lockstep.ts` to
  `state/checksum.ts`; lockstep imports it from there);
- `client`: the app version, at most 32 characters of `[\w.-]`, never
  rendered;
- `attempt` (added by ADR 0012), optional: `{ id, at }` of the ranked
  attempt the match was declared as. The server checks it, never trusts it.

There is no `kind` in the header: the server derives it (below). `simulation`
stays, and only `'cpu'` replays are accepted. Version 1 replays (ghost links
in the wild) still parse as ghosts.
(Changed by ADR 0013: a replay with evolution in it - loadouts or weapons
fired - takes version 3, version 2's format plus those fields; versions 1
and 2 stay plain.)

**Parsing is strict.** Ticks strictly increase per input kind and seat;
drag points lie inside the grid; steer magnitude is at most 1; only seats
in `seats` appear; width and height equal the online grid of the level.
The parser caps the inflated size.

**Packed and compressed.** The packing `replay-link.ts` does today (flat
delta-coded integer arrays on the steer and drag grids) moves to
`state/replay-pack.ts`, shared by links and storage. Stored replays are
deflate-raw of the packed JSON, as bytes. `pack(replay, { forPublic: true })`
drops `roomCode`, `n` and `client`; `#ghost=` links and public replays use
it.

Measured sizes, deflated: about 0.4 KB per minute with a keyboard, 1 KB per
minute with touch, 6.6 KB per minute for a joystick that changes every tick,
and 9 KB per minute for an online match with both sticks moving every tick.
The worst case for the one-hour cap (`MAX_TICKS`) is about 550 KB; a
6-minute public replay at most about 60 KB.

**Replays are kept in Firestore, not Cloud Storage.** Every replay fits
under Firestore's 1 MiB document limit, the existing rules and TTL cover
it, and there is no second store to secure and clean up. The blob sits in
a subdocument so lists never load it.

### `BALANCE_VERSION` decides what plays back

A replay plays only on the `BALANCE_VERSION` it was recorded on; pinning
old engines is not feasible. Bots and neutral colonies are simulated again
during playback, so any change to `bot-controller.ts`, `bot-navigation.ts`,
`neutral-brain.ts`, the levels or the maps changes every replay. A
**golden-replay spec** guards this: a committed fixture replay must give a
fixed checksum and outcome, keyed by `BALANCE_VERSION`, and fails when
behaviour changes without a bump.

Public replays keep a **summary** the server computed when it verified
them: final colony sizes, outcome, duration and the per-second size
timeline (at most 360 pairs for a 6-minute match). A public replay from an
older balance shows the summary and timeline, marked "recorded on an older
version - can no longer be played", under a separate heading. A private
replay from an older balance shows its outcome and duration only. Raising
`BALANCE_VERSION` (ADR 0009) now also "retires every playable replay".

### Submission goes through Firestore, not callables

The client never loads `firebase/functions`; the game's `Routes` chunk
keeps its size and the federation config gets no new shared package. It
writes **command documents** the functions process:

- `replaySubmissions/{auto}`: `{ uid, bytes, hint, createdAt, expireAt }`,
  create only, `uid == auth.uid`, `bytes` at most 600,000, `hint` a number 0-100
  (the client's own `replayScore`, used only to rank candidates).
  `expireAt` is set by the client and must equal
  `request.time + duration.value(1, 'd')` (the rules check it), so TTL
  removes a submission a failed function left behind.
  (Added by ADR 0012: `createdAt == request.time`, and an optional
  `attempt`, an attempt id that must exist under the writer's
  `players/{uid}/attempts`.)
- `replayCommands/{auto}`: `{ uid, type, replayId, createdAt, expireAt }`,
  create only, with `expireAt` checked like a submission's. `type` is `remove` (any player), or `feature`, `unfeature`,
  `anonymise` (only with the admin claim, a verified email and Google
  sign-in, checked by the rules and again by the function). The writer may
  read its own command to see the result the function writes back.
  (Added by ADR 0012: the rules require `uid == request.auth.uid` and
  `createdAt == request.time`, and `replayCommand` uses the auth-context
  trigger and refuses unless the writer is `uid`.)

### Data model

| Path                                 | Shape                                                                                                                                                                                                                          | Written by                          | Read by                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------- |
| `replaySubmissions/{auto}`           | see above                                                                                                                                                                                                                      | the player (create only)            | nobody (functions)                                                     |
| `replayCommands/{auto}`              | see above, plus `result`                                                                                                                                                                                                       | the player (create only); functions | its writer                                                             |
| `replays/{id}`                       | `{ players: uid[], kind: 'online' \| 'computer' \| 'daily' \| 'endless', levelId, balanceVersion, replayVersion, createdAt, ticks, endedBy, winnerSeat, hint, state, score?, reasons?, optOut: uid[], galleryOut?, expireAt }` | functions                           | its players                                                            |
| `replays/{id}/blob/data`             | `{ bytes, size }`                                                                                                                                                                                                              | functions                           | its players (`get` only)                                               |
| `replays/{id}/reports/{uid}`         | `{ checksum, inputsHash, winnerSeat, endedBy, at }` (online, one per device)                                                                                                                                                   | functions                           | nobody                                                                 |
| `publicReplays/{publicId}`           | `{ replayId, uids, levelId, kind, balanceVersion, players: [{ label, name?, colorId, avatarPreset }], ticks, endedBy, winnerSeat, score, reasons, summary, featuredAt, featuredBy: 'auto' \| 'admin', day, removedAt? }`       | functions                           | nobody (served by `publicSite`)                                        |
| `publicReplays/{publicId}/blob/data` | `{ bytes, size }` (`forPublic`)                                                                                                                                                                                                | functions                           | nobody (served by `publicSite`)                                        |
| `replayCandidates/{day}`             | the day's verified runners-up                                                                                                                                                                                                  | functions                           | admin                                                                  |
| `limits/{uid}` and `counters/{day}`  | rate limits, daily budget                                                                                                                                                                                                      | functions                           | nobody                                                                 |
| `profiles/{uid}`                     | adds `publicName?: boolean` and `galleryOptOut?: boolean`, missing = false                                                                                                                                                     | owner                               | signed in (unchanged; ADR 0012 adds `boardOptOut` and an admin `list`) |

`state` is one of `submitted` (local), `waiting` (online, one report),
`agreed` (online, both reports match), `disputed` (online, reports differ;
a dead end), `verified`, `unverified`, `balance-mismatch`.

- **Ids are the server's.** Online: `onlineReplayId(roomCode, n, seed)`,
  checked against the header. Local: `l_` + the submission's auto id. Public
  replays get a fresh random `publicId`, not the private id. Writes use
  `create()`; an existing document with other players is rejected.
- **Players are only the uids that submitted.** A local replay has
  `seats = [caller, bot]`, set by the server whatever the client sent. An
  online replay lists a uid once its own report arrives, and only if the
  room stub names it as host or guest.
- **Rules**: no client writes `replays`, `publicReplays`, `reports`,
  `limits`, `counters` or `replayCandidates`. `replays` allows `get` to a
  listed player and `list` only for queries constrained by
  `players array-contains auth.uid` with `limit <= 50`; its blob allows
  `get` only. `publicReplays` is closed to clients altogether: the public
  pages and data come from `publicSite`, cached by Hosting, so there are no
  unauthenticated Firestore reads to abuse. The only rule that reads the
  admin claim is `get` on `replayCandidates` and the admin types of
  `replayCommands`. (Changed by ADR 0012: its admin area adds more rules
  that read the claim, through `isAdmin()`.)
- `publicReplays` documents carry `removedAt: null` until they are removed,
  so queries on `removedAt == null` find them (added by ADR 0012).
- **Retention.** Private replays expire by TTL on `expireAt`, 30 days after
  the match (Firestore's TTL runs up to a day late). Featuring clears
  `expireAt` on the private copy. Public replays stay until removed.
  Submissions and commands expire by TTL after a day.
- Indexes: `replays` on `players` (array-contains) + `createdAt desc`;
  `replays` on `createdAt` + `state` for `featureBest`; `publicReplays` on
  `removedAt` + `featuredAt desc` and `balanceVersion` + `score desc`. TTL
  on `replays.expireAt`, `replaySubmissions.expireAt`,
  `replayCommands.expireAt`.

### Who is named in public

- Public replays label players **"Blue" / "Red"** (their colour), not a
  pseudonym derived from the uid, and draw the preset avatar of that colour.
  Uploaded pictures are never copied.
- A player's chosen name appears only if they opted in with
  `publicName: true` in the profile editor, which explains what that means.
  `defaultProfile` pre-fills the name from the Google account, so the
  default must stay off.
- The name is checked against a small German and English blocklist when it
  is snapshotted; a hit falls back to the colour label. The owner can
  `anonymise` any public replay.
- **Names never appear in server-rendered tags** (title, description, Open
  Graph, Twitter): those say the level and "match of the day". Names show
  only in the page body. Link previews and search snippets therefore carry
  no names.
- `galleryOptOut: true` keeps all of a player's matches out of the gallery.
  `remove` takes one public replay down, records the player in
  `replays/{id}.optOut` and sets `galleryOut`; nothing re-features it, not
  even the owner, and `galleryOut` stays when a deleted account leaves
  `optOut`.
- `profileChanged` updates a player's public replays when they rename or
  turn `publicName` off. Deleting an account (`auth.user().onDelete`)
  removes the uid from `replays.players` and the room's `seats` (also
  where only the other player reported), deletes replays where they were
  the only player, and replaces their name in public replays with the
  colour label.

### The functions codebase

- **New Nx app `apps/bacteria-wars-functions`**, tags
  `["app","type:firebase","type:functions"]`, built with
  `@nx/esbuild:esbuild` (platform node, ESM, bundled, `firebase-functions`
  and `firebase-admin` external, `generatePackageJson`, `engines.node: 22`)
  into `dist/apps/bacteria-wars-functions`, deployed like
  `firebase.pacetrainer.json` (`predeploy: npm --prefix $RESOURCE_DIR
install --omit dev`).
- **It imports the engine through an Angular-free entry point**,
  `libs/features/lazy/bacteria-game/src/engine.ts`, alias
  `@wolsok/feat-lazy-bac-game/engine`:
  - `GameMode`/`isGameMode` move to `state/game-mode.ts`, `ColonyLayer` moves
    into `state/`, `matchChecksum` to `state/checksum.ts`.
  - An oxlint override forbids `@angular/*`, `@ngrx/*`, `rxjs`, Firebase
    and imports of `arena/` from `state/` (apart from its Angular service
    and store files) and from `engine.ts`. A spec bundles `engine.ts` and
    fails on any such input.
  - The functions tsconfig uses `lib: ["es2023"]` (no DOM) and
    `moduleResolution: "bundler"`, so a leak fails the build.
  - The alias is added to the federation `skip` list
    (`tools/federation/workspace-federation.js`); code inside the lib keeps
    relative imports.
  - The verifying code loads the engine with `await import()`, so
    `publicSite` does not pay for it on a cold start.
- **2nd gen, Node 22, one region**: the Firestore location of
  `bacteria-wars` (confirmed by the owner before the first deploy).
  `setGlobalOptions({ region, maxInstances: 5 })`; `initializeApp()` without
  a project id. Triggers run with retries off and are idempotent (a
  transaction checks `state` first). (Changed by ADR 0012: `rankReplay`
  retries for an hour, as a replay it fails to rank would never count.)
- **Deployed with the game's config**: `functions` entry with
  `codebase: "bacteria"`, `source: "dist/apps/bacteria-wars-functions"` in
  `firebase.bacteria-game-remote.json`; its own `deploy` target
  (`--only functions:bacteria`), so the hosting deploy needs no Cloud Build.
  Hosting rewrites name the region explicitly.
- **Emulator**: functions on port 5401; `firebase-emulators` depends on the
  functions `build` and starts `auth,firestore,database,functions`.
- `assertActive(uid)` in `limits.ts` is a no-op until the moderation ADR
  adds bans. (Changed by ADR 0012: it reads `bans/{uid}`, and only
  `acceptReplay` and `replayCommand` (for `remove`) here call it;
  `deletePlayerReplays` and `profileChanged` never do, so a banned
  player's deletion and an owner's profile reset still reach their
  replays.)

### Functions

| Function              | Kind                                                          | What it does                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `acceptReplay`        | Firestore `onDocumentCreated` on `replaySubmissions/{id}`     | Parses (inflation capped, strict v2), derives `kind` and the id, binds players (local: caller plus bot; online: room stub), enforces 60 submissions an hour per uid and a global daily cap, writes `replays/{id}` and its blob with `create()`, or adds the second online report in a transaction and sets `agreed` or `disputed`. Deletes the submission. Cheap: no rerun. 256 MiB. |
| `featureBest`         | scheduled, daily 04:00 Europe/Berlin, 512 MiB, 1 vCPU, 1800 s | Picks at most 20 candidates from the previous day, reruns them, stores `verified` / `unverified` / `balance-mismatch` with summary and score, publishes up to 10, writes the runners-up to `replayCandidates/{day}`. Idempotent per day.                                                                                                                                             |
| `replayCommand`       | Firestore `onDocumentCreated` on `replayCommands/{id}`        | `remove` by a player; `feature`, `unfeature`, `anonymise` by the owner after re-reading the user's current claims with `getUser()` (a revoked claim stops working at once, not after the token's hour). Featuring an unverified replay reruns it first (at most 6 minutes of match, under the 540 s limit). Writes `result`.                                                         |
| `profileChanged`      | Firestore `onDocumentUpdated` on `profiles/{uid}`             | Re-snapshots or removes the player's name in their public replays when `name` or `publicName` changes.                                                                                                                                                                                                                                                                               |
| `deletePlayerReplays` | `auth.user().onDelete` (v1)                                   | As above.                                                                                                                                                                                                                                                                                                                                                                            |
| `publicSite`          | HTTPS behind Hosting                                          | `/replays`, `/replays/{publicId}`, `/replays/index.json`, `/replays/{publicId}/replay.json`, `/sitemap.xml` (below).                                                                                                                                                                                                                                                                 |

(Changed by ADR 0012: `replayCommand` also writes `adminAudit/{commandId}`
for its admin types.)

**Choosing candidates, so the cost has a ceiling.** Nothing is rerun on
submission. `featureBest` takes the previous day's replays that:

- are `submitted` (local) or `agreed` (online), on the current balance,
  and at most 6 minutes long; (changed by ADR 0012: also `verified`
  replays the leaderboards already re-ran, which are not re-run again);
- have only human seats on non-anonymous accounts at least 7 days old; for
  online matches two distinct accounts;
- involve no player with `galleryOptOut` or in `optOut`;
- are ranked by the client's `hint`, at most 3 per uid.

It reruns the top 20 at most (about 20 x 80 s = 1,600 s worst case, inside
the 1800 s timeout and the free 180,000 vCPU-seconds a month), stopping early
when its time budget runs out. Guests can still be featured by hand.

**Kinds are derived, not claimed.** `daily` when the level is the daily
level of that UTC day with its seed and difficulty; `endless` when the
level id parses as an endless recipe; otherwise `computer`. A local
replay with `mode !== 'vs-computer'` is rejected.
(Changed by ADR 0012: `acceptReplay` copies the header's `attempt` into
`replays/{id}.attempt` and derives `daily` for the attempt's day; without
an attempt, for the UTC day of arrival or the day before.)

**Verification is honest about its limits.** The rerun uses Node's V8:

- a mismatch means "unverified", never "cheated", because Safari's and
  Firefox's `Math.sin`/`hypot` may round differently (ADR 0009). Such a
  replay stays playable for its players but is never public;
- the converse holds too: inputs crafted against V8 pass;
- verification proves that the inputs give the outcome, not that a human
  made the inputs. A scripted client can submit a perfect run.

Good enough for a gallery with daily caps and an owner who can unfeature;
the leaderboard ADR has to weigh it.

### What makes a match "especially good"

`state/replay-score.ts` (pure, shared by client and function) computes a
score from 0 to 100 from per-second samples, and the reasons (gallery
badges, through i18n keys `replay.reason.*`):

- **close**: the loser held at least 40 % of the winner's colony at the end,
  or the timed result was within 10 %;
- **comeback**: the winner was at or below half the opponent's size at some
  point after the first 20 s;
- **lead changes**: the larger colony changed at least three times;
- **length**: between 60 s and 6 minutes;
- **feat**: a platinum-level run (no loss below half size) on a hard or
  boss level, or the best verified daily-level replay of the day;
- **online**: an agreed online match between two humans weighs more.

`featureBest` publishes each day at most ten replays scoring 60 or more,
at most one per player and two per level, online matches first. The online
weighting makes agreed online matches the obvious target for cheating
(two accounts, one scripted match); the account-age and non-anonymous rules
and the daily caps are the defence, and the owner unfeatures what slips
through.

### The pages

- **In the game** (under the route with `provideGameCloud`):
  - "Watch replay" on the result screen;
  - "My matches" at `/my-matches` and `/my-matches/{id}`: the last 30 days,
    newest first, `noindex`;
  - the owner's curation page: the runners-up, the public replays, and
    feature / unfeature / anonymise. (Changed by ADR 0012: it is the
    Replays view of `/admin`, in the admin lib `bacteria-wars-admin`, not
    a `/curate` route in the game lib.)
- **Public, server-rendered by `publicSite`**: `/replays` (gallery) and
  `/replays/{publicId}` (one replay, summary and timeline, a share button,
  a "Watch" button). Small HTML pages with their own minimal CSS, not the
  SPA, so link previews and crawlers see the full content, nobody signs in
  as a guest, and each view costs no Firestore reads after Hosting caches
  it. Language: `?lang=de` or English, with `hreflang` alternates; the
  server texts are a small en/de dictionary in the functions app.
- **The viewer** is `/watch/{publicId}`, an SPA route **outside** the route
  with `provideGameCloud` (no Firebase, no account), which fetches
  `/replays/{publicId}/replay.json`. "My matches" uses the same viewer with
  the private blob. The viewer is a new `ArenaViewComponent` (canvas,
  painter, frame pacer) taken out of `bacteria-game.component`, which then
  uses it too: play, pause, 1x/2x/4x, start over. Seeking back needs
  checkpoints and comes later.
- **In the shell** (`angularexamples.wolsok.de`) the gallery is a link that
  opens `https://bacteria-wars.wolsok.de/replays` in a new tab. The public
  pages are not embedded there, so the shell's `SeoService`, which sets the
  canonical to its own URL, never competes with them. "My matches" works in
  the shell and is `noindex`.
- All new client text uses `I18nService` and the `t` pipe, English and
  German, in a new `replay` dictionary area.

### SEO and caching

- Hosting rewrites, before the SPA catch-all and with the region:
  `/replays`, `/replays/**` and `/sitemap.xml` to `publicSite`.
  `/my-matches/**` and `/watch/**` are not rewritten.
- `publicSite` escapes every interpolated value for HTML and attributes,
  escapes `</` in JSON-LD, validates `publicId` with a regex before reading,
  and reads only `publicReplays`: a private id answers 404 like an unknown
  one; a removed one answers 410 and leaves the sitemap.
- `Cache-Control: public, max-age=60, s-maxage=120`. Hosting's CDN cannot be
  purged per URL, so a takedown can take up to two minutes; that is
  accepted. JSON responses send `Access-Control-Allow-Origin: *` (public
  data, so the shell can fetch it).
- A static `robots.txt` with the `Sitemap:` line, disallowing `/watch/`,
  `/my-matches/` and `/admin` (changed by ADR 0012, was `/curate`).
- `/watch/{id}` sets `noindex` and a canonical to `/replays/{id}`.
- CLAUDE.md's "SEO & Sitemaps" section gets a `bacteria-game-remote` entry.

### The admin claim

The owner is recognised by the Firebase Auth custom claim `admin: true`,
never by an email in the repository. The existing
`apps/rollapolla-analog/scripts/grant-admin.mjs` moves to
`tools/firebase/grant-admin.mjs`, used by both projects, and gains:

- a required `--project`, no default;
- production only with `--prod`, otherwise it insists on
  `FIREBASE_AUTH_EMULATOR_HOST`;
- claims merged with the user's existing `customClaims` instead of
  replaced;
- `revokeRefreshTokens(uid)` on revoke;
- `--dry-run`.

The rules and `replayCommand` require `admin == true`,
`email_verified == true` and `sign_in_provider == 'google.com'`.

## Consequences

- The `bacteria-wars` project runs server code for the first time. It needs
  the Blaze plan, the Cloud Functions, Cloud Build, Artifact Registry, Cloud
  Run, Eventarc, Cloud Scheduler and Pub/Sub APIs, an Artifact Registry
  cleanup policy, and for the deploying account Cloud Functions Admin,
  Service Account User on the runtime account and Artifact Registry Writer.
  `FIREBASE_TOKEN` (`firebase login:ci`) is deprecated in firebase-tools 15;
  a move to a service-account key or Workload Identity Federation is due
  but not part of this ADR.
- **Costs**: storage of 1,000 matches a day for 30 days is under 0.5 GB,
  cents a month. Verification is at most 30 reruns a day, about 900 a month,
  inside the free tier. `acceptReplay` is one small invocation and a few
  writes per match. The public pages are cached by Hosting.
- **Abuse**: guest accounts are free, so per-uid limits alone stop nobody.
  The global daily cap bounds storage and writes; candidates are capped by
  number, not by submissions. App Check is not enforced: enforcing it on
  Firestore touches every existing feature and both hosting domains; it can
  start in monitoring mode later.
- Every lib change marks the functions affected, so they redeploy with most
  releases (a few minutes of Cloud Build).
- Every balance change retires every playable replay.
- A replay from Safari or Firefox may fail verification; inputs crafted
  against V8 pass; a scripted run passes.
- The privacy page gets sections on match recordings and the public
  gallery; its line that nobody else sees a player's name is corrected.
- Rules tests need `@firebase/rules-unit-testing` and a running emulator, so
  they run in their own `test-rules` target, wired into CI explicitly.
- Failure modes: if the functions are down or a limit is hit, the
  submission waits (TTL a day) or is dropped (changed by ADR 0012:
  submissions carrying a ranked attempt are exempt from the global daily
  cap, and a dropped one voids the attempt instead of using it up), and the replay stays on the
  device until the next match; the result screen shows "saved" only once
  `replays/{id}` exists. Nothing else in the game depends on the functions.
  A desynced or one-sided online match is stored for whoever reported it and
  never published.

## Rollout

1. Owner: Blaze, Firestore location, APIs, IAM (below).
2. Engine entry point, lint guard, federation skip - no behaviour change.
3. Replay v2, packing, scoring, recorded seats, the sampler, golden replay.
4. Functions app, rules, indexes, emulator; deploy the functions **before**
   the hosting rewrites merge (a release whose rewrites name a function
   that does not exist fails).
   - So far: the app with `acceptReplay`, `replayCommand` (`remove`; the
     gallery's types answer `unsupported` until step 6) and
     `deletePlayerReplays`; the rules for submissions, commands, `replays`,
     `bans` and the room stub, with ADR 0012's `notBanned()` on every
     client write; the indexes and TTL policies; rules and handler specs
     against the emulator. In the code, unlike the text above: a command's
     `expireAt` is checked to lie within two days ahead, since the client
     sets it by its own clock; and an unranked endless match is stored as
     `computer`, as nothing in it tells it from another generated level.
5. Client: room stub, recording settings, submission, "My matches", the
   viewer.
6. `publicSite`, `robots.txt`, privacy text, `/watch`, the curation view
   in `/admin` (changed by ADR 0012); then enable the `featureBest`
   schedule (changed by ADR 0012: only once the Replays view of `/admin`
   has shipped, so the owner can unfeature).
   - So far: `featureBest` (`src/gallery/`), deployed only with
     `FEATURE_BEST_ON` in `src/config.ts`, off until then. At 23:40 UTC,
     not 04:00 Berlin - once the boards stopped verifying the day before,
     whose ranked attempts they verify until 23:00 - it picks that day's
     candidates (accounts looked up for the best hints only), re-runs those the boards have not
     verified within `GALLERY_VERIFY_MS` a day (25 minutes, charged to
     `counters/{day}.galleryVerifyMs`), scores the verified ones with
     `replayScore` on the re-run's per-second timeline (a feat: a
     platinum run against a hard computer or a boss, or the day's best
     daily-level replay), publishes and writes the runners-up to
     `replayCandidates/{day}`, which the owner reads. A ranked attempt
     waits for the boards: only once they verified it is it a
     candidate. A public replay's seats carry the boards' labels
     (`entryLabel`: the name only with `publicName` and when it passes
     the blocklist, the player's preset or one derived from the public
     id); a banned player's match is never published. `remove` and a ban
     take it down (`removeFromGallery`): `optOut` and `galleryOut` on the
     stored replay, then `removedAt` on the public copy, its bytes
     deleted, and the private replay expiring again, at the earliest a
     day later. A deleted account leaves its public replays without its
     uid and with the colour label for its name (`anonymisePublic`).
     Gallery re-runs count in the level statistics like the boards'. Still to come in this step: `publicSite` and the
     rewrites, the gallery's admin types, `profileChanged` for public
     names, and the client pages.
7. Owner: grant the claim, sign out and in, check `/admin` (changed by
   ADR 0012).

## Owner's decisions

Decided by the owner on 2026-10-23:

- "Record local matches" is **on** by default; players can turn it off.
- `@firebase/rules-unit-testing` may be added as a dev dependency for rules
  tests against the emulator.

## Owner's manual steps

- Blaze plan and the APIs above on `bacteria-wars`. Done 2026-10-25
  (Cloud Functions, Cloud Build, Artifact Registry, Cloud Run, Eventarc,
  Cloud Scheduler, Pub/Sub).
- `gcloud firestore databases describe --project bacteria-wars`: the
  location becomes the functions region. Done 2026-10-25: `europe-west1`,
  with the Realtime Database and `BAN_TOMBSTONE_KEY`.
- IAM roles for the deploying account; Artifact Registry cleanup policy.
  Roles done 2026-10-25: the CI token's account is Owner; the cloud
  environment's service account has Cloud Functions Admin, Service
  Account User and Artifact Registry Writer beside Editor and Firebase
  Admin; the build accounts keep their defaults. The cleanup policy is
  still open (below).
- Turn on TTL for the new `expireAt` fields if the index deploy does not.
- First functions deploy by hand (or let CI do it) before the rewrites PR.
  CI does it: `bacteria-wars-functions:deploy` runs with every release
  that affects the app (owner's decision, 2026-10-25, before the Cloud
  Run benchmark). If the first deploy of the Firestore triggers fails on
  the Eventarc service agent's permissions, which a new project grants
  with a delay, run `nx run bacteria-wars-functions:deploy` again a few
  minutes later (rerunning the release's deploy would redeploy every
  affected app).
  Artifact Registry's cleanup policy, once:

  ```bash
  firebase functions:artifacts:setpolicy --location europe-west1 --project bacteria-wars
  ```

- Once: `gcloud auth application-default login`, then
  `node tools/firebase/grant-admin.mjs <email> --project bacteria-wars --prod`.
- After the first deploy: `curl` `/replays`, `/replays/<id>`, an unknown
  id and `/sitemap.xml` (title, description, canonical, robots, status,
  `Cache-Control`).
