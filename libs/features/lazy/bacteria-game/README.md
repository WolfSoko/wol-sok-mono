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
