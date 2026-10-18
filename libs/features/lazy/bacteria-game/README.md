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

The stage opens on a main menu - opponent, Play, Settings, How to play - and
every other screen lives in the same panel over the arena: the settings
(difficulty, level, frame rate badge, browser fullscreen), the pause menu
(Resume, Restart, Settings, Quit to menu) and the match result (Play again,
Next level, Main menu). Escape behaves like in a game: it pauses a match,
backs out of a screen, and only leaves for the page from the main menu. The
browser taking its own fullscreen off - its Escape, the back gesture, the
settings toggle - is treated the same way, since that Escape never reaches
the game.

[`GameSettingsService`](./src/lib/settings.service.ts) remembers opponent,
difficulty, level and the frame rate badge in local storage.

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
per level and difficulty under its own local storage key,
`bacteria-game.progress`, and re-reads it before it writes, so a second tab
does not overwrite what the first one won.

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
