# feat-lazy-bacteria-game

Bacteria war for one or two players, on one screen or two devices. Each player steers a crosshair, the colony
follows it and tries to eat the other one. Play against the computer or share
one screen (and keyboard) with a second human.

## Modes

- **vs Computer** - one human against a [`BotController`](./src/lib/state/bot-controller.ts)
  in three difficulties. The bot only does what a human can do: it picks a point
  for its crosshair and fires its boost. Easy reacts slowly and only attacks when
  far ahead, Normal feeds first and attacks when stronger, Hard takes even
  fights, charges the enemy bacteria nearest to its own colony and boosts on
  contact. The human may use WASD or the arrow keys.

  The bot finds its way ([`bot-navigation.ts`](./src/lib/state/bot-navigation.ts)):
  a grid over the arena, a cell per four base cells, blocked by the walls and
  by the gates and sliding walls that are shut or about to shut, with the
  zones as costs (antibiotic dear, ice slow, agar a little cheap). On each
  decision it floods the travel costs out from its colony, picks food by the
  way there rather than as the crow flies, and steers round what is in the
  way. A wall a colony slides along on its own - a way round at most a
  quarter longer - is no detour: the crosshair goes straight at the target,
  since gathering a big colony at a corner only holds it up. A real detour -
  out of a dead end, round to a keep's door, round antibiotic or ice - sends
  the crosshair along the cheapest way: to the furthest spot the colony can
  reach in a straight line, and at least eight grid cells on, so it waits
  round the corner and the colony flows after it. The bot's decisions are part of a replay, so this
  raised `BALANCE_VERSION` to 2: runs recorded before no longer play back.

- **2 Players** - Orange on WASD, Blue on the arrow keys, or one finger each on
  a touchscreen.

- **Online** - two devices, a colony each ([`net/`](./src/lib/net)). See
  [Online matches](#online-matches).

## Touch layout

The [`BacteriaGameComponent`](./src/lib/bacteria-game.component.ts) has one
stage, which looks the same embedded in the page and fullscreen. Embedded, it
fills the viewport below whatever is above it (the shell's toolbar, or nothing
on the game's own site). Fullscreen - the button in the menu or the bar, or F -
lays it over the whole viewport and asks the browser's Fullscreen API for the
rest, where a browser offers it (iPhones do not). A touch device opens
fullscreen and asks right away when a click brought the player here, otherwise
with the next gesture the game owns (Start, resume, F or the button), because
browsers refuse the request without a gesture. The stage is a grid
with the arena in the middle and one _seat_ per human player, made of a
[joystick zone](./src/lib/joystick/joystick.component.ts) on one side of the
arena and a [boost pad](./src/lib/boost-pad/boost-pad.component.ts) on the
other.

Two players sit at the short edges of the phone, one at each end, with the
phone lying flat between them. Each gets the stick in the left hand and the
boost pad with the colony's numbers in the right, turned towards them: with
the phone lying across, seat 0 is the left column turned a quarter clockwise
and seat 1 the right column turned the other way; upright (portrait), the
seats are bands along the bottom and the top edge, the top one upside down.
The seating plan is plain CSS in the component's stylesheet - media queries
pick the orientation, the pad's cell turns the pad and sets `--seat-turn`,
which the joystick reads for its label. The joystick itself is never turned:
a stick looks the same from every side, and it reports its push in screen
space, so no mirroring is needed either - "away from me" moves the crosshair
away from that player whichever way they sit. The joystick floats: wherever
the finger lands becomes the centre of the stick, and the crosshair keeps
moving in the direction it is pushed - slower for a gentle push - until it is
released. Dragging a crosshair across the arena still works too.

Entering the native fullscreen also locks a phone into landscape. Escape on
the main menu, the back gesture or the fullscreen button put the stage back
into the page.

The host application has to provide the CDK's `FullscreenOverlayContainer` as
its `OverlayContainer` (both apps in this workspace do): the browser paints
only the element that fills the screen, so a select panel rendered on the body
would be invisible while the arena is in native fullscreen.

## Menu

The stage opens on the menu screens ([`menu/`](./src/lib/menu)), which fill
it, opaque, over a swarm of bacteria drifting in the players' colours (plain
CSS animation, still for players who ask for less motion):

- **Main menu** - the title, _New game_, the way to My Colony, Profile,
  Settings and How to play, and a card with the campaign so far: levels
  open, medallions per metal and _Continue the campaign_, which starts the
  furthest open level right away.
- **My Colony** ([`my-colony.component.ts`](./src/lib/menu/my-colony.component.ts)) -
  the player's colony as it will look in the dish, drawn by the game's own
  painter ([`look-preview.ts`](./src/lib/arena/look-preview.ts)), the skin
  it wears - a gallery of every look, each on a sample colony in the
  player's colour - and the colonies' colours. The first eight skins are
  free; the marbles, lava, galaxy, plasma and chrome are bought with the
  DNA of the Evolution screen ([`state/skins.ts`](./src/lib/state/skins.ts),
  kept in the evolution progress, where they survive a reset) and worn from
  the moment they are bought. More of the colony is to be shaped here in
  time.
- **New game** ([`new-game.component.ts`](./src/lib/menu/new-game.component.ts)) -
  a Material stepper that goes through only the steps the mode picked needs
  ([`play-modes.ts`](./src/lib/menu/play-modes.ts)):
  - _Mode_: a card each for the **training** (missions done), the
    **campaign** (levels open), the **daily
    level** (attempts and streak), the **endless run** (the best one), **free
    play** and **two players** (the rivalry).
  - _Level_ - for the training its missions (see [Training](#training));
    for the campaign, free play and two players the
    [level map](./src/lib/menu/level-map.component.ts), the ladder in
    chapters (Petri, Laboratory, Body, Reactor -
    [`state/chapters.ts`](./src/lib/state/chapters.ts)), a card per level in
    its arena's colours with its medallion per difficulty. The campaign keeps
    the ladder's locks; free play and two players open every level and add
    _Generate a level_ - a style and a difficulty from 1 to 10, rolled into a
    generated level that is then picked like any other and stays offered
    while another is picked. Generated levels, like endless ones, keep no
    medallion - there is no second go at a rolled seed. Picking a level moves
    on to the start.
  - _Start_: the briefing in the level's arena colours, with its clock and
    its zones as chips - or the endless run's rules - beside the opponent:
    the computer's difficulty with the best medallion held and what the next
    one needs, or between two players the series, the head start and the
    rivalry. Then _Start_.

  Picking a mode sets the game up for it: who plays, and whether the
  ladder's locks apply (free play is the stored switch it always was). The
  screen opens on the mode last played; _Choose a level_ on the result
  screen opens it on that mode's levels.

- **Profile** - levels won, medallions per metal and every medallion level by
  level.
- **Settings** - the two resolutions,
  sound with music and effects switched and set in volume on their own,
  vibration where the device can, the frame rate badge and browser
  fullscreen.
- **How to play** - the rules in three steps, the keys and the touch layout.

While a screen is open, the arena, its bar and the seats under it are inert.
The pause menu (Resume, Restart, Settings, Quit to menu) and the match result
(Main menu, Choose a level, Play again, Next) stay cards over the arena.
Escape behaves like in a game: it pauses a match, backs out of a screen, and
only leaves fullscreen from the main menu. The browser taking its own
fullscreen off - its Escape, the back gesture, the settings toggle - is
treated the same way, since that Escape never reaches the game.

The standalone app shows a loading screen while the game downloads - the
spinning petri dish of its icon and the title - which the game takes down
once its first view is up ([`splash.ts`](./src/lib/splash.ts)).

[`GameSettingsService`](./src/lib/settings.service.ts) remembers opponent,
difficulty, level and the frame rate badge in the game storage.

## Languages

The game speaks English and German ([`i18n/`](./src/lib/i18n)), switched at
runtime: one build serves both, as a remote inside the shell and as the PWA.
[`I18nService`](./src/lib/i18n/i18n.service.ts) follows the browser's
preferred language (German if it starts with `de`, English otherwise) until
the player picks one under Settings > Language; the choice is a setting of
the device (`GameSettingsService.setLanguage`). The game's root element
carries the active language as its `lang`.

Templates take the `t` pipe, `{{ 'settings.title' | t }}` or
`{{ 'lobby.waiting' | t: { name } }}`; code calls `I18nService.t(key, params)`
inside a `computed` or right where it builds a text. The texts are plain
objects per area, `en/<area>.ts` and `de/<area>.ts`, merged in
[`dictionaries.ts`](./src/lib/i18n/dictionaries.ts). The German object is
typed against the English one, so a missing or an extra key fails to
compile, and so does a key that names no text. A text holds `{name}`
placeholders, and a plural is `{ one, other }`, picked by the `count` param
with `Intl.PluralRules`. A text German lacks at runtime falls back to English.
Words several screens share (mute, fullscreen, a medallion's name, "of
{total}") live in `common`; a screen's name is its area's `title`, which the
buttons that open it take as well.

## Storage

Everything the game remembers goes through the ports in
[`src/lib/storage/`](./src/lib/storage/game-storage.ts):

- **Progress** (medallions, campaign, XP, achievements, totals) goes through
  `GameStorage` and belongs to the player. With a Firebase project configured
  it lives in Firestore
  ([`FirestoreGameStorage`](./src/lib/storage/firestore-game-storage.ts)),
  otherwise in local storage
  ([`LocalGameStorage`](./src/lib/storage/local-game-storage.ts)).
- **Settings** go through `DeviceStorage` and always stay in this browser's
  local storage, whoever signs in.

[`CLAUDE.md`](./CLAUDE.md) has the rules that keep the backends exchangeable.

### Cloud save

With a project, every visitor plays as a guest (an anonymous Firebase
account) and their progress is saved to the cloud from the first match. In
the profile they can **Sign in with Google** to keep it on every device:

- A guest signing in to a Google account for the first time keeps their
  progress. The guest account becomes the Google account.
- Signing in to a Google account that already played elsewhere adds what the
  guest played on this device to it, once.
- Signing out starts a new guest from the start. The progress stays with the
  Google account.

The game uses its own Firebase project, `bacteria-wars` (production builds
only; development builds stay local). Its config sits in
`apps/bacteria-game-remote/src/environments/environment.prod.ts`, and the
project needs, in the [Firebase console](https://console.firebase.google.com/project/bacteria-wars):

1. **Authentication** with the providers **Anonymous** and **Google**, and the
   domains the game runs on (`bacteria-wars.wolsok.de` and the shell's
   `angularexamples.wolsok.de`)
   under _Authentication > Settings > Authorized domains_.
2. A **Firestore** database.

The game itself runs on Firebase Hosting in the same project, at
`bacteria-wars.wolsok.de` ([ADR 0008](../../../../docs/adr/0008-bacteria-wars-on-firebase-hosting.md)).

The release pipeline deploys the game to Firebase Hosting, the Firestore
rules (`apps/bacteria-game-remote/firestore.rules`) and the indexes with the
TTL policy of the rooms (`apps/bacteria-game-remote/firestore.indexes.json`):
`bacteria-game-remote` has a `deploy` target
(`firebase deploy --only hosting,firestore`, config in
`firebase.bacteria-game-remote.json`, project alias in `.firebaserc`), which
the non-CDK job of `deploy.yml` runs with the `FIREBASE_TOKEN` secret like
the other Firebase apps. The token's account needs access to the project.

To play against local emulators instead (a `demo-` project, no credentials):
`npx nx run bacteria-game-remote:serve-emulator`. It needs Java for the
Firestore emulator. The e2e tests (`npx nx e2e bacteria-game-remote`) run
the production build against the same emulators, never the real project.

## Medallions

A win against the computer earns a medallion for that level and difficulty,
judged by [`medallions.ts`](./src/lib/state/medallions.ts) on what the
human's player measured over the match: `PlayerService` keeps the boosts
fired, the peak colony and the lowest size against the other colony next to
`captured` and `lost`. `GameStateService` judges the match as it ends and keeps
the award in the store beside the winner. The tiers are nested: each one asks
for everything the one below does.

| Tier     | Condition                                                          |
| -------- | ------------------------------------------------------------------ |
| Bronze   | A win                                                              |
| Silver   | Won within the level's `silverSec`                                 |
| Gold     | Won within `goldSec`, losing less than `goldLossShare` of the peak |
| Platinum | Gold without a boost, never below half the computer's size         |

The limits are per level (`medal` in [`levels.ts`](./src/lib/state/levels.ts)),
in seconds of match time, so they hold on every simulation resolution. The
result screen shows the medallion with what the next one needs, and the level
list shows the best one of each level at the selected difficulty. Two-player
matches earn none.

The match time is counted in whole seconds, as the match clock shows them, and
a frame adds at most 0.1 s to it - a hidden tab or a stall does not run the
clock ahead of the war.

[`ProgressService`](./src/lib/progress.service.ts) keeps the best medallion
per level and difficulty under its own storage key, `bacteria-game.progress`.
Stored and won medallions are merged, never replaced, so a second tab or
device cannot overwrite what the first one won.

## Lifetime totals and achievements

[`ProgressService`](./src/lib/progress.service.ts) also counts what every
match did - matches and wins against the computer, enemy bacteria captured,
enemy bacteria the walls crushed (what the computer lost that nobody
captured), pellets eaten up, matches between two players - and checks the
fourteen achievements of [`achievements.ts`](./src/lib/state/achievements.ts)
after each one: First Blood, Pacifist, Blitz, Comeback, Siege, Clean Sweep,
Full Dish, Gatekeeper, Converter, Glutton, Flawless, Petri Scholar, Hard
Boiled and Couch War. Each is earned once, on the day it is earned; the result
screen lists the ones a match earned, the profile all of them with the day or
the condition, and the main menu's card how many. Totals merge as the higher
of two, achievements as the earlier day, so tabs and devices converge.

## XP and ranks

Every match earns XP ([`xp.ts`](./src/lib/state/xp.ts)), even a lost one,
and XP is not stored as such - it follows from the progress. What a match is
worth on its own (finishing and winning, both times the computer's
difficulty, or a little for a match between two players) is counted as a
lifetime total, `matchXp`; what the player holds is worth its XP for as long
as it is held - the best medallion of every level and difficulty, 50 per
achievement. So XP merges as cleanly as the progress, never pays the same
medallion or achievement twice, and a player who held medallions before XP
existed has theirs from the start. XP climbs eight ranks named after
microbiology ([`ranks.ts`](./src/lib/state/ranks.ts)), Spore to Superbug,
and never unlocks gameplay.

The result screen tells the match in order: the medallion with what the next
one needs, the XP line by line with the bar towards the next rank (and Rank
up!), the achievements earned and the levels the match opened, then the
buttons. A match that ends before the storage has told what was held shows
its XP but leaves the rank and the opened levels out rather than guess them.
The main menu's card and the profile show the rank with its emblem and the
XP to the next one ([`rank/`](./src/lib/rank)).

## Unlocks

Cosmetics are earned, never bought, and never make a colony stronger
([`unlocks.ts`](./src/lib/state/unlocks.ts)). Like XP they follow from the
progress, so nothing about them is stored:

- **Colony colours** - orange and blue are free; green comes with First
  Blood, yellow with a gold medallion, cyan with Pacifist, pink and purple
  with the ranks Bacillus and Biofilm, red with Hard Boiled. A locked colour
  shows a lock and what opens it, and cannot be picked - a seat that has one
  already keeps it.
- **Arenas** - a gold medallion on a level opens its arena for every other
  level: _Arena_ in the settings dresses all levels in it, or leaves each in
  its own.

The result screen names what a match opened.

## Online matches

Two players on two devices, through the game's Firebase project
([ADR 0009](../../../../docs/adr/0009-bacteria-wars-online-lockstep.md)):

- **Lobby** - _Online_ in the new game's modes. One player opens a match
  and gets a code of six letters and digits; the other types it in. The
  host plays the left colony, picks the level and the colours and starts
  each match; the guest plays the right one and follows - their result
  screen waits for the host's next start. Big maps are locked online.
- **Lockstep** - both devices run the same match: the same `MatchEngine`,
  the same seed, the CPU simulation on the _Normal_ grid whatever the
  settings. Each tick is played once both players' inputs for it are in
  ([`Lockstep`](./src/lib/net/lockstep.ts)); what a player puts in is
  played six ticks (100 ms) later on both devices, so it has time to reach
  the other one. Both seats are played by the lockstep through the engine's
  seat drivers, as a ghost is. A device that waits too long says so
  ("Waiting for your opponent…"); pausing holds the match on both.
- **Checks** - once a second the devices compare a checksum of the
  players; should they differ, the match ends as out of step. A device that
  leaves or loses the connection forfeits the match under way.
- **Connection** - a WebRTC data channel, ordered and reliable
  ([`PeerLink`](./src/lib/net/peer-link.ts)). The host writes its offer
  into `rooms/{code}` in Firestore, the guest its answer
  ([`FirestoreGameRooms`](./src/lib/storage/firestore-game-rooms.ts)); the
  rules let anyone signed in read a room by its code, never list them, and
  one guest answer it. There is no TURN server, so two devices behind
  strict NATs cannot connect. A room expires an hour after it was opened
  (`expireAt`); a TTL policy on that field (`firestore.indexes.json`,
  deployed with the rules) has Firestore delete it some time after that,
  usually within a day.
- Online matches earn nothing - no medallion, XP or totals - and leave no
  replay. Without a Firebase project the mode says it is not available.

## Profiles, friends and matchmaking

Online play has people behind it ([ADR 0010](../../../../docs/adr/0010-bacteria-wars-profiles-friends-matchmaking.md),
[`social/`](./src/lib/social)):

- **Profile** - in _Profile_, every player, guests too, has a name, a motto
  and a picture: one of twelve bacteria the game draws
  ([`avatar-art.ts`](./src/lib/social/avatar-art.ts)), their Google photo
  once signed in with Google, or an image they upload, scaled down to
  96 px in the browser ([`shrink-image.ts`](./src/lib/social/shrink-image.ts))
  and kept in the profile document. A player without a saved profile goes
  by a name and a bacterium made from their uid. The name and the picture
  stand for the opponent in the match, the lobby and the result.
- **Find an opponent** - the online lobby's first button. Players wait in a
  queue in Firestore; the newer of two opens a room and hands its code to
  the older one, who joins ([`MatchmakerService`](./src/lib/net/matchmaker.service.ts)).
  The host starts at once on a random level that plays online.
- **Friends** - "Add as a friend" on the result of an online match sends a
  request; the other player accepts it in their lobby. _Invite a friend_
  shares a link (`#friend=<token>`, a week long); whoever opens it is asked
  to add the inviter. Friends are listed in the lobby with their status,
  and the player can remove one there.
- **Online status** - friends who share it show as online or playing, from
  the Realtime Database, which clears it the moment a connection drops
  ([`RtdbGamePresence`](./src/lib/storage/rtdb-game-presence.ts)). The
  profile has the switch.
- **Challenges** - _Challenge_ on an online friend opens a room and leaves
  its code with them; they see it on any menu screen and _Play_ joins it.
- Playing with a code stays as it was.

The project needs a Realtime Database instance whose URL is the web app
config's `databaseURL`; without one the game shows no online status.
`database.rules.json` and the TTL policies of queue entries, challenges and
invitations deploy with the other rules.

## Two-player rivalry

Two players on one screen get a loop of their own
([`rivalry.ts`](./src/lib/state/rivalry.ts)), set up on the level choice:

- **Series** - single matches, or the best of 3 or 5. The result screen
  shows the score and who took it; the next match after that starts a new
  series. A series moves through the levels; changing the opponent, the
  colours, the length or the head start, leaving for the main menu or
  leaving the page ends it, and a stored setup that arrives late waits for
  it to end.
- **Head start** - the stronger player can give the other a chance: each
  step starts the other colony with 15 % fewer bacteria.
- **Rivalry** - the wins of each colony colour are counted with the progress
  (`couchWins`), so the level choice and the result read "Orange 14 : 9
  Blue".

## Campaign ladder

Against the computer, the levels open one by one
([`campaign.ts`](./src/lib/state/campaign.ts)). The first is open from the
start, and every other opens once the level before it has been won at any
difficulty; a win always earns at least bronze, so the medallions tell which
levels were won. A locked level shows a lock and what opens it in the level
list, and the result screen's _Next_ button stays locked until it is open.
_Free play_ beside the level list opens every level, for players who know the
game already. Two players always have every level open.

## Training

Five short missions teach a new player the game, one thing each
([`state/training.ts`](./src/lib/state/training.ts)): **Steer** (hold the
white zone for 4 seconds), **Feed** (eat 8 pellets), **Boost** (eat 12
pellets and boost twice on the way, with a boost that recharges in 3
seconds), **Attack** (wipe out the dummy) and **First Fight** (be bigger than
the easy computer after a minute, or wipe it out). The main menu
offers _Training_ under _New game_ until every mission is done, and _New
game_ has it as a mode of its own: the missions in a list, done ones ticked,
the next one marked, then a briefing with the goal, a tip and the opponent.
While a mission runs, its goal stays at the top of the arena.

A mission is a level of its own
([`state/training-levels.ts`](./src/lib/state/training-levels.ts)), apart
from the ladder: it is set for one match like the daily level (`matchLevel`)
and won by an existing win rule - hold, harvest, timed or annihilation -
with the boosts fired checked on top where a mission asks for them. The first
four put a _training dummy_ across: a level with `dummy` gives the right seat
an idle seat driver (`planMatch`), so the colony sits where it spawned and
only fights back where it is attacked; the engine is unchanged and stays
deterministic. _First Fight_ plays the easy computer, whatever difficulty is
picked. Missions play plain - no evolution - are not recorded and offer no
ghost.

A done mission is kept in the progress with the day it was done, merged as
the earlier day like an achievement, and is worth 25 XP while it is held.
Missions count for nothing else: no medallion, no totals, no achievements. The
result screen says whether the match did the mission - or what it fell short
of - and goes on to the next mission, or to the campaign after the last one.
`training.spec.ts` plays every mission through with a scripted player, so a
balance change that makes one unwinnable fails a test.

## Win conditions

How a match ends is the level's `win` rule
([`win-conditions.ts`](./src/lib/state/win-conditions.ts)), judged by the
`MatchEngine` after every tick. Without one it is _annihilation_: the last
colony left wins, and both gone in the same tick is a draw. A _timed_ level
also ends once its `limitSec` of match time have passed, and then the bigger
colony wins (equal ones draw); a colony wiped out before still ends it at
once. The match clock counts down on a timed level and turns red in its last
ten seconds, the level choice notes the limit ("Timed · 2:30") and the result
screen says that time was up. The first timed level, _Half-Life_, opens the
Reactor chapter.

On a _survive_ level the left colony - the one up against a boss - wins
once it is still alive after `limitSec`; the clock counts down as on a
timed level.

A boss level (`boss` on the level) makes the right colony a boss, whoever
steers it: it starts `startScale` times the area, and its `ColonyTraits`
multiply its chance to divide, the pressure its bacteria exert and its
boost's cooldown - per colony, in both simulations (the GPU one already
took the division chance and the attack per colony). The boss bot, once
its colony has fallen behind, boosts whenever it can. The result screen
frames a boss level as its chapter's finale. _Meltdown_ closes the
Reactor chapter (survive a minute), _Patient Zero_ opens the Outbreak
chapter (beat it).

A level can add neutral colonies (`neutrals` on the level: where each
starts, as shares of the arena, and its start area): grey colonies no
player steers. `planMatch` spawns them after the players with `neutral: true`
and `NEUTRAL_TRAITS` - slow to divide, weak to bite. A
[`NeutralBrain`](./src/lib/state/neutral-brain.ts) per colony moves it
(`NEUTRAL_MOVES`): it strolls about the map, goes after a player's colony
that comes near and is less than 0.4 of its size, and keeps away from one
more than 1.25 of its size - colonies measured edge to edge, as discs.
The engine hands the simulation a crosshair for it on the ticks it moves:
slower than a step a tick, it steps only on the ticks its pace has made
up a step for. Its random numbers come from a seeded stream, so a replay
plays it out alike. The `MatchEngine`
gives them no player, so they count for no side: the outcome is judged on
the players, a player's size is measured against the other player's, and
nobody holds a zone with them. They keep their share of the arena's
capacity (`colonyCapacity`) all match: eating one adds its bacteria to
yours, but not its share - with it, bot matches grew big enough to stall. The bot sees a neutral colony as prey - a pellet as big as the
colony that it goes for unless it is hungry - never as the enemy, and with
neutrals about it charges the enemy's centre. The HUD and the
scoreboard show their bacteria together ("Neutral"). Two at most: with the
two players that is the four colonies the GPU runs, which a levels spec
checks. _Quarantine_ follows _Patient Zero_ with two of them, kept in
isolation rooms between the start spots.

On a _hold_ level a colony also wins once it has held the map's hold zone
(a `hill` zone, white) for `holdSec` in all: each tick, the `MatchEngine`
credits the colony with the most bacteria on the zone - nobody on a tie
(`zoneHolder`). Both simulations count each colony's bacteria on the zone
in their summaries, the GPU one in two spare channels of its report. The
HUD shows each colony's seconds held, the level choice notes the rule
("Hold the zone · 0:30"), the bot heads for the zone unless it is hungry,
and _Control Room_ closes the Reactor chapter with one behind four
shields. The rule is part of the level, so a replay plays it again with
its level.

On a _harvest_ level a colony also wins once it has eaten up `pellets`
pellets. A pellet goes to the colony that took the most of it over its
life - `NutrientPellets.drain` adds up each colony's bites and names the
biggest once the pellet is gone, nobody on a tie. The CPU simulation
counts the eaters of a pellet per colony as it drains it; the GPU one
reads them from the report's pellet row, where each colony's eaters take
16 bits of the two channels beside the total. Both keep a count per
colony in their summaries (`pellets`). Should two colonies get there in
one tick, the one with more wins. The HUD shows each colony's pellets
against the target, the level choice notes "Harvest · 40 pellets", the
bot goes for food before anything else, and _Feeding Ground_ closes the
Outbreak chapter with one.

## Zones

Besides walls, a map can lay out zones (`createZones`, point symmetric like
the walls - [`zones.ts`](./src/lib/state/zones.ts)), each a rect or a disc of
one kind:

- **Antibiotic** (violet) drains 0.5 energy a second and stops regeneration -
  a bacterium that lingers dies, lost without anybody capturing it.
- **Agar** (green) doubles the chance to divide.
- **Ice** (pale blue) gives a bacterium a 50 % chance to sit each movement
  step out.
- **Hold zone** (white) does nothing to the bacteria - it is the ground a
  hold level is won on.
- **Heat** (red) raises the colony's aggression by 0.25 there, up to 0.95 -
  the crosshair keeps a pull.

The CPU simulation keeps a zone code per cell; the GPU one keeps it above
the wall bit of its wall mask, so no texture is added. A level lays its
zones out as puddles - overlapping round blobs (`puddle`) - not boxes. The
painters show them as a layer of their own over the floor
([`zone-decal.ts`](./src/lib/arena/zone-decal.ts)), painted once per level
as fine as the canvas shows it and softened by a pixel, so the edges are
smooth: each zone tinted in its colour with a bright rim, and strewn with
what tells it apart at a glance - pills on antibiotic, bubbles of food on
agar, crystals on ice, flames on heat, flags on the zone to hold.
_How to play_ lists them. _Containment_, the second level of the Reactor
chapter, has all of them.

## Big maps and the camera

A map can be bigger than the base arena: `GameMap.size` times it along each
side, laid out on that bigger base (`size: 2` lays out on 640 x 360 base
cells). Bigger is more room, not smaller bacteria, so two factors stay apart
([`arena-size.ts`](./src/lib/state/arena-size.ts)):

- the grid's resolution, cells per base cell (`scaleOf(width, size)`,
  `gridScale(level, width)`), which keeps the game the same on every grid:
  the jam, the crosshairs, the bot's distances and nav cells, the start
  blob, the crosshair speed;
- the map's size, which makes it bigger: the arena has `size` times the
  cells along each side (`arenaSize(resolution, size)`), and the colonies
  room for `size`² times the bacteria (`levelBalance`).

A [`Camera`](./src/lib/arena/camera.ts) shows part of a big map: it
follows the crosshair of the one human in a match on a soft spring, zooms
with the wheel or a pinch between the whole map and the size of a base one,
and never looks past the arena's edge. A second finger on the arena with no
crosshair left to grab pinches with the first, which lets go of its
crosshair; both stay out of play until lifted ([`Pinch`](./src/lib/touch-controls.ts),
in client pixels, since the cells under a finger change as it zooms). The canvas is as big as a base map's
(`renderScale(sim, screen, size)`) and the painters draw only the camera's
`view` onto it, so a big map costs no more pixels than a base one: the GL
passes map the canvas through a `uView` uniform, the Canvas 2D one through
its transform, and its slime is worked out only around the colonies in
view (`slimeRegion`). The zones are painted as fine as the camera ever
zooms (`detailScale`), the pointer maps through the view
(`arenaPointFromClient`), and a frame whose view moved lays its floor fully
instead of fading into a trail that lies elsewhere. Every match starts on
the whole map.
While the camera shows part of the map, a
[minimap](./src/lib/arena/minimap.ts) in the arena's top right corner shows
all of it: the walls, laid once per map, the colonies block by block - each
block of `influenceCellSize` cells in the colour of the colony with the most
bacteria in it (`minimapPixels`) - and a frame around the camera's view. Both
simulations hand out those blocks (`Simulation.blockCounts`): the GPU one
reads them back with its report anyway, the CPU one counts its bacteria
only when asked. The minimap is a small Canvas 2D overlay whichever painter
draws the arena; it takes in the colonies ten times a second and draws the
view frame on every frame.

Empty space costs the GPU simulation little: its cell passes - crush,
combat, feed, the claim and apply pairs - run only over the
[active area](./src/lib/gl/active-area.ts), the colonies' boxes from the
report grown by how far a bacterium gets in the ticks since (a step per
move, one for a child, one to spare), together with the area of the last
three ticks, so a spot a colony left is written empty in every state
texture before the passes stop at it. Every pass finds its cell from
`gl_FragCoord`, so a scissor per rect is all it takes, and a cell drawn
twice where two rects overlap comes out the same. The whole arena runs for
the first ticks of a match, while a wall shoves bacteria aside, when the
report lags further behind than the reach kept, and once the rects cover
nine tenths of it. On _Expanse_ that is about half the cells of a tick;
the coarse passes, the glow and the report still run over everything.
_Expanse_ opens the chapter of the same name: four times the room, rocks,
and two neutral colonies, won on size after four minutes.

## Boost

Every player has a boost (Space for the first player, Enter for the second, or
the boost pad on a touchscreen). For `boostDurationSec` the colony moves
`boostSpeedFactor` times faster, hunts with `boostAggression` and its bacteria
exert `boostAttackFactor` times their energy as pressure. Once the boost is
over it recharges for `boostCooldownSec` before it can be fired again. Fire it
to break a frontline or to grab a contested pellet.

## Mechanics

The whole simulation lives in
[`bacteria-simulation.ts`](./src/lib/state/bacteria-simulation.ts) and runs on an
occupancy grid with one bacterium per cell. Every tick is processed in fixed
phases, so the outcome never depends on the order the players are iterated in:

1. **Grid** - the occupancy grid and a coarse enemy density field are rebuilt.
2. **Nutrients** - pellets on the map feed whoever stands on them and push those
   bacteria beyond their normal energy limit (they are rendered white).
3. **Combat** - each bacterium compares the energy of its enemy neighbours with
   the energy of its own. Attackers are favoured (`defenceFactor < 1`), so a
   frontline is never stable. At zero energy a bacterium is either converted to
   the attacking colony or digested completely.
4. **Division** - well fed bacteria clone themselves into free space until the
   arena's carrying capacity is reached.
5. **Movement** - bacteria follow their player's crosshair, but bias their
   direction towards nearby enemies.

Because captures conserve the population while digestion does not, battles free
up carrying capacity, both sides regrow into the gap and the stronger colony
slowly squeezes the weaker one out.

## Ticks and seeds

The war advances in fixed ticks of 1/60 second
([`fixed-tick.ts`](./src/lib/state/fixed-tick.ts)), whatever the display
shows: `FramePacer` picks the display frames the game runs on, and a
`TickClock` turns the time between them into whole ticks. Each tick moves the
crosshairs, counts the boosts down, lets the bot think and steps the
simulation, all by the same length. On a frame that falls between two ticks
the painter carries each crosshair ahead along its last step, so it glides
without being drawn a tick late. The match clock, which judges the
medallions, counts ticks.

Every match draws its chances from one seed: the simulation and its pellets
from the seed itself, each bot from a stream derived from it. On the CPU simulation, the same seed with the same inputs
plays the same match - the ground for replays. The GPU simulation takes the
seed as well, but its shaders do not come out the same on every device.

## Replays

A match runs in a [`MatchEngine`](./src/lib/state/match-engine.ts): the
players, the bots and the simulation, tick by tick, without Angular or the
keyboard. `PlayerService` turns the keys and sticks into one steering vector
per human, and mirrors the engine's players into the store for the UI. The
engine decides when the match is over, right after the tick that ends it.

While a match runs, the engine records what the humans put in, each input
once, when it changes: the steering vector from a tick on, a drag target and
a boost before a tick. The crosshairs follow from those inputs, so a match
records a few hundred entries rather than a position per tick. When the match
ends, the game state's `lastReplay` holds it - a ghost match aside - as a
[`Replay`](./src/lib/state/replay.ts): that recording under a header with
everything the match was derived from (level, mode, difficulty, colours,
head start, grid size, seed, balance version and which simulation ran it).
`planMatch` turns the header back into the colonies and the rules, and
`playReplay` plays the match again on the CPU simulation with nobody
watching; the bot is not recorded, it decides the same again from the seed.
A replay of another format or balance version, or one the GPU ran, is refused
rather than played out wrong, and `parseReplay` refuses anything that is not
a whole one. Raise `BALANCE_VERSION` with every change that plays a recorded
match out differently.

## Ghost

After a match against the computer, the result screen offers to fight your
ghost: a match on the same level and seed where the computer's colony is
steered by your own run - the same steering, drag targets and boosts, turned
through the centre of the arena so the left colony's moves are made by the
right one, and stretched onto the arena size of the device. The maps are
point symmetric, so the turned run meets the same walls. A
[`GhostController`](./src/lib/state/ghost.ts) plays one seat of a recording
into another; replays play every human back the same way. The ghost reacts
to nothing, it only does what you did - beating it means beating your own
plan. A ghost match earns no medallion and no XP, and it does not replace
the run it plays. The ghost holds for the one match it was picked for: any
way out of that match ends it, and "Fight it again" sets it again. It
plays on its own level and leaves the player's setup as it was.

A run can be shared too: **Share your run** on the result screen makes a
link with the run packed into its hash
([`replay-link.ts`](./src/lib/state/replay-link.ts)) - the inputs as whole
numbers on the engine's grid, ticks as the distance to the input before,
deflated and written in base64url. A minute of steering a stick all the time
fits in a few KB, and the run never reaches a server. Opening the link offers
a ghost challenge on the main menu;
the hash is taken out of the address once read. The engine keeps a stick push
in steps of 1/16 and a drag target in quarter cells, so what is played is
exactly what the link carries.

## Level generator

[`state/level-generator/`](./src/lib/state/level-generator) makes levels
from a seed. A **recipe** lays out the left half of the base arena (320 × 180) - _field_ scatters pillars, _corridor_ runs walls from edge to edge
with gaps, _fortress_ builds a keep with doors around each start spot,
_cave_ grows round walls like tissue - and the generator mirrors it through
the centre like every hand-made map. A layout is only kept when it is
playable: no wall reaches into a start spot, a way at least three cells wide
leads from one start spot to the other, and the walls take between 3 % and
35 % of the arena. Of up to five playable layouts, the one whose way between
the start spots winds most like the recipe wants is taken.

A generated level's id says what it is made from -
`gen:<recipe>:<seed>:<difficulty>`, the difficulty from 1 to 10 - and is
stable for good: `getLevel`, `getMap`, `arenaTheme` and `levelMusic`
understand it like any hand-made id, and a medallion, a replay or a link can
name it. The difficulty sets the rules between the calmest and the busiest
hand-made level and tightens the medallion limits. A generated level is named
from its seed ("Hungry Locks"), borrows the look of a hand-made level of its
style, and has a tune of its own: the style sets the mood of the key, the
groove and the instruments, the seed the chords, the key's pitch and the
melody, the difficulty the tempo. Only the daily level keeps a medallion of
the generated ones - a rolled or an endless level has no second go - and
none of them counts towards the campaign's tally or XP. A change to a recipe that would lay out an old id differently
needs a new recipe name instead.

## Daily level

Every day has one generated level, the same for everyone
([`state/daily.ts`](./src/lib/state/daily.ts)): the seed is the date in UTC,
the recipe changes from day to day and the difficulty warms up over the week,
from Monday's 3 to Saturday's 7. The main menu offers it with the attempts
left and the streak. An attempt counts as its match starts - a restart or
a match given up is one as well - and the first three of a day count
towards its medallion, judged on the stored attempts; after them it is
practice. The streak counts the days it was
played in a row, and one missed day only pauses it. Both live in the
progress as counts, added to the stored value like the totals, and a merge
keeps the later day, or the higher count on the same day.

The daily level is a level for one match, like a ghost: it does not change
the setup, a reset ends it, and "Play again" is the next attempt. The match
carries the day it was started for, so one that runs past midnight UTC
counts for the day it began.

## Endless run

An endless run ([`state/endless.ts`](./src/lib/state/endless.ts)) is a
ladder of generated levels from a seed of its own: every level a style of
its own, the difficulty one step up with every win, up to the hardest. A
defeat - a draw counts as one - costs one of three lives and the same level
comes again; the last life ends the run. The run outlasts the reset between
its matches and ends with the next match that is not one of it, whichever
way the player left. Its matches have no Restart - it would cost no life -
and its levels, new every time, earn no medallion. The most levels ever
beaten in one run is kept in the progress, merged by the higher number,
written with the match that set it, and shown on the main menu and at the
end of a run.

## Tuning

Every number that shapes how the game feels lives in
[`game-balance.ts`](./src/lib/state/game-balance.ts), together with the wall
layout. The walls are point symmetric to the centre of the arena so neither
player gets the better half.

## Running unit tests

Run `nx test feat-lazy-bacteria-game` to execute the unit tests.

## Further reading

- [Design ideas](../../../../docs/bacteria-game/design-ideas.md) - motivation systems, chapters and medallions, a level generator, multiplayer, bigger maps and richer graphics that could come next.
