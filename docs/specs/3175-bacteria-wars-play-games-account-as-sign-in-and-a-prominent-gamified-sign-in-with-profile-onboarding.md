# Spec: Play Games account as sign-in, and a prominent, gamified sign-in with profile onboarding

Issue: [#3175](https://github.com/WolfSoko/wol-sok-mono/issues/3175).

The issue asks for two things. They ship as steps of this issue, each its own
PR ("Part of #3175"):

- **Step 1 — the Lab Pass** (this spec in full): signing in becomes a quest
  of its own in the main menu, with a profile onboarding and a reward. Web
  only, testable in CI.
- **Step 2 — Play Games as sign-in** (outlined below, specified in detail
  before it starts): the Play Games account of the Android app signs the
  player in, or is linked to the game account. It needs the Android app, a
  Cloud Function, an OAuth secret and a check on a real device.

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
   **Lab Member** ("Complete your Lab Pass"), shown like every other: toast
   with the game's achievement sound, the profile's achievement list, its XP
   (`ACHIEVEMENT_XP`, 50), and it syncs to Play Games as a draft with the
   next Android release.
4. **The guest banner becomes the pass.** The guest notice's text (unused
   guest accounts are deleted after 90 days) moves into the pass's card while
   step 1 is open; `GuestNotice.visible` keeps deciding *when* a guest's
   card shows urgently (from the third day), but the card itself shows from
   the first visit, folded to one line until the notice is due.

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
  is loaded. Reason: the achievement system already does toasts, XP,
  profile list, merging and Play Games; a reward of its own would duplicate
  that.
- **Play Games**: `lab-member` gets an entry in
  `play-games-achievements.json` (10 points, within the 2000 total) and an
  icon from the achievement icon generator. It reaches Play as a draft; the
  owner publishes it.
- **The card is one component** (`guest/lab-pass-card.component.ts`)
  replacing `GuestBannerComponent` in the main menu; the account chip stays
  for players who completed or put the pass away.
- **Without the cloud** (no sign-in) the pass never shows and the
  achievement cannot be earned.

### Acceptance

- A guest sees the Lab Pass card in the main menu with step 1 active;
  "Sign in" in it starts the Google sign-in.
- From the guest notice's third day the card shows the deletion note,
  unfolded.
- After a guest's sign-in without a stored profile, the profile screen opens
  in onboarding mode.
- Each step's slot fills when its fact holds; the button names the next open
  step and leads there (sign-in, profile editor, profile editor's motto,
  Friends).
- With all four done, `lab-member` is earned once (toast, profile, XP), and
  the card goes away for good.
- "Later" hides the card for two weeks.
- Specs cover `labPassSteps`, `LabPass` (granting once, not before the
  progress loaded), the card and the onboarding trigger; the Play Games
  achievement spec stays green with the new entry.
- Texts in English and German.

## Step 2: Play Games as sign-in (outline)

Firebase Auth's Play Games provider exists only in the Android SDK; the game
runs in Chrome (TWA) and gets no Play Games identity. The way that fits the
repo's rules (the client never calls a function):

1. The Android app asks Play Games for a one-time server auth code
   (`GamesSignInClient.requestServerSideAccess`) after its silent sign-in
   and hands it to the page in the launch URL's fragment.
2. The game, signed in as its guest or Google account, writes a command
   document with the code; a trigger exchanges it (OAuth client secret as a
   function secret), reads the Play Games player id, and links it to the
   uid (`playGamesLinks/{playerId}`, an entry in `PLAYER_DATA`).
3. If the player id is linked to another uid already, the trigger answers
   with a custom token for that uid, and the game signs in with it,
   adopting the guest's progress as the Google sign-in does today.
4. `guestCleanup` keeps accounts with a Play Games link.

Open for that step: whether the fragment or Custom Tabs' postMessage carries
the code; how a custom-token account shows as signed in (`profileOf`);
privacy policy section for Play Games sign-in; a manual step for the OAuth
secret.

## Open questions

- Is an achievement (permanent on Play once published) the right reward, or
  should the pass give something local only?
