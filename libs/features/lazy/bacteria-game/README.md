# feat-lazy-bacteria-game

Bacteria war for one or two players. Each player steers a crosshair, the colony
follows it and tries to eat the other one. Play against the computer or share
one screen (and keyboard) with a second human.

## Modes

- **vs Computer** - one human against a [`BotController`](./src/lib/state/bot-controller.ts)
  in three difficulties. The bot only does what a human can do: it picks a point
  for its crosshair and fires its boost. Easy reacts slowly and only attacks when
  far ahead, Normal feeds first and attacks when stronger, Hard takes even
  fights, charges the enemy bacteria nearest to its own colony and boosts on
  contact. The human may use WASD or the arrow keys.
- **2 Players** - Orange on WASD, Blue on the arrow keys, or one finger each on
  a touchscreen.

## Touch layout

The page opens in fullscreen: the
[`BacteriaGameComponent`](./src/lib/bacteria-game.component.ts) lays its stage
over the whole viewport from the first render and asks the browser's
Fullscreen API for the rest, where a browser offers it (iPhones do not) - right
away when a click brought the player here, otherwise with the next gesture the
game owns (Start, resume, F or the button), because browsers refuse the
request without a gesture. The stage is a grid
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

Entering the native fullscreen also locks a phone into landscape. Escape, the
back gesture or the button in the bar return to the page, where the keyboard
instructions live.

The host application has to provide the CDK's `FullscreenOverlayContainer` as
its `OverlayContainer` (both apps in this workspace do): the browser paints
only the element that fills the screen, so a select panel rendered on the body
would be invisible while the arena is in native fullscreen.

## Menu

The stage opens on the menu screens ([`menu/`](./src/lib/menu)), which fill
it, opaque, over a swarm of bacteria drifting in the players' colours (plain
CSS animation, still for players who ask for less motion):

- **Main menu** - the title, _Play_ against the computer, _Two players, one
  screen_, the way to Profile, Settings and How to play, and a card with the
  campaign so far: levels open, medallions per metal and _Continue the
  campaign_, which starts the furthest open level right away.
- **Choose a level** - opened by both Play buttons, a map of the levels.
  Opponent, difficulty and free play at the top; the ladder in chapters
  (Petri, Laboratory, Body, Reactor - [`state/chapters.ts`](./src/lib/state/chapters.ts))
  with the levels open in each, a card per level in its arena's colours with
  its medallion per difficulty or the lock of the ladder; and _Beyond the
  ladder_: the daily level and an endless run against the computer, and
  _Generate a level_ - a style and a difficulty from 1 to 10, rolled into a
  generated level that is then picked like any other and stays offered while
  another is picked. Generated levels are open from the start and, like
  endless ones, keep no medallion - there is no second go at a rolled seed. Beside them the chosen
  level: its briefing, the computer's, the best medallion held and what the
  next one needs, and _Start_.
- **Profile** - levels won, medallions per metal and every medallion level by
  level.
- **Settings** - colony colours, how the bacteria look, the two resolutions,
  sound with music and effects switched and set in volume on their own,
  vibration where the device can, the frame rate badge and browser
  fullscreen.
- **How to play** - the rules in three steps, the keys and the touch layout.

While a screen is open, the arena, its bar and the seats under it are inert.
The pause menu (Resume, Restart, Settings, Quit to menu) and the match result
(Main menu, Choose a level, Play again, Next) stay cards over the arena.
Escape behaves like in a game: it pauses a match, backs out of a screen, and
only leaves for the page from the main menu. The browser taking its own
fullscreen off - its Escape, the back gesture, the settings toggle - is
treated the same way, since that Escape never reaches the game.

The standalone app shows a loading screen while the game downloads - the
spinning petri dish of its icon and the title - which the game takes down
once its first view is up ([`splash.ts`](./src/lib/splash.ts)).

[`GameSettingsService`](./src/lib/settings.service.ts) remembers opponent,
difficulty, level and the frame rate badge in the game storage.

## Storage

Everything the game remembers goes through the
[`GameStorage`](./src/lib/storage/game-storage.ts) port. Its default backend is
[`LocalGameStorage`](./src/lib/storage/local-game-storage.ts), and a Firebase
backend can take its place later. [`CLAUDE.md`](./CLAUDE.md) has the rules
that keep it exchangeable.

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
captured), matches between two players - and checks the thirteen
achievements of [`achievements.ts`](./src/lib/state/achievements.ts) after
each one: First Blood, Pacifist, Blitz, Comeback, Siege, Clean Sweep, Full
Dish, Gatekeeper, Converter, Flawless, Petri Scholar, Hard Boiled and Couch
War. Each is earned once, on the day it is earned; the result screen lists
the ones a match earned, the profile all of them with the day or the
condition, and the main menu's card how many. Totals merge as the higher of
two, achievements as the earlier day, so tabs and devices converge.

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
Reactor chapter. The rule is part of the level, so a replay plays it again
with its level.

## Zones

Besides walls, a map can lay out zones (`createZones`, point symmetric like
the walls - [`zones.ts`](./src/lib/state/zones.ts)), each a rect or a disc of
one kind:

- **Antibiotic** (violet) drains 0.5 energy a second and stops regeneration -
  a bacterium that lingers dies, lost without anybody capturing it.
- **Agar** (golden) doubles the chance to divide.
- **Ice** (pale blue) gives a bacterium a 50 % chance to sit each movement
  step out.
- **Heat** (red) raises the colony's aggression by 0.25 there, up to 0.95 -
  the crosshair keeps a pull.

The CPU simulation keeps a zone code per cell; the GPU one keeps it above
the wall bit of its wall mask, so no texture is added. Both painters tint
the ground in the zone's colour with a rim around it, under the walls, and
_How to play_ lists the four. _Containment_, the second level of the Reactor
chapter, has all of them.

## Boost

Every player has a boost (Space for the first player, Enter for the second, or
the button next to the scoreboard). For `boostDurationSec` the colony moves
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
a ghost challenge on the main menu and above the setup of the page layout;
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
