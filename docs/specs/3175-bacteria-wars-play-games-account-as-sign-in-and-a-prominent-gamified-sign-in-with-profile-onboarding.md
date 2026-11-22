# Spec: Play Games account as sign-in, and a prominent, gamified sign-in with profile onboarding

Issue: [#3175](https://github.com/WolfSoko/wol-sok-mono/issues/3175).

The issue asks for two things. They ship as steps of this issue, each its own
PR ("Part of #3175"):

- **Step 1 — the Lab Pass** (deployed in 74.177.0): signing in becomes a quest
  of its own in the main menu, with a profile onboarding and a reward. Web
  only, testable in CI.
- **Step 2 — Play Games as sign-in** (deployed in 74.178.1): the Play Games
  account of the Android app signs the player in, linked to the game
  account. It needs the Android app, a Cloud Function, an OAuth secret and a
  check on a real device.
- **Step 3 — achievements on Play Games** (specified below): the game's
  achievements unlock on Play Games for a player who starts the app.

## Step 1: the Lab Pass

### Goal

1. **A quest instead of a chip.** The main menu shows a "Lab Pass" card in
   its hero (where the guest banner sits today) until the pass is complete:
   a petri dish with four slots that fill as the player does the steps, the
   next step as the card's one button, and "Later" (two weeks, as the guest
   notice's). The steps, in order:
   1. **Sign in** with Google (keeps the progress; the account is no guest).
   2. **Make your profile**: save the profile once in the profile editor
      (name and avatar, a stored profile exists).
   3. **Write a motto**: the stored profile has a non-empty motto.
   4. **Add a friend**: the player has at least one friend.
2. **Onboarding after the sign-in.** When a guest signs in and has no stored
   profile yet, the game opens the profile screen with the editor in an
   onboarding mode: a short welcome line ("Welcome to the lab, {name}!
   Pick a name and a look"), the name field focused, "Save" as the primary
   action. Leaving it is always possible.
3. **The reward.** Completing all four steps earns the new achievement
   **Lab Member** ("Complete your Lab Pass"), announced by the card itself
   ("Welcome to the lab! You earned Lab Member: +50 XP"; the game has no
   toast outside the result screen), the profile's achievement list, its XP
   (`ACHIEVEMENT_XP`, 50), and it syncs to Play Games as a draft with the
   next Android release.
4. **The guest banner becomes the pass.** The guest notice's text (unused
   guest accounts are deleted after 90 days) moves into the pass's card while
   step 1 is open; `GuestNotice.visible` keeps deciding _when_ a guest's
   card shows urgently (from the third day), but the card itself shows from
   the first visit, and adds the deletion note once the notice is due.

### Non-goals

- Play Games sign-in (step 2).
- A new sign-in provider besides Google.
- Changes to what the game stores about a player beyond the achievement's
  date in the progress, which every achievement already stores.
- Changes to analytics events other than the existing `login` (no new event
  in this step), so the privacy policy stays as it is.

### Decisions

- **The steps are derived, not stored.** Each step's state follows from what
  the game already knows: `GameAccount.profile().guest`,
  `SocialService.storedAvatar()` (non-null once a profile was saved),
  the stored profile's `motto`, `SocialService.friends()`. A pure function
  `labPassSteps(facts)` (`guest/lab-pass.ts`) turns the facts into the four
  steps' states; a root service `LabPass` (`guest/lab-pass.service.ts`)
  feeds it with signals. Reason: nothing new to migrate, merge or erase.
- **The reward is an achievement**, `lab-member`, appended to
  `ACHIEVEMENT_IDS` (the ids are stored, so it goes last). Achievements so
  far are earned by matches (`Achievement.earned(progress, match)`); this one
  is granted: the achievement's `earned` returns false for every match, and
  `ProgressService.grantAchievement(id)` stores the day and returns whether
  it was new. `LabPass` grants it once all steps are done and the progress
  is loaded. Reason: the achievement system already does XP,
  profile list, merging and Play Games; a reward of its own would duplicate
  that.
- **Play Games**: `lab-member` gets an entry in
  `play-games-achievements.json` (10 points, within the 2000 total) and an
  icon from the achievement icon generator. It reaches Play as a draft; the
  owner publishes it.
- **The card is one component** (`guest/lab-pass-card.component.ts`)
  replacing `GuestBannerComponent` in the main menu; the account chip stays
  for players who completed or put the pass away.
- **The install offer keeps its place.** The card shows from a guest's first
  visit, so it would hide the offer of the Android app and the PWA for most
  players. It takes the offer's place only while the guest's deletion note is
  due; otherwise the offer, where there is one, comes first and the card
  follows once it is put away.
- **The step's button lands on its field.** "Make profile" opens the profile
  with the name focused, "Write motto" with the motto focused
  (`LabPass.focusEditor`).
- **A sign-in is judged once**, when the signed-in player's profile has
  answered: onboarding follows only for one without a stored profile, so a
  later change in the steps never sends the player to the profile.
- **A sign-in on the profile is welcomed there.** Where the profile editor
  already shows (the profile screen has its own sign-in), it takes the
  onboarding itself, so going back to the main menu does not open the
  profile a second time.
- **The onboarding stays where the sign-in was made.** Once the player goes
  on to another screen (`PlayFlow`'s panel changes), a sign-in not judged
  yet, or an onboarding no screen took, is dropped (`LabPass.moveOn`): the
  profile never opens unasked later, when its answer arrives after the
  player moved on.
- **Friends follow the player.** The friends list starts empty at every
  account switch (`SocialService`), so the last step is never taken as done
  with the friends of the guest before.
- **Without the cloud** (no sign-in) the pass never shows and the
  achievement cannot be earned.

### Acceptance

- A guest sees the Lab Pass card in the main menu with step 1 active;
  "Sign in" in it starts the Google sign-in.
- From the guest notice's third day the card adds the deletion note.
- After a guest's sign-in without a stored profile, the profile screen opens
  in onboarding mode.
- Each step's slot fills when its fact holds; the button names the next open
  step and leads there (sign-in, profile editor, profile editor's motto,
  Friends).
- With all four done, `lab-member` is earned once (the card says so, profile,
  XP), and the card goes away for good once closed.
- "Later" hides the card for two weeks.
- Specs cover `labPassSteps`, `LabPass` (granting once, not before the
  progress loaded), the card and the onboarding trigger; the Play Games
  achievement spec stays green with the new entry.
- Texts in English and German.

## Step 2: Play Games as sign-in

### Goal

1. **The Play Games account signs the player in.** In the Android app the
   player is signed in to Play Games silently at launch (PR #2586). From
   this step on, that sign-in also counts in the game: the first launch
   links the Play Games player to the game account that plays (guest or
   Google), and every later launch, on any phone, signs in to that account
   again, with its progress, friends and boards. A guest linked this way is
   no guest any more: the Lab Pass's step 1 is done, the guest notice and the
   90-day clean-up no longer apply, and the profile shows the Play Games
   name until the player saves their own.
2. **Nothing to tap.** The handover runs at every app start without a
   button or a popup, as the Play Games sign-in itself does. It never blocks
   the game: without Play Games, offline, or when anything fails, the game
   starts as today.
3. **Google sign-in still works.** A Play Games account can still sign in
   with Google (it is linked, keeping its uid); a Google account that starts
   the app gets the Play Games player linked to it.

### Non-goals

- Play Games sign-in on the web outside the app (Play Games has no web
  sign-in; the browser game keeps Google).
- Unlocking achievements on Play Games (step 3, below).
- A Play Games button, or unlinking Play Games by hand: deleting the account
  removes the link (erasure), signing out ends the session until the next
  launch signs in again.
- Firebase Auth's own Play Games provider: it exists only in the Android
  SDK, and the game's Firebase session lives in Chrome.

### How it works

1. **The app asks for a code.** A launcher activity of the app's own
   (`PlayGamesLauncherActivity`, a subclass of androidbrowserhelper's
   `LauncherActivity`, replacing it in the manifest) holds the launch
   (`shouldLaunchImmediately()` false), asks the Play Games SDK whether the
   player is signed in and, if so, for a one-time server auth code
   (`GamesSignInClient.requestServerSideAccess(<web client id>, false)`),
   then launches Chrome (`launchTwa()`) with the code in the URL's fragment:
   `https://bacteria-wars.wolsok.de/?source=twa#play-games=<code>`. It launches
   the moment the SDK answers, and at once when Play Games is unavailable or
   its silent sign-in failed, so the 3 s it waits at most (the app's dark
   background stays on meanwhile; the splash image follows with Chrome) are only the worst case; without the code it launches the
   URL as today. A link with a fragment of its own (`#friend=…`) is
   launched unchanged.
2. **The game hands the code on.** `PlayGamesHandover` (game lib,
   `play-games/`) reads the fragment once at start, takes it off the URL
   (through the router, as the game's other links, so a reload or a shared
   link never carries it),
   waits for the first player (the guest or the account Firebase restored)
   and writes a command document `playGamesSignIns/{id}`:
   `commandEnvelope` + `code`. It waits up to 30 s for the result.
3. **A trigger links the player.** `playGamesSignIn` (functions,
   `play-games/sign-in.ts`, through `runCommandDocument`) exchanges the
   code at Google's token endpoint with the web OAuth client (id in
   `config.ts`, secret `PLAY_GAMES_CLIENT_SECRET`), reads the player
   (`GET games/v1/players/me`: `playerId`, `displayName`) and settles the
   link `playGamesLinks/{playerId}` (`{ uid, linkedAt }`) in a transaction:
   - no link, or a link to an account that is gone: it links the writer;
   - a link to the writer: it stays;
   - a link to another account while the writer is a guest: that account
     takes over (it is the one the player made on another phone);
   - a link to another account while the writer has a provider (Google):
     refused, `linked-elsewhere`, nothing changes (one Play Games player is
     one game account; the game shows nothing, the player keeps playing).
     This holds for a linked account without a provider too: moving the
     link would leave that account to `guestCleanup`, with progress the
     writer may never have adopted (manager's decision on the review,
     2026-11-22). Known limit: a Play Games account that a Google account
     adopted on this phone (`credential-already-in-use`) is relinked by
     the adoption itself since
     [#3187](https://github.com/WolfSoko/wol-sok-mono/issues/3187)
     (`playGamesAdoption`, a release of the Play-only tab and the adopted
     progress checked on the server), so the Google account keeps the link
     and answers no `linked-elsewhere` there.
     The account it settles on gets the custom claim `playGames: true` (read
     afresh and written only when it changes) and, when it has no display
     name, the Play Games name (`displayName` of its Auth record). The result
     carries a custom token for that account (`token`, from
     `createCustomToken`), next to `ok`, only where the session needs one: a
     writer without a provider, or a take-over. A Google session keeps its
     own, since the owner's rights hang on its Google sign-in provider.
4. **The game signs in with it.** `GameAccount.signInWithToken(token,
   writer)` signs in with the custom token (`signInWithCustomToken`), only
   while the player the command was written for still plays: a token that
   arrives after a switch or a sign-out is dropped. For the same
   uid that changes no player, only the session: it is no anonymous one
   any more, so the profile says signed in. For another uid it switches
   with `adoptsGuest: true`, so the guest's progress joins the account, as
   the Google sign-in does today. The custom token is valid for an hour;
   the game deletes the command document once it has read the result or
   given up waiting, and the TTL on `expireAt` (`firestore.indexes.json`,
   checked for every command collection by `firestore-indexes.spec.ts`)
   takes one it could not, within a day. Only its writer reads it.

### Decisions

- **The fragment carries the code, not postMessage.** A fragment never
  reaches a server or the service worker, works in Chrome and the WebView
  fallback alike, and needs no message channel to Custom Tabs, which
  `LauncherActivity` does not expose. The code is single-use, bound to the
  app's web client and expires within minutes. The error reports drop the
  hash already (`scrub.ts`), the analytics page views carry the route
  pattern only.
- **A command document, not a callable function**, as everywhere in the
  game: the client never calls a function. `playGamesSignIns` takes
  `uid`, `code` (a string of at most 512 characters), `createdAt`,
  `expireAt`; only its writer reads and deletes it. It is allowed while a ban holds:
  it changes no shared data, and a banned player keeps their account.
- **The session becomes a custom-token one.** Linking a Play Games
  identity to a Firebase account needs no Firebase provider: the link is
  our own document, and the custom token makes the session no anonymous
  one. `profileOf` takes an account without provider and not anonymous as
  signed in (`guest: false`, name from the display name). Every place that
  tells a guest by `isAnonymous` (owner check, Lab Pass, guest notice,
  sign-in lines) follows from it. `signIn` (Google) links whenever the
  account has no provider, anonymous or not, so a Play Games account keeps
  its uid when it adds Google.
- **The claim keeps the account.** `guestCleanup`'s `isIdleGuest` leaves an
  account with `playGames: true` alone; an account without provider
  otherwise still counts as a guest there.
- **Erasure.** `playGamesLinks/{playerId}` gets a `PLAYER_DATA` entry
  (`field` `uid`, erased by `account`), `playGamesSignIns/{id}` one as the
  other command collections (erased by `account`, its pending ones). The
  rules close `playGamesLinks` to clients; `player-data.spec.ts` checks
  both.
- **Off switch.** The trigger is exported only with `PLAY_GAMES_ON` in
  `config.ts`. A deploy fails for a function whose secret is missing, so
  `PLAY_GAMES_ON` stays `false` until the owner's steps 1-3 below are done
  and a merge never breaks the deploy; the game writes no command where
  the app hands no code, and a command nobody answers only times out.
- **A Play Games sign-in changes no ban.** The ban is the uid's
  (`bans/{uid}`), and the link only ever settles on an existing uid, so a
  banned account stays banned, and a banned guest taken over by its linked
  account leaves its ban where it was.
- **A ban follows the Play Games player past a deletion** (manager's
  decision on request 1545). Deleting a banned account with a link keeps a
  ban tombstone keyed by an HMAC of `play-games:` and the player id
  (`playGamesTombstoneId`, `BAN_TOMBSTONE_KEY`), beside the Google one,
  read before the link is erased (`deleteAccount`). `signInPlayGames`
  checks it first: while it holds, the writer is banned
  (`applyPlayGamesTombstone`) and nothing is linked (`banned`).
- **Each code counts once.** Google's token endpoint takes a code once;
  the trigger runs once per document (`create`, retries off), the token is
  minted only for the uid the transaction settled on, and the writer check
  of `runCommandDocument` keeps a command from settling a link in another
  uid's name.
- **Privacy policy** (sections 6 and the Android section): the app now
  hands the Play Games sign-in to the game; we store the Play Games player
  id with the account (`playGamesLinks`) and, when the account has no name,
  the Play Games name, until the account is deleted.

### Manual steps for the owner (before `PLAY_GAMES_ON`)

1. Play Console → Play Games Services → Configuration → Credentials: add a
   **Game server** credential with the Cloud project's web OAuth client
   (the "Web client (auto created by Google Service)" of `bacteria-wars`),
   so `requestServerSideAccess` may hand codes for it.
2. `npx firebase functions:secrets:set PLAY_GAMES_CLIENT_SECRET --project bacteria-wars`
   with that web client's secret.
3. IAM: the functions' runtime service account gets **Service Account Token
   Creator** on itself, so `createCustomToken` can sign
   (`iam.serviceAccounts.signBlob`).
4. After the Android release (filed then): a check on a real phone from the closed
   testing track (first launch links, a second phone or a reinstall signs in
   to the same account), measuring the cold start the hold adds.

### Acceptance

- The app launches with `#play-games=<code>` when the player is signed in
  to Play Games, within 3 s, and as today otherwise (Android build and
  `lint-android` green in the `Android app` workflow; the phone check
  above).
- The game takes the code off the URL at once and writes exactly one
  `playGamesSignIns` command for the first player; none without a code.
- The trigger links a new player, keeps an existing link, hands a guest the
  linked account, refuses `linked-elsewhere` for an account with a provider,
  relinks a link whose account is gone, sets the claim and the name, and
  answers a token for the account it settled on; a failed exchange answers
  `play-games-refused` without a token (emulator spec with an injected
  exchange; pure specs for each of the four cases). The token is minted
  only for the settled uid, a command written for another uid settles
  nothing, a banned account stays banned.
- After the token sign-in the profile is signed in with the Play Games name;
  a switch adopts the guest's progress (game lib specs).
- Rules: only the writer creates, reads and deletes its command, with exactly the
  listed fields; nobody reads or writes `playGamesLinks` (rules test).
- `guestCleanup` keeps an idle account with `playGames: true` (spec).
- Account deletion removes the link and pending commands
  (`player-data.spec.ts`, `erasure.emulator.ts`).
- The privacy policy says it, in English and German.

### Open questions

- Whether `requestServerSideAccess` hands a code within 3 s on a cold
  start; if not, the first launch links nothing and the next one does.
  The phone check decides whether the wait needs to grow.

## Step 3: achievements on Play Games

### Goal

1. **Earned achievements unlock on Play Games.** At every start of the
   Android app, each achievement the game account has earned (the keys of
   `achievements` in its stored progress, granted ones such as Lab Member
   included) is unlocked on Play Games for the Play Games player the start
   signed in, where Play still shows it locked.
2. **Nothing is kept.** The sync uses the access token of the code the app
   hands over (step 2) and only inside the trigger's run: no access or
   refresh token is stored, logged or written beside the result.
3. **The sign-in never waits for it and never fails for it.** The result
   and the custom token are written first; the sync follows in the same
   run, and every failure of it is logged and changes nothing.

### Non-goals

- Unlocking right when a match earns an achievement: without a stored
  token the server can reach Play only while a fresh code is at hand, so
  an achievement earned during a session reaches Play with the next app
  start.
- Unlocking from the browser game (Play Games has no web sign-in) or from
  the Android SDK (the game runs in Chrome, step 2's non-goals).
- Incremental achievements, events or leaderboards: the game's
  achievements are all standard ones.
- Creating or editing the definitions on Play: that stays the deploy's sync
  (`tools/bacteria-game/play-games.ts`).

### How it works

1. **The token stays in a closure.** `playGamesPlayer` (`play-games/player.ts`)
   answers the player with a `games` handle, a `PlayGamesApi` bound to the
   access token of the code exchange: `definitions()` lists Play's
   achievements in English (`GET games/v1/achievements?language=en-US`),
   `states()` the player's (`GET games/v1/players/me/achievements`), and
   `unlock(id)` unlocks one (`POST games/v1/achievements/{id}/unlock`, empty
   body). Each follows `nextPageToken` up to a bound and answers null on a
   refusal of Google. The token is never a field of what `player.ts`
   returns, so nothing can write it out by mistake.
2. **The sign-in names whom to sync.** `signInPlayGames` answers, beside
   the result and the token, `sync: { uid, games }` for the uid it settled
   on (link, keep or take-over) and null for every refusal
   (`play-games-refused`, `no-account`, `banned`, `linked-elsewhere`): a
   Play Games player gets only the achievements of the account it is
   linked to.
3. **The command syncs after the result.** `runPlayGamesSignIn`
   (`play-games/command.ts`) runs the sync once `runCommandDocument` wrote
   the result, through an injected `syncAchievements(uid, games)` dep, and
   catches and logs whatever it throws.
4. **The sync** (`play-games/achievements.ts`, `syncPlayGamesAchievements`)
   reads `players/{uid}/storage/bacteria-game.progress` (`PROGRESS_KEY`,
   `parseProgress` of its `json`, as `rankProgress` does), and when it has
   earned anything, lists the definitions and the player's states, decides
   with the pure `achievementsToUnlock(earned, definitions, states)` and
   unlocks each one in turn. A failed unlock is logged and the next one
   still goes.
5. **The match is by English name**, as the deploy's sync matches the
   definitions: the game's `ACHIEVEMENTS` (engine main entry) give each id
   its English name, which `play-games-achievements.spec.ts` keeps equal to
   the file's `en-US` name. An earned achievement Play does not list (not
   published, and the player no tester) is skipped and logged once by
   name; one Play shows `UNLOCKED` is skipped silently; one without a state
   for the player, `HIDDEN` or `REVEALED`, is unlocked. Two definitions of
   the same English name count as none (logged), since the game could not
   tell which one is its own.

### Decisions

- **In the sign-in trigger, not a trigger of its own**: the code is
  single-use and the exchange happens there, so only that run holds a
  token. A second trigger would need the token handed on, which is what
  the acceptance forbids.
- **After the result, not before**: the game waits up to 30 s for the
  result, and a slow Games API must not make it give up on the sign-in.
  The trigger's 60 s cover the exchange and about twenty calls of at most
  10 s each only in the worst case; a run that times out has written its
  result already, and the next start unlocks the rest.
- **The settled account's progress**: on a take-over the guest's progress
  joins the account in the game only after the sign-in, so its new
  achievements reach Play at the next start. Never the writer's on a
  refusal: `linked-elsewhere` means the player belongs to another account.
- **The `games_lite` scope suffices**: a server auth code of
  `requestServerSideAccess` carries the default scopes `GAMES_LITE` and
  `DRIVE_APPFOLDER`
  ([server access](https://developer.android.com/games/pgs/android/server-access)),
  and
  [`achievementDefinitions.list`](https://developer.android.com/games/services/web/api/rest/v1/achievementDefinitions/list),
  [`achievements.list`](https://developer.android.com/games/services/web/api/rest/v1/achievements/list)
  and
  [`achievements.unlock`](https://developer.android.com/games/services/web/api/rest/v1/achievements/unlock)
  accept `games` or `games_lite`. The app's request stays as it is. A
  refusal for the scope (a 403 with `insufficient_scope`,
  `ACCESS_TOKEN_SCOPE_INSUFFICIENT` or `insufficientPermissions`) is logged
  as its own case, so the logs show it; the phone check proves the scope.
- **No sync for a banned account** (manager's decision on request 1558):
  a ban keeps the account's progress off Play; the sync checks the ban
  (`isBanned`) first and logs the skip.
- **No new data**: nothing is stored, so `PLAYER_DATA` and the erasure stay
  as they are. Play Games keeps the unlocks under the player's Google
  account; the privacy policy says that the game reports them.
- **Logs carry no player id or token**: an achievement's English name and
  Google's status code only.

### Acceptance

- No access or refresh token is stored anywhere: not in Firestore (the
  command document holds its result and the custom token only), not in a
  log line (an emulator spec runs the whole command with Google faked,
  including an error body that names the token, and searches every
  written document and log line for both tokens), and `player.ts`
  answers no token field (spec).
- A banned account syncs nothing, and the skip is logged (emulator spec).
- `achievementsToUnlock` (unit specs): earned × locked × Play's list:
  unlocks earned achievements that are `HIDDEN`, `REVEALED` or without a
  state; skips `UNLOCKED`; skips and names one Play does not list; skips a
  name Play lists twice; never unlocks an achievement the game has not
  earned or Play lists under a name the game does not know.
- `PlayGamesApi` (unit specs with a fake `fetch`): the three URLs with
  `language=en-US` and the bearer token, paging, null on a refusal.
- An emulator spec with an injected Games API: a sign-in that settles on
  an account with stored progress unlocks its locked earned achievements
  after the result is written; a refusal (`linked-elsewhere`, `banned`,
  `play-games-refused`) syncs nothing; a failing unlock or listing leaves
  the result `ok` and its token in place; an account without progress
  calls no Games API.
- The privacy policy says, in English and German, that the game reports
  the achievements it earned to Play Games at each app start (spec).
- The phone check (manual step): an achievement earned in the game shows
  unlocked in Play Games after the next app start.

### Open questions

- None for the build. Whether Play shows a draft achievement unlocked for
  a tester is checked on the phone; it does not change the code.

## Decided

- The achievement sync is step 3 of this issue, its own PR after step 2:
  it rides on step 2's code handover, and keeping it apart keeps step 2's
  PR (app, function, rules, game, privacy) reviewable.
- The reward is the achievement Lab Member (approved 2026-11-21); the owner
  publishes it on Play when they want.
