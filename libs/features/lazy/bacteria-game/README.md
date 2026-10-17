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

The page enters fullscreen as soon as it is opened: the
[`BacteriaGameComponent`](./src/lib/bacteria-game.component.ts) lays its stage
over the whole viewport right away and asks the browser's Fullscreen API for
the rest on the first tap, where a browser offers it (iPhones do not). The
stage is a grid with the arena in the middle and one _seat_ per human player:
a [joystick zone](./src/lib/joystick/joystick.component.ts) and a boost button.

Seat 0 sits along the near edge of the phone, seat 1 along the far edge with
its controls turned by 180°, so two people play with the phone lying flat
between them and each sees their own controls the right way up. The joystick
floats: wherever the finger lands becomes the centre of the stick, and the
crosshair keeps moving in the direction it is pushed - slower for a gentle
push - until it is released. Dragging a crosshair across the arena still works
too. In portrait the seats turn into bands along the short edges.

Entering the native fullscreen also locks a phone into landscape. Escape, the
back gesture or the button in the bar return to the page, where the keyboard
instructions live.

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
