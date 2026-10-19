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
- **Choose a level** - opened by both Play buttons. Opponent, difficulty and
  free play at the top, a card per level with its medallion per difficulty
  or the lock of the ladder, and the chosen level beside them: its briefing,
  the computer's, the best medallion held and what the next one needs, and
  _Start_.
- **Profile** - levels won, medallions per metal and every medallion level by
  level.
- **Settings** - colony colours, how the bacteria look, the two resolutions,
  sound, music, the frame rate badge and browser fullscreen.
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

## Campaign ladder

Against the computer, the levels open one by one
([`campaign.ts`](./src/lib/state/campaign.ts)). The first is open from the
start, and every other opens once the level before it has been won at any
difficulty; a win always earns at least bronze, so the medallions tell which
levels were won. A locked level shows a lock and what opens it in the level
list, and the result screen's _Next_ button stays locked until it is open.
_Free play_ beside the level list opens every level, for players who know the
game already. Two players always have every level open.

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
occupancy grid with one bacterium per cell. Every frame is processed in fixed
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

## Tuning

Every number that shapes how the game feels lives in
[`game-balance.ts`](./src/lib/state/game-balance.ts), together with the wall
layout. The walls are point symmetric to the centre of the arena so neither
player gets the better half.

## Running unit tests

Run `nx test feat-lazy-bacteria-game` to execute the unit tests.

## Further reading

- [Design ideas](../../../../docs/bacteria-game/design-ideas.md) - motivation systems, chapters and medallions, a level generator, multiplayer, bigger maps and richer graphics that could come next.
