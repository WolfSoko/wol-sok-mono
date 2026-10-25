# 12. Bacteria Wars: leaderboards, an admin area with moderation and bans, and a level preference for matchmaking

- Status: accepted
- Date: 2026-10-23
- Builds on: ADR 0010 (profiles, queue, presence), ADR 0011 (functions,
  replays, room stub, admin claim)
- Scope: `libs/features/lazy/bacteria-game`, new
  `libs/features/lazy/bacteria-wars-admin`, `apps/bacteria-game-remote`,
  `apps/bacteria-wars-functions`, `.oxlintrc.json`, `eslint.config.mjs`,
  `tsconfig.base.json`, `tools/federation/workspace-federation.js`

## Context

ADR 0011 gives the game its first server code, stored replays, a headless
re-simulation in Node, server-checked online results and the admin claim.
It left three of the owner's requests to this ADR:

1. **Leaderboards**: (a) overall XP and rank, (b) online wins with a
   record, (c) the daily level (best result of the day, new every day),
   (d) the best endless run. Clients must not write board entries.
2. **An admin area** for the owner, recognised by the custom claim
   `admin: true`, whose code does not weigh on the game: moderate profiles,
   maintain the boards, see statistics, and ban players. A banned player
   can write nothing.
3. **A level preference for matchmaking**, "any level" by default. Already
   decided: preferences do not split the queue. The waiting (older)
   player's preference wins, then the claimer's, then a random level that
   plays online.

What ADR 0011 leaves to build on:

- **Command documents processed by triggers** (`replaySubmissions`,
  `replayCommands`), no callables. The client never loads
  `firebase/functions`.
- **Online results both devices reported**: `replays/{id}` goes to
  `agreed` once two reports from the two uids named in the room stub have
  the same checksum and winner.
- **Re-simulation costs about 41 s of CPU per 3-minute match** (3.8 ms a
  tick, measured once on `petri-dish` with one bot on a dev core). Re-running
  every match is too expensive, so 0011 reruns at most 20 candidates a day.
- **`assertActive(uid)`** in `limits.ts`. Until now it does nothing.
- **The admin claim** is set by `tools/firebase/grant-admin.mjs`. Rules and
  functions require `admin == true`, `email_verified == true` and
  `sign_in_provider == 'google.com'`, and functions re-read the claims
  with `getUser()`.
- **`publicName`** in the profile is the opt-in for showing the chosen
  name in public. It is off by default, because `defaultProfile`
  pre-fills the Google name.

What the game has today:

- **Progress, including XP, is one JSON blob the client writes**
  (`players/{uid}/storage/bacteria-game.progress`). XP is not stored: it
  is computed from the progress (`xpOf`). One match earns at most 150 XP.
- **Local matches use a random seed**, and the daily level is the same
  generated level for everyone on a UTC day (`dailyLevelId`), so it can be
  practised without limit. The player's setup (bot difficulty
  `easy | normal | hard`, head start -2..2) carries over into
  `playDaily()` and `continueEndless()`.
- **An endless run** is a run seed plus wins and three lives. Its levels
  follow from the seed (`endlessLevelId`), and it is kept only in memory.
- **Online status** (`status/{uid}` in the Realtime Database) exists only
  for players who share it.
- **The matchmaking host** (the newer player, who claims) picks
  `Math.random()` over `LEVELS.filter(playableOnline)` in
  `startMatchmadeMatch`. The claim writes only `{ by, code }`.
- **Firestore runs with `persistentLocalCache`**: a write made offline is
  queued and commits later, and a write the rules refuse is rolled back on
  the device.
- **Module boundaries**: a `feature:lazy` lib may not import another one.

## Decision

### What every board guarantees

Each board says in its info line what it can and cannot promise. These
lines are part of the UI text, not fine print.

| Board           | Fed by                                                 | Guarantees                                                                                                                                                                                                                                                                                                                                                                     | Does not guarantee                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rank (XP)**   | the player's stored progress                           | The server computes the XP from the stored progress with the game's own `xpOf`, so a client cannot post a bare number. Board XP rises no faster than a human could earn it: at most 2,000 + 3,000 an hour since the last count, and 20,000 a day.                                                                                                                              | That the matches happened. A modified client can claim XP up to the cap, and every new account can do so: free guest accounts can each climb at the capped rate. The owner hides or bans.                                                                                                                                                                                        |
| **Online wins** | `agreed` online replays (ADR 0011)                     | Both players' devices reported the same result for a match of at least 30 s, in a room whose stub names both uids, and the room had existed at least as long as its matches lasted. One honest player is enough to stop a forged result. "Not reported" shows how many matches the player's opponent reported and the player did not.                                          | That the match was played honestly: two colluding clients can report a made-up match. Throwaway guest accounts can farm wins up to the caps: at most 3 counted results per pair a day, at most 5 counted wins a day against opponents younger than 3 days, at most 30 counted wins a day in all. A player who disconnects avoids the loss; it shows only in "Not reported".      |
| **Daily level** | replays of declared attempts on that day's daily level | In the **verified top 10**, every entry was re-simulated on the current balance and gives the claimed result, on the ranked setup (normal bots, no head start). Each match started after its attempt was declared, because the seed comes from the declaration's server time, and was uploaded within 5 minutes of its end. A player account has at most three attempts a day. | That a human played: a scripted client, or inputs crafted against V8, pass. Inside its window of match length plus 5 minutes, a scripted client can still search for good inputs on many cores, faster than real time. Entries outside the verified zone are claims checked only for plausibility (right level, seed, setup and timing), not by re-simulation, and show no name. |
| **Endless**     | replays of declared run matches                        | In the **verified top 10**, every win of the run was re-simulated. Every declared match counts, so a match whose replay never arrives in time is a lost life. A run's levels are fixed once it starts. A player account starts at most five ranked runs a day.                                                                                                                 | The same limits as the daily board. A player may abandon runs whose levels they dislike, up to five a day. Outside the verified zone, runs are claims.                                                                                                                                                                                                                           |

A failed re-simulation means **"could not be confirmed"**, never "cheated".
ADR 0009 and 0011 note that Safari and Firefox may round `Math.sin` and
`hypot` differently from Node's V8.

### Boards, periods and scores

| Board id           | Period                                             | One entry per               | Score (`sort`, higher is better)                                                                         |
| ------------------ | -------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `xp`               | all time                                           | player                      | board XP                                                                                                 |
| `online`           | all time                                           | player                      | `wins × 10⁶ + (10⁶ − 1 − losses)`                                                                        |
| `daily-YYYY-MM-DD` | one UTC day, new at 00:00 UTC like the daily level | player (their best attempt) | a win: `10⁷ + (MAX_TICKS − ticks)`, so faster is better. A loss: `ticks`, so holding on longer is better |
| `endless`          | all time                                           | player (their best run)     | `depth × 10⁷ + (10⁷ − 1 − seconds of the winning matches)`                                               |

- **Every score fits one number**, `sort`, so a board needs one composite
  index, and a rank is one `count()`. Ties share a rank (competition
  ranking: 1, 2, 2, 4). The display order among tied entries is by
  `atHour` (the hour the score was reached), then by entry id. Entries keep
  no finer time, so a row does not tell when a player plays.
- **`depth`** is the number of levels a run won before its third lost
  life. A run still going counts at its current depth.
- **A daily or endless match longer than 10 minutes is never re-run.** It
  stays provisional (rare).
- **The ranked setup** is fixed, so entries compare like with like:
  `rankedPlan(levelId, seed)` in `state/attempts.ts` returns
  `mode: 'vs-computer'`, bot difficulty `normal`, `headStart: 0`, the
  player in seat 0, the level's online grid and the default colours. A
  ranked attempt always plays this plan, whatever the player's setup says,
  and the result screen shows "Ranked setup". `rankReplay` compares the
  replay's whole effective plan with `rankedPlan(...)` and refuses any
  difference (`rankedReason: 'plan-mismatch'`).
- `state/boards.ts` (pure, shared by the client, the functions and the
  admin lib) holds the board ids, the sort encodings, the cut sizes, the
  label format and the XP caps. The verification budgets are server-only
  and live in the functions app (`boards/budgets.ts`).

### Who appears and under which name

- **Every account with a counted fact appears, guests included**, unless
  it opted out. Most players are guests, and boards without them would be
  nearly empty. Entries are created by the server on the first counted
  fact, never by the client.
- **Opting out**: `boardOptOut: true` in the profile (missing = false,
  like 0011's `galleryOptOut`) keeps all of the player's entries hidden.
  The functions keep counting in the background, so turning it off brings
  the entries back. The profile editor shows it next to the name opt-in.
- **Boards are effectively public.** They are read inside the game, and
  every visitor gets a guest account automatically, so anyone can read and
  page them. They are not served by `publicSite` and not in the sitemap.
  The privacy page says so in those words.
- **Entries carry no uid, and each board kind has its own entry id.**
  `boardMembers/{uid}.entryIds` holds one random id each for `xp`,
  `online`, `daily` (the same on every day) and `endless`. Only the player
  and the owner can map them. Rows on two boards therefore cannot be tied
  together, and none can be tied to a profile.
- **The name**:
  - With `publicName: true` (ADR 0011), a `counted` or `verified` entry
    shows the profile name, checked against 0011's blocklist. A blocked
    name falls back to the label.
  - Provisional and stale entries never show a name, so an unchecked claim
    is never a billboard.
  - Otherwise the label is "Anonymous #4821" (`boards.anonymous`, German
    "Anonym #4821"). The number is a `tag` derived from that board's entry
    id. The blocklist also refuses names that copy this pattern or the
    `defaultProfile` pattern "Player NNNN", so no opted-in name can pose as
    another row.
  - The profile editor's `publicName` text becomes "Show my name in
    public: in the match gallery and on leaderboards".
- **The picture** is always a preset avatar: the player's own preset if
  they opted in and use one, otherwise one derived from the entry id.
  Uploaded pictures and Google photos never appear on a board.
- **Relabelling reaches every board.** `boardMembers/{uid}.boards` lists
  every board id holding one of the player's entries (the all-time boards
  and up to 31 daily ones). When the name, `publicName`, `boardOptOut` or a
  preset avatar changes, `boardProfileChanged` relabels all of them, so
  withdrawing the opt-in or a moderation reset reaches past daily boards
  too.
- A banned player's entries are hidden.

### Rank (XP)

- **Fed by `rankProgress`**, a trigger on writes to the literal path
  `players/{uid}/storage/bacteria-game.progress`, so settings writes do
  not invoke it (if Eventarc refuses the dot in a literal id, the trigger
  takes `{key}` and returns at once for any other key). It parses the
  progress with `parseProgress` and computes `xpOf`. Both are pure and come
  through the engine entry point (`@wolsok/feat-lazy-bac-game/engine`,
  ADR 0011).
- **Ledger** in `boardMembers/{uid}.xp`: `{ counted, claimed, lastAt,
firstAt, risenToday, todayDay }`.
  - When the claimed XP is at or below `counted`, `counted` follows it
    down: a reset progress lowers the board.
  - Above it, the board XP rises by at most
    `min(2,000 + 3,000 × hours since lastAt, 20,000 − risenToday)`.
  - `risenToday` sums the **gross rises** of the UTC day. A fall never
    gives room back, so writing low and then high cannot reuse the daily
    cap.
  - **The first count allows up to 25,000 at once only for players from
    before the launch**: the progress document's server `createTime` (from
    the trigger snapshot, which clients cannot forge) is before
    `XP_FULL_COUNT_BEFORE` in `boards.ts`, 2026-10-25 00:00 UTC (the
    owner's cut: every account of 2026-10-24 and before). Every
    other account starts at the hourly cap like any later rise.
  - XP still above the cap waits for the next progress write; every match
    writes one.
- **Why not more**: most local matches run on the GPU and are not
  recorded (ADR 0011), so no server can recount them. Recording every
  match on the CPU would cost every player frame rate and the server about
  14 s of CPU per match-minute. The cap bounds what a modified client
  gains per account and day; the owner removes outliers.
- The board shows the XP and the rank badge (`rankFor`). A guest who
  signs in to an existing Google account brings their progress over
  (`adoptProgress`); the jump falls under the same cap.
- `rankProgress` also writes `boardMembers/{uid}.activeAt`, which the
  statistics count.

### Online wins

- **Online matches are always uploaded** (this changes ADR 0011). "Save my
  matches" now governs local matches only. The opponent's device uploads
  the same match anyway, so the player's own upload adds only their
  report. Without it, "Not reported" (below) would punish everyone who
  turned saving off, and a player could hide losses by turning it off.
- **Fed by `rankReplay`**, a trigger on `replays/{id}` writes, which
  returns at once unless `state` or the player list changed. When an
  online replay turns `agreed`:
  - The winner seat maps to a uid through the room stub (host = seat 0,
    guest = seat 1).
  - `endedBy: 'desync'` counts nothing. A timed match without a winner is
    a draw.
  - **Plausible timing**: the match lasted at least 30 s (1,800 ticks),
    and the second report arrived no earlier than the stub's `createdAt`
    plus the summed length of every agreed match of that room up to `n`,
    less 60 s. `rankedRooms/{roomCode}` (functions only) keeps the summed
    ticks, keyed by the stub's `createdAt` so a reused code starts over.
    Rooms cannot run matches in parallel faster than real time.
  - **Caps**, in one transaction with the count:
    - at most 3 counted results per pair of uids per UTC day
      (`pairs/{day}_{uidA}_{uidB}`, uids sorted);
    - at most 5 counted wins a day against opponents whose Auth account is
      younger than 3 days;
    - at most 30 counted wins a day in all (`boardMembers/{uid}.online`).

    Losses count whenever the pair cap allows.

  - The win, loss or draw is added to both entries in one transaction.
- **Idempotent**: a marker `rankedReplays/{replayId}` is written with
  `create()`, so a second event for the same replay changes nothing.
- **"Not reported"**: the hourly function closes online replays still
  `waiting` 2 hours after their creation. `acceptReplay` gives a waiting
  replay `closeAt` (its first report + 2 h), and the second report or the
  close removes it. The sweep asks for `closeAt` up to now, 500 at a time,
  so a closed replay that stays `waiting` leaves its query, and a missed
  run is caught up by the next. If the existing report has a regular ending (win, timeout or
  forfeit after 30 s), the stub's other uid gets `notReported + 1`. A
  network loss usually leaves both devices reporting, or the reports
  disagree (`disputed`), which counts for nobody. So the figure mostly
  catches a device that withheld its upload. It is shown on the row and in
  the player's own record, but is not part of `sort`: a phone that died at
  the wrong moment cannot be told apart from a quitter.
- **Not counted** (the result screen says "Not counted" with the reason):
  - `waiting` matches (one report), such as a player quitting or a
    connection lost;
  - `disputed` matches;
  - matches shorter than 30 s, or faster than the room's clock allows;
  - matches with a banned player (the other side still counts nothing);
  - matches whose stub expired;
  - results beyond a cap.
- **The display** is `W 42 · L 17 · D 3` and the win rate, shown after at
  least 10 counted matches, with "Not reported: 2" when it is above zero.

### Declared attempts: tying a daily or endless match to the server's clock

A replay proves that its inputs give its result. On its own it does not
prove when the match was played, or that it was not the best of a hundred
private tries. A daily level is the same for everyone and can be practised
without limit. Three things make an attempt count:

1. **Before a ranked match the client declares it**, inside a Firestore
   transaction, which fails when offline instead of being queued by the
   persistent cache:
   `players/{uid}/attempts/{attemptId}` = `{ at: request.time, expireAt }`,
   create only, no update or delete, `keys().hasOnly(['at', 'expireAt'])`,
   `at == request.time`, and `expireAt` within 32 days of `request.time`
   but at least 28 days ahead (a shorter one would let TTL delete the
   attempt while its id could be declared again; 28 lets the device clock
   the client takes the 31 days from run 3 days slow).
   - The rules check the id:
     - `d_YYYY-MM-DD_n`: `n` from 1 to 3, the day equals the UTC date of
       `request.time` (`timestamp.date()` against the parts of
       `day.split('-')`), and for `n > 1` attempt `n − 1` exists.
     - `e_<runId>_<i>`, with `runId` = `YYYYMMDD` + `r`, `r` from 1 to 5
       and `i` from 0 to 999. For `i == 0` the date is the UTC date of
       `request.time`, and for `r > 1` run `r − 1` of that day has its
       attempt 0. For `i > 0` attempt `i − 1` of the run exists. So a
       player starts at most five ranked runs a day, and a run may go on
       past midnight.
   - After the commit, the client reads the document with
     `getDocFromServer` and uses `at.toMillis()`. That is about 300 ms
     before the countdown. The countdown waits up to 3 seconds in all.
2. **The match seed comes from the declaration**:
   `seed = attemptSeed(uid, attemptId, atMillis)` (pure, in
   `state/attempts.ts`), and the match plays `rankedPlan(levelId, seed)`.
   - Bots and neutral colonies depend on the seed, so inputs played before
     the declaration do not give the same match.
   - An endless run's level seed is the seed of its attempt `e_<runId>_0`,
     so the run's levels cannot be picked in advance either.
3. **The replay must arrive soon after the match.** `replaySubmissions`
   gains a `createdAt == request.time` rule and an optional `attempt` field
   (this changes ADR 0011). The deadline is
   `attempt.at + 5 s countdown + ticks / 60 s + 300 s`, measured against
   the submission's `createdAt`. A later upload is stored like any replay
   but never ranks (`rankedReason: 'late'`), and the attempt counts as
   used. Without this bound a declared seed could be searched offline for a
   whole day.

The replay header (v2, ADR 0011) carries `attempt: { id, at }`. When a
replay arrives, `rankReplay` checks without re-running it, always against
the stored attempt document, never the header's copy of `at`, that:

- the attempt exists for that uid;
- the seed matches;
- the effective plan equals `rankedPlan(levelId, seed)`;
- the level matches: `dailyLevelId(day)`, or
  `endlessLevelId({ seed: runSeed, wins })` with the wins claimed before
  this attempt;
- `at + match time ≤ arrival + 120 s`, so the declaration came before the
  match;
- the submission's `createdAt` is within the deadline above;
- it is the first replay for that attempt.

A replay that fails these checks never ranks. Its `rankedReason` is set
on the replay and shown on the result screen.

**When the client cannot be sure the declaration counted.** If the
transaction or the read-back fails or times out, the match starts unranked
with a random seed and says so. The declaration may still have committed
on the server, where it then counts as used. In endless, the client marks
the rest of that run unranked ("This run is no longer ranked") instead of
declaring further attempts that would fail the level check.

**Server-side drops never cost an attempt.** Submissions that carry an
attempt do not count against ADR 0011's global daily cap, which unranked
replays could otherwise use up. They have a global daily cap of their own
instead, 20,000 ranked submissions a day in `counters/{day}`, since the
attempt rules bound them per account only (three a day, one per endless
match, five runs a day) and guest accounts are free. The per-uid hourly
limit still applies, counted apart for ranked and unranked submissions
(60 each in `limits/{uid}`), so a player cannot push their own ranked
replay out with unranked uploads and have it voided. A ranked submission
over the day's cap is dropped and its attempt marked `void` (it still
counts against the player's hour, which bounds what such drops cost); one
over the player's own hourly limit is not voided, as the player chose to
send that many.
`acceptReplay` retries a submission it fails on for an hour, then gives
up: it deletes the submission and marks the attempt `void`. Nothing a
client sends makes acceptance throw (the parser answers null), so only a
failure of ours voids. Taking a submission's slot deletes the
submission, so a retry, working from its event's copy, finds none and
counts it no second time. The first stored replay of an attempt uses it
up: `acceptReplay` writes its id into the attempt (`replayId`) with the
replay, and an attempt that has one is never voided, whatever a later
submission naming it brings. Both marks go only on the declaration a
submission can be of: one declared again after the submission was sent
is left alone.

A `void` attempt (`void`, `voidReason`, `voidedAt`, written by the
functions only) never ranks: a replay of it gets `rankedReason: 'void'`.
It costs nothing:

- A void daily attempt may be declared again in its place, on its day:
  the rules let its player replace the document with a new declaration,
  `at` and `expireAt` only, so the attempt gets a new seed.
- A void endless match counts as not played, neither a win nor a lost
  life, and the run goes on with the next match. The run's `declared`
  leaves it out; match 0 still gives the run its seed. A match after it is
  checked against the level the run is at without it, so a player who won
  the void match and played on at the next level loses a life to the level
  check. On a give-up an hour after the match the player has usually
  played on, so in that case the drop still costs a life, unless the void
  match was lost. This rule is open for the owner to change.

**Without a declaration a match is simply unranked**: offline, or ranked
play switched off.

**Ranked matches run on the CPU and are recorded.** A board can only
compare runs on the same simulation, and the GPU simulation differs
between drivers. A daily or endless match started as a ranked attempt
therefore runs on the CPU simulation at the online grid, and is always
recorded and uploaded, whatever "Record local matches" and "Save my
matches" say (this changes ADR 0011). A new setting, **"Ranked daily and
endless" (on by default)**, lets a player on a weak device keep the GPU
and their own setup, and go unranked. The medallion limits of generated
levels are checked again on the CPU before this ships, as ADR 0011
already requires for its recording setting.

**Ranked attempts and the medallion's attempts** stay two counts. The
three ranked attempts of a day are the server's; the local
`DAILY_ATTEMPTS` count (medallion and streak) is the progress's, as today.
A ranked attempt also counts as a local one while any are left; an
unranked daily match spends only a local one. The result screen says
"Ranked attempt 2 of 3".

### Daily level

- **Accepting**: `rankReplay` takes a daily replay that passes the checks
  into `dailyRuns/{day}_{uid}` (the attempts, their claimed `sort`, their
  `state`). The player's entry on `daily-{day}` is their best attempt that
  has not failed verification, with that attempt's status.
- **Lazy verification** by the hourly function (below), from a candidate
  list ordered by trust first, then by score:
  1. accounts linked to Google and at least 7 days old, or with an earlier
     verified entry;
  2. accounts at least 3 days old;
  3. the rest.

  Candidates are provisional entries whose `sort` would put them into the
  top 10 (above the 10th verified entry, or any while fewer than 10 are
  verified). With budget left, the next 10 provisional entries follow.
  - At most one candidate per account per board and day.
  - An account with two failed checks in 7 days is skipped for 7 days and
    flagged for the owner (`moderation/{uid}.failedChecks`), not banned:
    a failure may be Safari.
  - Each attempt is re-run once, and a re-run stops at the claimed end
    tick, so refuting a fake is as cheap as the fake's claimed length.
  - `verified` keeps its place. `unverified` or `balance-mismatch` marks
    the attempt, and the entry falls back to the player's next best
    attempt.

- **The cut**: ranks 1-10 show only verified entries. Up to 5 provisional
  entries that would rank there show in a "Being checked" strip under
  them, by label only and without a rank number.
- **The day closes**: verification of day D goes on until 23:00 UTC on
  D + 1. Then the top document gets `final: true`. Entries still
  provisional stay marked as such. Daily boards are kept 31 days (TTL), so
  the screen can show the last 7 days.

### Endless

- **A run** is `endlessRuns/{uid}_{runId}`: the run seed, and per declared
  match its index, the attempt, the replay id, the claimed result and its
  verification state. The document is created by the first accepted
  replay of the run, and computed then from all of the run's declared
  attempts, so a declared match before it without a replay already counts
  as a lost life. A run with no accepted replay has no wins and nothing to
  rank, so its attempts are ignored.
  - A declared match without a replay or a pending submission 2 hours
    after its `at` counts as a lost life. `rankReplay` applies this
    lazily whenever it touches the run, and the hourly function sweeps the
    rest.
  - Replays may arrive in any order; the run is recomputed from all of its
    attempts in a transaction each time.
  - The player's entry on `endless` is their best run that has not failed
    verification.
  - A run that is not the player's best expires 31 days after its last
    update (`expireAt`); the best run keeps no `expireAt`.
- **Verification is incremental and in order**, from the same trust-ordered
  candidate list: runs that would enter the top 10, then the next 10.
  - The hourly function re-runs the run's wins one by one, keeping
    `verifiedWins`.
  - If win `k` fails, the run is cut to its verified prefix: depth `k`,
    status `verified`, marked "partly confirmed". Its remaining wins are
    dropped.
  - A run of depth 30 at about 90 s per match is 45 match-minutes, a
    quarter of a day's endless budget.

### Verification budget, shared with ADR 0011

`verify.ts` in the functions app (part of ADR 0011's functions package),
the rerun `featureBest` uses, does the work for every caller. Its result is
stored on `replays/{id}` (`state`, `summary`). `featureBest` accepts a
replay the boards already verified as a candidate without re-running it
(this changes ADR 0011), and the boards accept a replay `featureBest`
verified.

**The CPU figure is measured before the budgets are fixed.** The only
measurement so far is one bot on `petri-dish` on a dev core. The board
functions' work package first benchmarks a generated level at the highest
daily difficulty (7), on the largest map, with neutral colonies, at the
online grid, on a 1 vCPU Cloud Run instance, and sets `budgets.ts` from it.
The table assumes 20 s of CPU per match-minute:

| Budget              | Match-minutes a day | CPU                                         |
| ------------------- | ------------------- | ------------------------------------------- |
| daily board         | 60                  | 1,200 s                                     |
| endless board       | 180                 | 3,600 s                                     |
| admin "verify now"  | 20                  | 400 s                                       |
| **0012 total**      | **260 (hard cap)**  | **5,200 s, about 156,000 vCPU-s a month**   |
| ADR 0011 worst case | 20 reruns of ≤ 80 s | 1,600 s, about 48,000 vCPU-s a month        |
| light triggers      | about 50,000 a day  | about 40,000 vCPU-s a month on `gcf_gen1`\* |

\* The light triggers (`acceptReplay`, `rankReplay`, `rankProgress`,
`rebuildTop`, `boardProfileChanged`, `profileChanged`) run with
`cpu: 'gcf_gen1'` (a fraction of a vCPU at 256 MiB) instead of the 2nd-gen
default of one vCPU.

Together about 245,000 vCPU-s and 280,000 GiB-s a month, against Cloud
Run's free 180,000 vCPU-s and 360,000 GiB-s: about $1-4 a month above the
free tier, bounded by the hard cap. Unused daily budget passes to endless.
An exhausted budget never shows a claim as verified: rows wait in "Being
checked". A slice starts a re-run only when its expected cost fits in
what the slice has left (`expectedRerunMs` in `budgets.ts`: 10 ms a tick
for `gpu-int` on the base arena, which every ranked level has, from the
closed #2618's benchmark on a development machine until the Cloud Run one
replaces it), so it never starts a 10-minute match at minute 24. It
charges its time to the day in steps of at least a minute as re-runs end,
and the rest at the end, so a slice cut short by the function's timeout
has paid for all but its last minute or re-run, and `counters/{day}`,
which every upload's slot reads, takes a write a minute at most.

**Flooding** with fake top claims from many fresh guest accounts no longer
starves honest entries: trust ordering puts fresh accounts last, each
account gets one candidate a day per board, and an account that fails
twice drops out for a week. Fakes cost the budget only once the trusted
candidates are done, and never show a name.

**A balance change** (`BALANCE_VERSION`): provisional entries recorded on
the old balance can no longer be re-run. They become `stale` and leave the
zone. Verified entries keep their status and show "older version". A
release that changes the balance should not go out in the middle of a busy
UTC day.

### Data model

All of it is written by functions only, except `attempts`,
`adminCommands` and the new profile flag.

| Path                                          | Shape                                                                                                                                                                                                                                                | Read by                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `boards/{boardId}`                            | the top document: `{ board, day?, cut, rows: Row[] (≤ 50), final?, balanceVersion, updatedAt, expireAt? }`. `Row` = `{ entryId, sort, atHour, pos, rank?, status, name, tag, avatar, show }`                                                         | signed in (`get`)                         |
| `boards/{boardId}/entries/{entryId}`          | `{ sort, atHour, status: 'counted' \| 'verified' \| 'provisional' \| 'stale' \| 'hidden', name: string \| null, tag, avatar: 0..11, show: { xp, rank } \| { w, l, d, nr } \| { ticks, won } \| { depth, seconds, partial? }, updatedAt, expireAt? }` | signed in, never `hidden` ones; admin all |
| `boardMembers/{uid}`                          | `{ entryIds: { xp, online, daily, endless }, boards: string[], barred: boardKind[], hiddenBy: { [boardId]: 'ban' \| 'admin' \| 'optout' }, xp: {...}, online: { day, wins, newOpponentWins }, accountCreatedAt, googleChecked, activeAt }`           | its player (`get`), admin                 |
| `players/{uid}/attempts/{attemptId}`          | `{ at, expireAt }`, created by the player                                                                                                                                                                                                            | its player                                |
| `players/{uid}/notices/{id}`                  | `{ type: 'profile-reset' \| 'image-removed' \| 'board-hidden' \| 'banned' \| 'unbanned', at, until?, reason?: 'cheating' \| 'offensive-profile' \| 'spam' \| 'other', expireAt }`                                                                    | its player (read and delete)              |
| `dailyRuns/{day}_{uid}`                       | the day's attempts: `{ attemptId, replayId, sort, state }[]`                                                                                                                                                                                         | nobody                                    |
| `endlessRuns/{uid}_{runId}`                   | `{ seed, attempts: [...], claimedDepth, verifiedWins, status, updatedAt, expireAt? }`                                                                                                                                                                | nobody                                    |
| `pairs/{day}_{uidA}_{uidB}`                   | `{ count, expireAt }`                                                                                                                                                                                                                                | nobody                                    |
| `rankedReplays/{replayId}`                    | `{ at, expireAt }`                                                                                                                                                                                                                                   | nobody                                    |
| `rankedRooms/{roomCode}`                      | `{ stubCreatedAt, ticks, expireAt }`                                                                                                                                                                                                                 | nobody                                    |
| `bans/{uid}`                                  | `{ since, until: timestamp \| null, reason }`                                                                                                                                                                                                        | its player (`get`), admin                 |
| `banTombstones/{hmac}`                        | `{ until, reason, expireAt }`, keyed by an HMAC of a banned account's Google provider uid                                                                                                                                                            | nobody                                    |
| `moderation/{uid}`                            | counters: `{ resets, imageRemovals, hides, bans, failedChecks, skipUntil? }`                                                                                                                                                                         | admin                                     |
| `adminCommands/{id}`                          | `{ uid, type, target, reason, args, createdAt, expireAt, result? }`                                                                                                                                                                                  | admin, own commands                       |
| `adminAudit/{id}`                             | `{ at, by, type, target, reason, before, after, ok, source: 'adminCommand' \| 'replayCommand' \| 'system', expireAt }`                                                                                                                               | admin                                     |
| `adminStats/now`, `adminStats/h_{yyyymmddhh}` | the statistics (below)                                                                                                                                                                                                                               | admin                                     |
| `stats/accounts`                              | `{ total, updatedAt }`                                                                                                                                                                                                                               | nobody                                    |
| `profiles/{uid}`                              | adds `boardOptOut?: boolean`, missing = false                                                                                                                                                                                                        | signed in; `list` for admin only          |
| `replays/{id}`                                | ADR 0011's document; adds `attempt?: { id, at }`, `rankedReason?` and `rankedAt?`                                                                                                                                                                    | unchanged                                 |
| `replaySubmissions/{auto}`                    | ADR 0011's document; adds `attempt?: string` (an attempt id that exists for the writer), and `createdAt == request.time`                                                                                                                             | unchanged                                 |
| `queue/{uid}`                                 | adds `level: string \| null`; `claim` may add `level` and `pick`                                                                                                                                                                                     | unchanged                                 |
| RTDB `connections/{uid}`                      | `{ state: 'online' \| 'playing', at }`, validated like `status` (`$other: false`), written by every signed-in client, removed by `onDisconnect`                                                                                                      | nobody (`.read: false`; functions count)  |
| RTDB `bans/{uid}`                             | the ban's end in milliseconds, `0` for permanent; mirrors `bans/{uid}`                                                                                                                                                                               | its player                                |

- **The player-readable ban holds no admin identity.** `by` and the
  command id live only in `adminAudit`, so a banned player cannot learn the
  owner's uid.
- **Top documents** hold the first 50 rows, already ordered, with `pos`
  (1 + the number of visible entries with a higher `sort`) and, inside the
  cut, the verified `rank`.
  - Writers change only entries. **`rebuildTop`**, a trigger on entry
    writes with `maxInstances: 1` and `concurrency: 1`, rebuilds a top
    document one at a time, so ranking functions never contend for it. It
    returns at once unless the entry was in the top document or now beats
    its last row (`Row.sort`). Rebuilding queries the top 50 visible
    entries and the top `cut` verified ones. A daily board's entries and
    its top document expire 31 days after its day, counted from the day
    rather than the write (`dailyBoardExpiresAt`), and the deletion of an
    entry already past its `expireAt` (TTL draining a board) rebuilds
    nothing.
  - A screen therefore costs one read for the top 50, and at most one top
    document rewrite per relevant change.
- **TTL** on `expireAt`:
  - 31 days: `attempts`, `notices`, the daily boards' entries and top
    documents (`daily-{day}`, counted from their day), `dailyRuns`, `rankedReplays`, `endlessRuns`
    that are not a best run. The all-time boards (`xp`, `online`,
    `endless`) set no `expireAt` on their top documents or entries, which
    stay until removed or the account is deleted;
  - 2 days: `pairs`;
  - 6 hours after the stub's `expireAt`: `rankedRooms`;
  - 1 day: `adminCommands`;
  - 90 days: `adminStats` hours;
  - 2 years: `adminAudit`;
  - the ban's end, at most 2 years: `banTombstones`.
- **Indexes**:
  - `entries` (collection scope): `status` + `sort desc` + `atHour asc`;
  - `profiles`: `avatar.kind` + `updatedAt desc`;
  - `adminAudit`: `target.uid` + `at desc`, and `type` + `at desc`;
  - `rooms`: `taken` + `expireAt`, and the single-field `expireAt` index
    restored next to its TTL (today's override sets `indexes: []`);
  - `boardMembers`: `activeAt` (single field, default);
  - `replays`: `state` + `createdAt` (ADR 0011's, used for "Not
    reported").
  - Every aggregation and query of this ADR is listed in a spec that checks
    it against `firestore.indexes.json`, because the emulator does not
    enforce composite indexes.

### Reading a board

- **The top 50** is a `get` of `boards/{boardId}`, live (`onSnapshot`)
  while the screen is open.
- **Further pages**: `boards/{id}/entries` with `status in ['counted',
'verified', 'provisional', 'stale']`, `orderBy(sort desc, atHour asc)`,
  `startAfter`, 25 at a time. Positions past 50 are counted by order.
- **The player's own row** comes from `boardMembers/{uid}.entryIds`, read
  once, then a `get` of the entry. That is one read per board.
- **The player's own rank, without a scan**:
  - if the player's own `sort` is at or above the top document's last
    row, the rank comes from the top document;
  - otherwise `count()` of visible entries with `sort > mine`, plus 1.
  - "#37" is that visible position. On daily and endless, a provisional
    own row says "#12, being checked" and a verified one inside the cut
    shows its verified rank.

  An aggregation costs one read per 1,000 index entries it counts, so
  100,000 players cost 100 reads. Rules cannot require a `limit` on a
  `count()`, so `entries` allows `list` to any signed-in player (see
  Consequences).

- `firebase-connection.ts` gains `getCountFromServer`, `startAfter`,
  `runTransaction` and `getDocFromServer`. As before, it is the only file
  that imports Firebase at runtime.

### Leaderboards screen

- A **"Leaderboards"** entry in the main menu opens a screen of the single
  stage, in and out of fullscreen like every other screen, with four tabs:
  **Rank**, **Online**, **Daily**, **Endless**.
- Each tab shows:
  - the info line from the table above;
  - on daily and endless, the verified top rows, then "Being checked",
    then everyone else, with provisional rows marked;
  - the player's own row pinned at the bottom: "You: #37", "#12, being
    checked", or "Not on this board yet: …" with the reason, such as
    ranked play off, opted out, or no counted match yet;
  - paging.
- **Daily** shows "New board in 5 h 12 min" (to 00:00 UTC) and a day
  picker for the last 7 days.
- **Material components only**: tabs, list, chips for status, a progress
  bar.
- **The result screen** after a ranked match says "Ranked attempt 2 of 3 ·
  provisional #4 today", "Not ranked: offline when the match started",
  "Not ranked: the three attempts of today are used", or "Not ranked:
  uploaded too late". It never names the opponent's board label. For
  online it says "Counted" or "Not counted: …".
- **Without a Firebase project** (dev builds) the screen says that boards
  need the online game.
- **All text goes through `I18nService` and the `t` pipe**, English and
  German, in a new `boards` area. The ranked-match lines go in `boards`
  too, and the notices and the ban banner in a `moderation` area. Times are
  formatted with the language's `Intl` formatter.

### The admin area

**Its own lib, loaded only on its route.**

- New Nx lib `libs/features/lazy/bacteria-wars-admin`, **not buildable**
  (the game lib is buildable, and a buildable lib could not consume the
  game lib's secondary alias without an ng-packagr entry):
  - project `feat-lazy-bacteria-wars-admin`, alias
    `@wolsok/feat-lazy-bac-wars-admin`;
  - selector prefix `feat-lazy-bac-admin`, added to `selectorPrefixes` in
    `eslint.config.mjs`;
  - tag `feature:admin`.
- `.oxlintrc.json` gets one constraint: `feature:admin` may depend on
  `feature:lazy`, `feat-shared`, `shared`, `utils` and `api`. The `app`
  constraint also allows `feature:admin`.
- **The admin lib imports the game lib only through a narrow, Angular-only
  entry**, `libs/features/lazy/bacteria-game/src/admin-kit.ts`, alias
  `@wolsok/feat-lazy-bac-game/admin-kit`. It exports:
  - `provideGameCloud` and the cloud accessors;
  - `I18nService` and the `Translation` helpers;
  - `AvatarComponent` and `defaultProfile`;
  - the board and admin-command contracts.

  It never imports the routes or the game component. The alias is added to
  the federation `skip` list next to `/engine`.

- **Federation keeps the admin's Material packages in the import map.**
  `ignoreUnusedDeps` prunes the map to what the exposed `./Routes`
  reaches, which would drop `@angular/material/table`, `paginator`, `sort`
  and `dialog`, used only by the admin. `workspace-federation.js` gets a
  `.patch(['@angular/material'], { includeSecondaries: { keepAll: true } })`
  like the existing one for `@angular/platform-browser`, in every app so
  the shell and the remotes agree.
- **Route**: only in the remote's `app.routes.ts`, before `''`, beside
  `privacy`:
  `{ path: 'admin', loadChildren: () => import('@wolsok/feat-lazy-bac-wars-admin').then((m) => m.adminRoutes(environment.gameCloud)) }`.
  - It is **not** in `entry.routes.ts`, so the shell, which loads only the
    exposed `Routes`, never sees it, and nothing is added under
    `remote-entry/`.
  - `adminRoutes()` puts `provideGameCloud(options)` on its own root
    route, so `app.routes.ts` imports nothing from the game lib and the
    bootstrap chunk does not grow.
- **`provideGameCloud` becomes idempotent**. `provideFirebase` reuses the
  named `bacteria-wars` app (`getApps()`) and the Auth, Firestore and
  Database instances already initialised, skips `connect*Emulator` on
  instances it reuses (they throw once started), and `GameCloud.use()`
  accepts the same connection twice. Opening `/admin`, then the game,
  shares one sign-in.
- **Staying out of the bundles**:
  - The chunk is fetched only when someone opens `/admin`.
  - The service worker's `prefetch` of `/*.js` caches it on PWA installs
    without running it. That is accepted: the code holds no secret, the
    rules hold the trust.
  - A `check-lazy-admin` target reads the build's esbuild metafile
    (`statsJson`) and fails when any input under
    `libs/features/lazy/bacteria-wars-admin/` ends up in an initial,
    bootstrap or exposed-`Routes` output, or when the `initial` budget
    grows by more than 2 KB. A marker string would not survive
    minification.
- `noindex` on every admin view, `/admin` disallowed in `robots.txt`.

**The guard is a courtesy; the rules and functions are the lock.**

- The admin root route's `canMatch` waits for the Auth user and calls
  `getIdTokenResult(user, true)`. It requires `admin === true`,
  `email_verified` and `sign_in_provider === 'google.com'`.
  - Without them, the view offers "Sign in with Google" (the admin lib
    calls `signInWithPopup` itself), or says "No access".
  - No admin query runs before the guard passes.
- **Rules** check the same three facts (`isAdmin()`) on every admin read
  and on `adminCommands`, plus `uid == request.auth.uid` and
  `createdAt == request.time`. Destructive types (`profile.*`,
  `board.hide*`, `player.ban`) also need a sign-in within the last hour
  (`request.auth.token.auth_time`), which limits what a stolen session can
  do; the view asks the owner to sign in again when it is older.
- **The `adminCommand` function** uses the auth-context variant of the
  trigger (`onDocumentCreatedWithAuthContext`), refuses unless the writer's
  `authId` equals `uid`, and re-reads that user with `getUser()` (claim,
  verified email, a `google.com` provider) before doing anything, so a
  revoked claim stops at once. ADR 0011's `replayCommand` does the same.

**Every admin action is a command document.**

- `adminCommands/{auto}` = `{ uid, type, target, reason, args, createdAt,
expireAt }`, create only by `isAdmin()`.
  - `reason` is 1-200 characters (not required for `stats.*`).
  - `type` is from a fixed list, and the keys are checked with `hasOnly`.
- `adminCommand` (a trigger on create) does the following, in order:
  1. checks the admin;
  2. runs the action idempotently (the command id is the audit id);
  3. writes `adminAudit/{commandId}` with `before` and `after`;
  4. writes `result: { ok, error?, at }` back on the command, which the
     admin view watches.

| `type`                | `target`                       | `args`                                                | What it does                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile.reset`       | `uid`                          |                                                       | Name to `defaultProfile(uid).name`, motto empty, avatar to the uid's preset, `shareStatus` kept. Audit `before`: name, motto, avatar kind, and for an image its SHA-256 and size (never the image). Notice `profile-reset`. `moderation.resets` + 1. |
| `profile.removeImage` | `uid`                          |                                                       | Avatar to the uid's preset, the rest kept. Notice `image-removed`.                                                                                                                                                                                   |
| `board.hideEntry`     | `boardId`, `entryId`           | `bar?: boolean`                                       | Entry to `hidden` (`hiddenBy: 'admin'`). With `bar`, that board kind ignores the player from now on. Notice `board-hidden`.                                                                                                                          |
| `board.hidePlayer`    | `uid` or `boardId` + `entryId` | `bar?: boolean`                                       | The same on every board.                                                                                                                                                                                                                             |
| `board.restore`       | `uid` or `boardId` + `entryId` |                                                       | Undoes a hide and a bar. Entries come back with their previous status.                                                                                                                                                                               |
| `board.verify`        | `boardId`, `entryId`           |                                                       | Re-runs the entry's best attempt, or up to 6 match-minutes of a run, now, from the admin budget (inside the trigger's 540 s). The rest of a deep run is queued first for the hourly function.                                                        |
| `player.ban`          | `uid` or `boardId` + `entryId` | `until: timestamp \| null`, `reason: 'cheating' \| …` | See Bans. On a player already banned it changes only `until` and `reason`.                                                                                                                                                                           |
| `player.unban`        | `uid`                          |                                                       | See Bans.                                                                                                                                                                                                                                            |
| `stats.refresh`       |                                |                                                       | Recomputes `adminStats/now`.                                                                                                                                                                                                                         |
| `stats.recount`       |                                |                                                       | Pages through `listUsers()` (1,000 at a time) to set `stats/accounts` exactly. Once after launch, then when in doubt.                                                                                                                                |

- Replay curation (feature, unfeature, anonymise) stays a `replayCommands`
  type, as ADR 0011 decided. `replayCommand` now also writes
  `adminAudit` for its admin types (`source: 'replayCommand'`).
- `profileChanged` (ADR 0011) and the new `boardProfileChanged` fire on
  the moderated profile like on any other update, banned or not, so public
  replays and board names follow a reset by themselves.

**The views** (Angular Material tables, cards, dialogs). Every
destructive action opens a confirmation dialog that asks for the reason.
All text is in English and German, through the game's `I18nService` (via
`admin-kit`) with the admin lib's own `admin` dictionaries, so none of the
admin text lands in the game chunk.

- **Overview**: the statistics below, with "Refresh" (`stats.refresh`) and
  the last 48 hours from the hourly snapshots.
- **Profiles**:
  - lists: newest changes first, "uploaded pictures only"
    (`avatar.kind == 'image'`), a name prefix search
    (`orderBy(name)`, case-sensitive), or a uid;
  - 25 per page, showing name, motto, picture, uid and `updatedAt`;
  - actions: reset, remove picture, ban, open the player.

  `profiles` gets `list` for `isAdmin()` only.

- **Player** (`/admin/players/:uid`):
  - profile, board entries (through `boardMembers`), ban state;
  - the moderation counters, and their audit entries (`target.uid`).
- **Leaderboards**: pick a board (and a day). It shows rows with
  hidden ones, their uid (through a `boardMembers` query on
  `entryIds.<kind>`), and the actions hide, bar, restore, verify now and
  ban.
- **Bans**: active bans, unban, change the end.
- **Replays**: ADR 0011's curation page (runners-up, public replays,
  feature, unfeature, anonymise), moved here from `/curate` (this changes
  ADR 0011).
- **Audit**: the newest first, filtered by type or uid.

### Statistics without expensive scans

`adminStats/now` is written by `stats.refresh` and, as an
`h_{yyyymmddhh}` snapshot, by the hourly function. Each figure is one
counter, one RTDB read, or one `count()` (one read per 1,000 counted
entries):

| Figure                                            | Source                                                                                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| accounts                                          | `stats/accounts`, +1 in `countAccount` (`auth.user().onCreate`, v1), −1 in `deletePlayerBoards` (`onDelete`), exact after `stats.recount`                              |
| players active in the last 24 h and 7 days        | `count()` on `boardMembers` with `activeAt >=`, written by `rankProgress` on every progress save (one document per player, unlike the `storage` collection group)      |
| players online now, and how many are in a match   | RTDB `connections` (read once by the function, about 40 bytes per player). Every signed-in client writes it, with or without `shareStatus`                             |
| players searching for an opponent                 | `count()` on `queue` with `seen >=` now − 45 s                                                                                                                         |
| open rooms and matches running                    | `count()` on `rooms` with `expireAt > now` (all rooms), and with `taken == true` and `expireAt > now` (the stubs of ADR 0011, so matches running). Open = all − taken. |
| replays stored, today, public, waiting for upload | `count()` on `replays`, `replays` with `createdAt >=` today, `publicReplays` with `removedAt == null` (ADR 0011 writes it explicitly), `replaySubmissions`             |
| boards                                            | entries per board, provisional entries in the candidate range, verification minutes used today and failed checks (`counters/{day}`)                                    |
| moderation                                        | active bans (`count()` on `bans`), profiles with an uploaded picture                                                                                                   |

A refresh is about 15 aggregations, so tens of reads, or about 500 reads
a day with the hourly snapshot.

`connections` replaces nothing: `status/{uid}` (ADR 0010) stays the opt-in
status friends see. `connections` is never readable by players. It only
counts. It is collected from every signed-in player, including those who
chose not to share their status, and the privacy page says so.

### Bans

- **Stored** in `bans/{uid}` (`until` is a timestamp or `null` for
  permanent; the ban form offers 1 day, 7 days, 30 days and permanent),
  and mirrored to RTDB `bans/{uid}` as the end in milliseconds (`0` for
  permanent). Both are written by `adminCommand` only. The player may
  `get` their own ban, to show why and until when.
- **A ban ends by itself at `until`**, wherever it is checked, so expiry
  does not wait for the hourly function. The hourly function only cleans
  up (below).
- **Enforced in Firestore rules for every client-written path**. A
  `notBanned()` =
  `!exists(ban) || (get(ban).data.until != null && get(ban).data.until <= request.time)`
  (one document read per request) is added to every `create` and `update`:
  - `players/{uid}/storage`;
  - `rooms` (open and answer), so there is no online play by code;
  - `profiles`;
  - `players/*/friends` (both branches), `players/*/requests`,
    `players/*/challenges`, `invites`;
  - `queue` (own entry and claiming another);
  - `replaySubmissions`, `replayCommands`;
  - `players/{uid}/attempts`.

  **Deletes stay allowed**: a banned player may still delete their own
  data and their account.

- **The client follows the ban.** It reads its own ban at start (one read)
  and listens while signed in. While banned, it switches the game's
  storage to the device (as without a Firebase project), so the persistent
  cache does not roll back every save the rules refuse, and the game plays
  on locally. After the ban ends it uploads the device progress again the
  way `adoptProgress` does. A banned player sees a banner ("Your account
  is suspended until …", with the reason category) in every online
  screen, and the online buttons are disabled instead of failing.
- **Enforced in RTDB rules**: `status/$uid` and `connections/$uid` allow a
  write only when `!newData.exists()`, or there is no `bans/$uid`, or its
  value is not `0` and at most `now`, the same inclusive end as
  `notBanned()`. Going offline still works.
- **Enforced in functions**: `assertActive(uid)` (ADR 0011's hook) now
  reads `bans/{uid}`, cached 60 s per instance, honours `until`, and throws
  `Banned`. It is called only where the player's own write is acted on:
  - `acceptReplay` drops the submission (`result: 'banned'`);
  - `rankReplay` and `rankProgress` ignore the player, and an agreed online
    match with a banned player counts for neither side;
  - `replayCommand` refuses `remove`.

  It is **not** called by `deletePlayerReplays`, `deletePlayerBoards`,
  `profileChanged`, `boardProfileChanged`, `rebuildTop`, `countAccount`,
  `hourly`, or for the target of an `adminCommand`. A banned player's
  account deletion must erase their data, and an owner's reset of a banned
  player's profile must reach their replays and boards.

- **When the ban is set**, `adminCommand`:
  1. deletes `queue/{uid}`, RTDB `status/{uid}` and `connections/{uid}`,
     the open rooms the player hosts (a taken room's stub stays: the other
     player's report of the match is checked against it) and the invites
     they created (`invites` where `from == uid`). The challenges they
     sent expire within the hour and point to their rooms, and their friend
     requests lead nowhere while they can write nothing, so both are left
     to TTL and the other player (a collection-group query cannot filter
     on a bare document id, and reading the groups through grows with the
     player base);
  2. hides their entries on every board (`hiddenBy: 'ban'`);
  3. takes their public replays down the way ADR 0011's `remove` does;
  4. writes a tombstone if the account has a Google provider (below);
  5. writes the notice `banned`.

  A match already running peer to peer cannot be stopped by the server: it
  plays to its end, and its result is not counted.

- **Unban** (`player.unban`, or `until` passing, which the hourly function
  finds) does the following:
  1. deletes both ban documents and the tombstone;
  2. restores the entries hidden with `hiddenBy: 'ban'` (not those the
     owner hid or barred, nor those the player opted out of);
  3. writes the notice `unbanned`;
  4. writes an audit entry (`by: 'system'` on expiry).

  Public replays taken down stay down.

- **Refresh tokens are not revoked.** The rules read the ban document, so
  the ban works at once. Revoking would sign a guest out for good and hand
  them a fresh, unbanned account.
- **A ban survives deleting a Google account.** `banTombstones/{hmac}`
  holds the ban's end and reason, keyed by HMAC-SHA256 of the account's
  `google.com` provider uid with a server secret (`BAN_TOMBSTONE_KEY` in
  Secret Manager), so the key cannot be reversed or guessed from outside.
  `deletePlayerBoards` writes it before deleting a banned account's data.
  `countAccount` checks it for accounts created with Google, and
  `rankProgress` and `acceptReplay` check it once after a guest links
  Google (`boardMembers.googleChecked`). A match re-applies the ban to the
  new uid (audit `source: 'system'`). The tombstone expires with the ban,
  at most after 2 years.
- **Honest limit**: a ban binds a uid, or a Google identity. A guest can
  clear the browser's data and start as a new guest, with no progress,
  name or friends, and climb the boards again only at the capped rates.

### Matchmaking level preference

- **The queue entry** (`queue/{uid}`) gets `level: string | null`.
  - `null` means any level.
  - The rules allow `level` on create, and allow the owner to change it
    with `seen` and `expireAt`, so changing the choice keeps the place in
    the queue. A level is `null` or a string matching `[a-z0-9-]{1,40}`.
- **The pick** is `pickMatchLevel(waiting, claimer, random)` in
  `state/match-level.ts` (pure). It returns the waiting player's level if
  it is a known level that plays online (`playableOnline`), else the
  claimer's, else a random level that plays online, and says which
  (`pick: 'waiting' | 'claimer' | 'random'`).
  - Unknown ids, such as a level from a newer build, count as "any".
  - The preference never filters the candidates (already decided).
- **Who picks**: the claimer opens the room and hosts, as today. It reads
  the waiting player's `level` inside the claim transaction, so the
  preference is the one current at the claim, and writes the result into
  the claim: `claim.keys().hasOnly(['by', 'code', 'level', 'pick'])`, with
  `level` and `pick` optional so older claimers still pass.
  `MatchmakerService` keeps the picked level, and `startMatchmadeMatch`
  uses it instead of its own `Math.random()`. The guest learns the level
  from `start` as before and the reason from its own queue entry's claim,
  so there is no protocol change and no `NET_VERSION` bump.
  - A cheating host can ignore the preference. All it gains is a level it
    likes. An older build as claimer ignores it too.
- **UI**: the online lobby shows a "Level" select above "Find an
  opponent": "Any level" first, then the levels that play online, under
  the names the level map uses.
  - The choice is a device setting (`matchLevel`) and goes into the queue
    entry.
  - When matched, the lobby says "Level: Hourglass (your choice)",
    "(opponent's choice)" or "(random)", for both seats.
  - The texts go in the lobby's i18n area.

### Functions added

| Function              | Kind                                                                                 | What it does                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rankReplay`          | Firestore `onDocumentWritten` on `replays/{id}`, `gcf_gen1`                          | Returns unless `state` or `players` changed. Online: counts an `agreed` match. Daily and endless: checks the attempt and takes the replay into its run, closing stale endless attempts lazily. On `verified`, `unverified` or `balance-mismatch`, updates the entry. 256 MiB.                    |
| `rankProgress`        | Firestore `onDocumentWritten` on `players/{uid}/storage/bacteria-game.progress`      | The XP board, `activeAt`, the one-time tombstone check after a Google link.                                                                                                                                                                                                                      |
| `rebuildTop`          | Firestore `onDocumentWritten` on `boards/{boardId}/entries/{entryId}`, `gcf_gen1`    | Rebuilds the board's top document when the entry is relevant. `maxInstances: 1`, `concurrency: 1`.                                                                                                                                                                                               |
| `boardProfileChanged` | Firestore `onDocumentUpdated` on `profiles/{uid}`, `gcf_gen1`                        | Re-labels the player's entries on every board in `boardMembers.boards` when `name`, `publicName`, `boardOptOut` or a preset avatar changes.                                                                                                                                                      |
| `adminCommand`        | Firestore `onDocumentCreatedWithAuthContext` on `adminCommands/{id}`                 | As above.                                                                                                                                                                                                                                                                                        |
| `hourly`              | scheduled at minute 17 of every hour (UTC), 1 GiB, 1 vCPU, 1800 s, `maxInstances: 1` | In order: cleans up expired bans, closes attempts without replays (lost lives, skipping pending submissions), closes online replays `waiting` for 2 h ("Not reported"), finalises daily boards, writes the statistics snapshot, then spends the hour's verification slice until 25 minutes pass. |
| `countAccount`        | `auth.user().onCreate` (v1)                                                          | `stats/accounts` + 1, `boardMembers.accountCreatedAt`, the tombstone check for Google sign-ups.                                                                                                                                                                                                  |
| `deletePlayerBoards`  | `auth.user().onDelete` (v1)                                                          | Writes a tombstone if the player is banned and Google-linked, then deletes the player's entries, `boardMembers`, runs, attempts, notices and ban, scrubs `before`/`after` of audit entries about them to `{ scrubbed: true }`, and lowers `stats/accounts`.                                      |

All run in ADR 0011's codebase and region, with retries off, and are
idempotent: a transaction checks the state first, and markers are created
with `create()`. `rankReplay` and `acceptReplay` are the exceptions: they
retry, and drop an event older than an hour, since a stored replay
`rankReplay` fails to rank would never count, and a submission
`acceptReplay` fails on would be lost with its attempt (it voids the
attempt when it gives up, see above). Each delivery reads the replay afresh and leaves one that
is gone or already answered (`rankedReason`); the steps check that again
in their transactions (the `rankedReplays` marker, the `rankedReason` a
daily replay keeps once answered), read the match's seats there instead
of trusting the event's snapshot, and decide at the event's time: caps,
the room's clock, a declaration's deadline and when a ban ends. The ban
document itself is read at the delivery, so a ban placed after the event
still applies. There is one new Cloud Scheduler job, so the project has
two with `featureBest`. The three free jobs are counted per billing
account, not per project, so other projects on the same billing account
may already use them (a job costs $0.10 a month).

**No test-only export.** The emulator does not fire schedules, and an HTTP
export of `hourly` could not be kept out of production reliably. The hourly
steps are plain functions (`closeAttempts`, `verifyBoardsSlice`, …) tested
by unit and emulator-integration specs, and the e2e reaches verification
through the admin's `board.verify`, which runs the same code.

### Changes to ADR 0011

Marked in its text as "(changed by ADR 0012)" or "(added by ADR 0012)":

- Daily and endless matches started as ranked attempts are always recorded
  on the CPU and uploaded, whatever "Record local matches" or "Save my
  matches" says.
- Online matches are always uploaded; "Save my matches" governs local
  matches only.
- The v2 header gets an optional `attempt: { id, at }`. `acceptReplay`
  copies it into `replays/{id}.attempt`, and derives `daily` for the
  attempt's day; without an attempt, for the UTC day of arrival or the day
  before.
- `replaySubmissions` requires `createdAt == request.time`, may carry an
  `attempt` id, and submissions with an attempt count against a separate
  global daily cap for ranked submissions instead of the global one.
- `replayCommands` requires `uid == request.auth.uid` and
  `createdAt == request.time`, and `replayCommand` uses the auth-context
  trigger and compares the writer.
- `featureBest` accepts already `verified` replays as candidates without
  re-running them. Its schedule is enabled only once the Replays view of
  `/admin` ships.
- `publicReplays` documents carry `removedAt: null` until removed.
- `/curate` becomes the Replays view of `/admin` in the admin lib.
  `robots.txt` disallows `/admin` instead.
- `replayCommand` writes `adminAudit` for its admin types.
- `assertActive` reads bans and is called only by `acceptReplay`,
  `replayCommand`, `rankReplay` and `rankProgress`.
- The admin claim is read by more rules, and `profiles` gets an admin
  `list`.

## Consequences

- **Costs** (assuming 1,000 daily players with 10 matches each):
  - XP: about 2 reads and 2 writes per match, plus a `rebuildTop` read.
  - A ranked match: a transaction, a write and a read by the client, and a
    few reads and writes in `rankReplay`.
  - Ban checks: one read per client write.
  - A screen: about 3 reads.
  - Together roughly 170,000 reads and 90,000 writes a day, of which the
    free tier covers 50,000 and 20,000. That is a few dollars a month.
  - Function invocations, about 50,000 a day, stay inside the free
    2 million a month. Their CPU time is in the budget table.
  - Verification: see the budget table, about $2-5 a month above the free
    tier in all.
  - A budget alert (ADR 0011) covers surprises.
- **`entries` allow `list` without a limit to signed-in players**, because
  `count()` cannot carry one. A malicious client can therefore spend our
  reads paging a board. That is no worse than any other readable
  collection, and is bounded by the budget alert.
- **Every signed-in client now holds an RTDB connection** (`connections`),
  not only those sharing their status. That is far below the 200,000
  connections a Blaze database allows.
- **Ranked daily and endless matches run on the CPU at the online grid,
  on the ranked setup**: coarser and heavier than the GPU path, as in
  online matches today, and with normal bots and no head start. A weak
  device, or a player who wants their own setup, can switch ranked play
  off.
- **Edge cases that cost a fair player an attempt**:
  - A match whose replay is uploaded more than 5 minutes after its end
    (the phone went offline at the end) counts as used, or as a lost life.
  - A declaration that committed although the client gave up waiting
    counts as used; in endless, the rest of that run is unranked.
  - A device whose clock is off by a day fails the daily declaration and
    plays unranked.
- **Safari and Firefox players** may fail verification more often. The
  statistics count failed checks so the owner sees it. If it happens, the
  answer is a deterministic `sin`/`hypot` in the engine (a balance change),
  not trusting failed runs.
- A balance change makes old provisional entries `stale`.
- **Rules tests** (`test-rules`, ADR 0011) cover every new path, the
  writer pinning of command documents and the `notBanned()` on every
  client write. The functions get Jest integration specs against the
  Firestore emulator (transactions with queries, `create()` markers,
  `count()`), next to their unit specs. The functions emulator runs the
  triggers in e2e.
- **Privacy page** (English and German) gains or changes:
  - Leaderboards: what is shown (scores, the hour a score was reached, the
    name only with "Show my name in public", otherwise "Anonymous #1234"
    and a preset picture), to whom (effectively anyone, since every
    visitor gets a guest account), for how long (daily boards 31 days,
    all-time boards until removed or the account is deleted), that results
    are checked automatically (re-simulation, caps), and how to opt out
    (`boardOptOut`).
  - Online matches are uploaded even with "Save my matches" off, and why.
  - Declared attempts: kept 31 days.
  - Connection state: collected from every signed-in player, kept while
    connected, seen by nobody but the operator as a count.
  - Moderation: the operator can see profiles, reset them, remove
    pictures, hide entries and ban. Moderation records, with the reason
    and the replaced name and motto, are kept for 2 years to handle
    repeated abuse; the legal basis is legitimate interest. On account
    deletion the replaced name and motto are erased from them and only the
    uid, type, reason and date remain. Players get a notice.
  - Ban tombstones: for a banned Google account, a keyed hash of its
    Google identity is kept until the ban ends (at most 2 years), so the
    ban survives deleting and recreating the account; legitimate interest.
  - The level preference: in the queue entry, readable by signed-in
    players like the entry itself.
  - Account deletion removes board data.
  - The date.
- **CLAUDE.md**:
  - the Native Federation section notes that `/admin` lives only in the
    remote's `app.routes.ts`, and that the Material secondaries are kept in
    every app's import map;
  - the lib's `CLAUDE.md` names the `admin-kit` entry and its rule (no
    routes, no game component).

## Rollout

0011's step numbers in brackets.

1. **Matchmaking level preference**: the client, the queue and claim rule,
   the lobby. It needs no functions and can ship before or with 0011 [2].
2. **Contracts** (`state/boards.ts`, `attempts.ts` with `rankedPlan`,
   `admin-commands.ts`). The `attempt` header field ships with replay v2
   itself [3], so the first release that stores v2 replays [5] already
   knows it.
3. **0011's functions and rules [4] already carry the 0012 changes to
   them** (attempt on submissions, writer pinning, `verified` candidates).
4. **Rules, indexes, RTDB rules**, including `notBanned()` (with no bans
   yet, nothing changes) and the TTLs, after 0011's rules [4].
5. **Functions**: `rankReplay`, `rankProgress`, `rebuildTop`,
   `boardProfileChanged`, `adminCommand`, `countAccount`,
   `deletePlayerBoards`, and `hourly` (running from its first deploy, see
   `HOURLY_ON`), after the CPU benchmark set the budgets. Deployed before the client that writes
   attempts.
   - So far: `rankProgress` (the XP board), `rankReplay` for agreed online
     matches (the online board, with the timing check, the pair, win and
     new-opponent caps), `rebuildTop` and `boardProfileChanged`; the rules
     for `boards`, their `entries` and `boardMembers`, the profile's
     `publicName`, `galleryOptOut` and `boardOptOut`; the entries index and
     the TTL policies of `pairs`, `rankedReplays` and `rankedRooms`. An
     entry keeps its `baseStatus` beside `status` and `hiddenBy`, so a
     lifted hide brings the old status back. `acceptReplay` stores the
     stub's `seats` and `createdAt` on an online replay, which the online
     board counts by.
   - Then the daily board: the rules of `players/{uid}/attempts` (ids,
     order, today's UTC day, `at == request.time`), `rankReplay` for a
     new daily replay with an attempt (`rankDaily`: the checks above into
     `dailyRuns` and the entry, provisional), `verify.ts`, and `hourly`
     (`runHourly`: "Not reported", `final` on yesterday's board at 23:00
     UTC, the verification slice in trust order). `hourly` deploys with the functions (`HOURLY_ON` in the functions' `config.ts`), since the owner enabled Cloud Scheduler. `acceptReplay` keeps a ranked
     submission's `createdAt` as `submittedAt`, which the deadline is
     measured against; the TTL policies of `attempts`, `dailyRuns`, the
     daily boards and their entries. A summary's `timeline` is one flat
     list, seat after seat, as Firestore holds no arrays in arrays.
   - First measurement, on a dev core in Node: a ranked daily match
     plays again at about 7 ms a tick on `IntSimulation` (`gpu-int`,
     about 25 s per match-minute) and 2 ms on `cpu`, close to the 20 s
     the budgets assume. The benchmark on a Cloud Run vCPU still sets
     them.
   - Then the endless board: `rankReplay` for a new endless replay with an
     attempt (`rankEndless`: the arrival checks, then the run computed
     again from all its declared matches in `endlessRuns/{uid}_{runId}`,
     where the level check follows from the wins before; a refused replay
     or none 2 hours after the declaration costs a life, a match still
     within those 2 hours holds the count). The player's entry is their
     best run (index `uid` + `sort` on `endlessRuns`); the others keep a
     31-day TTL. A new declaration joins its run at once (`declaredMatch`,
     on `players/{uid}/attempts`), and `hourly` sweeps runs waiting on a
     match whose replay never came, and spends what the daily boards leave of the slice on
     the endless candidates: their wins in order, a failed one cutting the
     run to its verified prefix (`partial`). The endless budget is
     `ENDLESS_VERIFY_MS` plus what the daily boards leave of theirs.
   - `deletePlayerBoards` deletes a deleted account's entries on every
     board in `boardMembers.boards` (`rebuildTop` takes them off the
     tops), its `dailyRuns` and `endlessRuns`, `boardMembers`, `limits`,
     `moderation`, its attempts and notices. `boardMembers.boards` drops
     the daily boards TTL took whenever a daily entry is written, so it
     holds about 31 daily ones, and `dailyRuns` expire from their day like
     the board. A replay taken out of the gallery carries `galleryOut`,
     which keeps it out once its player's uid has left `optOut`. The
     tombstone, the ban, the audit scrub and `stats/accounts` follow with
     the tombstones; until then a deleted account's ban stays behind.
   - Then the bans: `adminCommand` (the auth-context trigger, the writer
     compared with `uid`, the owner read again with `getUser()`,
     `parseAdminCommand`, the audit under the command id, `result` on the
     command) runs `player.ban` and `player.unban`; every other type
     answers `unsupported` until its wave, audited like any failed
     command. The command claims its audit entry with `create()`
     (`ok: null`) before it acts, so a second delivery neither acts again
     nor overwrites the first one's result. The owner check also refuses
     a disabled account. A ban writes `bans/{uid}`, and for a new ban the
     notice `banned` and `moderation/{uid}.bans`, in one transaction, then
     RTDB `bans/{uid}`, clears out the queue entry, status, connection,
     open hosted rooms and invites, hides the entries (`hiddenBy.ban`,
     updated in place so a daily entry keeps its TTL) and takes the public
     replays down (the stored replay first, the public copy's `removedAt`
     last). A ban that holds changes only `until` and `reason` (no notice,
     no count), and runs the other steps again, which change nothing the
     second time, so a command that failed half-way is finished by sending
     it again. Unbanning, and `hourly` for ended bans (25 a run, oldest
     first, each audited with `by: 'system'`), removes the RTDB ban, lifts
     the `ban` hide, and then deletes the Firestore ban with the notice
     `unbanned` in one transaction, so a failed step is tried again. Each
     step is tied to the ban it read, so a ban set meanwhile keeps all of
     it: the RTDB ban is removed (in a transaction) only when it is the
     lifted ban's end or holds no more, an entry is unhidden only while no
     other ban holds, and the Firestore ban is deleted only while unchanged
     (`ban-changed` otherwise). An unban without a ban (`not-banned`) still
     removes the RTDB ban and the hides, to repair what a failed command
     left: it reads the RTDB value, then the Firestore ban, and removes
     only the value it read while no ban holds, so a ban set meanwhile
     keeps its RTDB ban. The rules of `adminCommands` (the shape, the writer,
     `auth_time` within the hour for destructive types), `adminAudit`,
     `moderation` and `notices`; the RTDB `connections` node and the ban
     check on `status` and `connections`; the TTLs of `adminCommands`,
     `adminAudit` and `notices`, and the two `adminAudit` indexes.
   - Still to come: the other admin types, the tombstones, `countAccount`
     and the statistics.
6. **One client release** carries attempts and ranked matches, the
   connections presence, the ban handling, the Leaderboards screen, the
   result lines and the privacy text. Needs 0011 [5].
7. **Admin lib** with all views, including the moved curation page, with
   or after 0011 [6]. Then enable `featureBest`, sign in, and run
   `stats.recount` once.

## Owner's decisions

Decided by the owner on 2026-10-23: every proposal below is accepted as
written.

- The XP caps (2,000 + 3,000 an hour, 20,000 a day; 25,000 at once only
  for accounts from before the launch).
- The cut sizes (10 daily, 10 endless) and the verification budget
  (260 match-minutes a day, about $2-5 a month above the free tier).
- The ranked setup (normal bots, no head start).
- The online caps (3 per pair a day, 5 wins a day against accounts younger
  than 3 days, 30 counted wins a day, matches of at least 30 s).
- Online matches always uploaded, "Save my matches" only for local ones
  (yes).
- The upload deadline for ranked replays (5 minutes after the
  match).
- Ban tombstones for Google accounts (yes).
- Guests on boards (yes).
- Ranked daily and endless on by default (yes).
- A banned player's cloud save is blocked too (yes, "can write
  nothing"; the game falls back to device storage).
- On 2026-10-24: the full first count for every account there is that
  day (`XP_FULL_COUNT_BEFORE` = 2026-10-25 00:00 UTC). The Blaze plan is
  on, and `BAN_TOMBSTONE_KEY` is in Secret Manager.

## Owner's manual steps

- Create the secret `BAN_TOMBSTONE_KEY` (32 random bytes) in Secret
  Manager on `bacteria-wars`, and grant the functions' runtime account
  access to it. Done 2026-10-24.
- After the index deploy, check that TTL is on for every new `expireAt`
  field listed above, and that `rooms.expireAt` is indexed again.
- Review the CPU benchmark and the budgets it sets. The functions deploy
  with every release since 2026-10-25 (owner's decision), so the
  benchmark adjusts `budgets.ts` afterwards.
- After the first functions deploy, check that Cloud Scheduler shows
  `hourly` (running: before step 6 it only closes unreported online
  matches, as no daily attempt exists to check) and `featureBest`
  (paused), and how many free jobs the billing account still has.
  Enable `featureBest` after step 7.
- Sign in at `https://bacteria-wars.wolsok.de/admin` with the Google
  account that has the claim (ADR 0011's grant script). Run "Recount
  accounts" once, and check that the overview figures look plausible.
- Ban and unban a test guest once in production. Check that its profile
  save fails, that the banner shows and the game keeps its progress on the
  device, and that unbanning restores its entries.
- Review the privacy texts before step 6.
