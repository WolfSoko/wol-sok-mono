# feat-lazy-bacteria-game

Two player bacteria war. Each player steers a crosshair, the colony follows it
and tries to eat the other one.

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
