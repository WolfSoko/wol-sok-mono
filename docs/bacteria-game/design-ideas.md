# Bacteria Game - design ideas

Ideas for where the bacteria war (`libs/features/lazy/bacteria-game`, served as
`bacteria-game-remote` and inside `angular-examples` under `/bacteriaGame`)
could go next: what keeps people playing, how the levels could grow, medallions,
a level generator, multiplayer, bigger maps and richer graphics.

This is a working document, not a decision record. Each section ends with
_Where it hooks in_, naming the code the idea would touch, and the last section
orders everything into phases. Decisions that get made along the way belong in
`docs/adr/`.

Last brought up to date with `main` after #2475 (level music, organic levels,
16:9 arena), #2476 (simulation and screen resolution settings) and #2477 (the
game loop on display frames). _What the latest changes mean for the plan_
below lists what they changed.

## Where the game stands today

- **One match type.** Two colonies, one or both steered by humans, until one
  colony is gone (`GameState.END`, `matchEnded`). A draw is possible.
- **Twelve hand-made levels** (`state/levels.ts`): a `GameMap` plus a partial
  `GameBalance` and a crosshair speed. Levels 1 to 8 are the classic layouts
  (walls, gates, sliders, `state/maps.ts`), levels 9 to 12 the organic ones
  (`state/organic-maps.ts`: Alveoli, Mycelium, Heartbeat, Villi), built from
  overlapping round walls (`Rect.round`) that a fixed seed grows over one half.
  Every map is point symmetric to the centre; `state/game-maps.ts` is the
  registry and scales each layout from the base arena to the grid in use. All
  twelve are listed in order of difficulty but selectable from the start.
- **A bot in three difficulties** (`state/bot-controller.ts`) that only does
  what a human can do: aim the crosshair, fire the boost.
- **Two simulations behind one `Simulation` interface** (`state/simulation.ts`):
  the CPU one (`BacteriaSimulation`, injectable `random`) and the GPU one
  (`gl/gpu-simulation.ts`, WebGL2 shader passes, hash-based per-cell random,
  `MAX_GPU_COLONIES = 2`). The arena is a grid with one bacterium per cell. Its
  shape is the 16:9 **base arena** of 320 × 180 cells (`state/arena-size.ts`);
  a **simulation resolution** setting runs the same arena on 0.8 to 2 cells
  per base cell (256 × 144 up to 640 × 360), and balance lengths, carrying
  capacity, crosshair speed and the bot's distances scale with it
  (`levelBalance(level, scale)`, `scaleOf`), so every level plays alike on
  every grid. A separate **screen resolution** setting (640 to 1920 canvas
  pixels) decides how many pixels a cell is drawn with (`renderScale`): the
  grid and the screen are no longer the same thing.
- **A seeded random generator** exists: `seeded(seed)` in `state/geometry.ts`
  (mulberry32). The organic maps and the level music use it; the simulation,
  the pellets and the bot still default to `Math.random`.
- **The game loop runs inside the animation frame** (`state/frame-pacer.ts`):
  every display frame on a 60 Hz screen, every second one on a 120 Hz screen,
  so a frame is never shown twice or skipped. The simulation still receives
  the measured frame delta, not a fixed tick.
- **A WebGL2 painter** with slime or pixel looks, per-level `ArenaTheme`
  (floor, one of twelve patterns, walls, motes), round walls drawn as glossy
  blobs that melt into each other, glow for fights, meals and pushes, and a
  boost shimmer that runs as waves towards the colony's crosshair. The canvas
  no longer preserves its drawing buffer; `showLastFrame()` re-blits for
  snapshots.
- **Per-frame events** (`StepEvents`: captures, pellets eaten, crushed, gates
  closed and warned; `FrameEvents` adds boosts) and per-colony numbers
  (`ColonySummary`: count, captured, lost, total energy, centre).
- **Settings in local storage** (`settings.service.ts`): mode, difficulty,
  level, colours, look, simulation and screen resolution, FPS badge, sound,
  music and effects with a switch and a volume each, vibration. Nothing
  about a player's history is stored.
- **Sound and music synthesised** with the Web Audio API. Effects live in
  `sound/game-sound.service.ts`, written in the key of the level that plays
  (the start and end jingles, the pellet blips that climb a ladder for
  pellets eaten in a row); music and effects sit on buses of their own under
  a master and a compressor. Every level has its own tune
  (`sound/level-music.ts`): a key, a tempo, a chord progression, instruments
  and a seed, from which `composeLoop` writes bass, pads, melody and drums as
  plain data, played ahead of the audio clock by `sound/music-player.ts` on
  the `sound/step-scheduler.ts` clock. Fights push the music's intensity up,
  and the Heartbeat level's drums beat in time with its map
  (`HEART_PERIOD_SEC`). The menu has an ambient piece of its own
  (`sound/menu-music.ts`, `sound/menu-music-player.ts`): eight chords held
  by pads over a sub bass, with seeded bells and breaths of noise, composed
  afresh on every pass.
- **Vibration** (`haptics.service.ts`) through the Vibration API where the
  device has it: boosts, gates, the start and the end of a match, medallions.
- **Touch seats** for two humans at one phone, fullscreen on entry.

Everything below builds on these pieces rather than replacing them.

### What the latest changes mean for the plan

- **The seed is half done.** `seeded()` exists and already drives two kinds of
  generated content. Section 4 no longer needs its own PRNG module, only the
  helpers and threading the one generator through the match.
- **Organic levels pre-empt the cave recipe.** Round walls grown from a seed
  with spawn clearance (`SPAWN_CLEARANCE`, `nearSpawn`) are exactly the
  primitive the generator's cave recipe wanted. The wall mask of 4.2 becomes
  optional; the generator starts from the organic maps' building blocks.
- **Grid and screen are decoupled.** `renderScale` already draws N pixels per
  cell. The camera of section 6 is a pan and a variable scale on top of that,
  not a new rendering path. The resolution settings also gave the first real
  numbers on what the GPU simulation carries (4× the cells at _Ultra_).
- **Display-frame pacing is not a fixed tick.** The loop is now in step with
  the display, which removes doubled and skipped frames, but replays and
  lockstep still need the fixed tick of section 5.1. The pacer is the place
  it slots into.
- **Music is composed from data.** A generated level can get a generated
  tune, and the medallion jingle of 3.3 can be written in the level's key.
- **Replays have one more input.** The simulation resolution changes the
  grid, so it belongs in the replay header (5.2) and in the leaderboard key.

## 1. Motivation systems

The game is fun for a few matches, then there is no reason to come back. The
missing loop is: _play → get something → want the next thing_. All of this is
cosmetic or informational, nothing makes a colony stronger. A paying or
grinding player must never beat a skilled one.

### 1.1 Player profile and progress

A `ProgressService` next to `GameSettingsService`, stored under
`bacteria-game.progress` in local storage:

```ts
interface Progress {
  /** Best result per level and difficulty, see medallions below. */
  levels: Record<LevelId, Record<BotDifficulty, LevelRecord>>;
  /** Lifetime counters the achievements are checked against. */
  totals: LifetimeTotals;
  achievements: Record<AchievementId, string /* ISO date earned */>;
  unlocked: {
    colors: string[];
    looks: BacteriaLook[];
    patterns: ArenaPattern[];
  };
  xp: number;
  streak: { days: number; lastPlayed: string };
}
```

`LifetimeTotals` is just `StepEvents` summed over all matches plus a few
things the simulation already knows (matches played/won, boosts fired, longest
match, biggest colony, pellets eaten). The counters are collected by the
component's game loop from `FrameEvents` and the colony summaries; nothing new
has to come out of the simulation for a first version.

Later, an optional **cloud profile** through Firebase anonymous auth (the
pattern `rollapolla-analog` already uses in `ensure-signed-in.ts`) syncs the
same JSON to Firestore, so a phone and a desktop share progress and leaderboards
become possible. Local storage stays the source of truth offline.

### 1.2 A campaign ladder

Today all twelve levels are open from the first visit. Turn the level list
into a **ladder**: level
_n+1_ unlocks once level _n_ has been won at any difficulty. "Free play" keeps
every level open for people who already know the game (and for two-player
mode, where there is nothing to prove to the computer). The ladder gives the
"Next level" button on the result screen a purpose beyond "the next one in the
list".

### 1.3 Medallions per level

Every level and difficulty can hold one medallion: bronze, silver, gold, and a
rarer platinum for a flawless run. The conditions use what a match already
measures. See section 3 for the full design.

### 1.4 Achievements across levels

Lifetime goals, each one a short name, an icon and a one-line condition over
`LifetimeTotals` or a single match. A first set, all computable from today's
numbers:

| Achievement   | Condition                                         | Source                         |
| ------------- | ------------------------------------------------- | ------------------------------ |
| First Blood   | Win a match                                       | `matchEnded`, `winner`         |
| Glutton       | Eat 100 pellets in total                          | `pelletsEaten`                 |
| Gatekeeper    | 500 enemy bacteria crushed by gates and pistons   | `crushed` per colony (new)     |
| Pacifist      | Win without firing a boost                        | `FrameEvents.boosts`           |
| Comeback      | Win after being below 25 % of the enemy's size    | `ColonySummary.count` per step |
| Blitz         | Win in under 45 seconds                           | `timePassed`                   |
| Siege         | Win a match longer than 5 minutes                 | `timePassed`                   |
| Clean Sweep   | Lose fewer than 10 % of the bacteria you ever had | `lost`, peak `count`           |
| Converter     | Capture 10 000 bacteria lifetime                  | `captured`                     |
| Full Dish     | Reach the colony capacity                         | `colonyCapacity`               |
| Petri Scholar | Gold on every level of chapter 1                  | medallions                     |
| Hard Boiled   | Win every level on Hard                           | medallions                     |
| Couch War     | Play 10 two-player matches                        | `mode`                         |
| Explorer      | Win on 10 generated levels (section 4)            | generator                      |
| Daily Habit   | Play the daily level on 7 days in a row           | `streak`                       |

`crushed` is one number today; counting it per colony is a small change in
`gpu-simulation.ts`'s report and in `BacteriaSimulation`.

### 1.5 Ranks and XP

XP is the one number that goes up after every match, win or lose, so even a
lost match leaves something behind: a base for finishing, more for a win,
multiplied by difficulty, plus a bonus per medallion tier and achievement. XP
thresholds give ranks named after microbiology, from _Spore_ through _Coccus_,
_Bacillus_, _Spirillum_, _Biofilm_, _Colony_, _Culture_ to _Superbug_. The rank
shows on the main menu and the result screen. XP never unlocks gameplay.

### 1.6 Unlockable cosmetics

Things that exist already can become rewards:

- **Colony colours** (`COLONY_COLORS` has eight; orange and blue stay free, the
  rest unlock through medallions or achievements).
- **Looks** (`BACTERIA_LOOKS`: slime, pixels) and new ones from section 7.
- **Arena patterns** (`ArenaPattern`, twelve of them) usable as an override for
  any level in free play.
- **Crosshair shapes** and **boost sounds** - small, cheap variations.

A locked item shows greyed out with its condition ("Gold on Hourglass"), so the
player always knows what the next thing costs.

### 1.7 Daily level and streaks

One generated level per calendar day (seed = date, section 4), the same for
everyone, three attempts count towards a daily medallion. A streak counter
rewards coming back without punishing a missed day too hard (streaks pause
rather than reset after one missed day). Later: a daily leaderboard of match
time, capped to anonymous display names.

### 1.8 Two-player rivalry

Local two-player gets its own small loop: a **series** (best of 3 / 5) with a
running score on the boost pads, a **handicap** slider that shrinks the
stronger player's `startBacteriaRadius` or `divideChancePerSec` (uses the
per-colony balance the GPU shaders already have as uniform arrays), and
lifetime rivalry stats on the device ("Orange leads 14 : 9").

### 1.9 Feedback on the result screen

The result screen (`winner.component`) is where motivation is won or lost. It
should show, in this order: the medallion earned (animated in, with its
sound), the near miss ("Gold needs a win 12 s faster"), XP gained with the bar
to the next rank, new achievements and unlocks, then the buttons. The
`WsThanosDirective` already in the component can dust away the old medallion
when a better one replaces it.

### Where it hooks in

- New `state/progress.ts` (types, pure reducers over `FrameEvents` and
  `ColonySummary`, fully unit-testable) and `progress.service.ts` (storage).
- `winner.component` reads the match's `MatchRecord` and shows medallion, XP,
  unlocks.
- Menu: a "Profile" screen in the same panel as settings.
- `settings.service.ts` stays as it is; progress is a separate key so a reset
  of one leaves the other.

## 2. Levels

### 2.1 Chapters

Twelve levels on one list is a plateau, not a curve. Group them into chapters
of three to six, each with one new mechanic and one `ArenaTheme` family. The
first three chapters exist as levels already and only need the grouping:

1. **Petri** (tutorial): Petri Dish, Corridors, Hourglass - steering, boost,
   pellets, a first gate.
2. **Laboratory**: Inner Ring, Pillar Field, Twin Chambers, Serpentine,
   Pistons - cover, chambers and moving walls.
3. **Body**: Alveoli, Mycelium, Heartbeat, Villi - the organic levels with
   walls that grow, beat and sway. New here: membranes that let bacteria
   through one way, and more organic layouts from the generator (section 4).
4. **Reactor**: antibiotic zones, radiation that speeds division, neutral
   colonies.
5. **Outbreak**: boss levels with asymmetric balance, endless mode.

Each chapter already has a sound of its own: the level music (`LEVEL_MUSIC`)
can share a key and a drum style per chapter so the chapters are heard as
well as seen.

### 2.2 New mechanics the simulation can carry

Each one is a few lines in both simulations and a shader uniform or texture,
not a redesign:

- **Zones** (a per-cell field like the pellet texture): _antibiotic_ drains
  energy per second, _agar-rich_ raises `divideChancePerSec`, _ice_ halves
  movement, _heat_ raises aggression. Zones are rectangles or discs in the map
  definition, point symmetric like walls.
- **Pellet kinds**: the regular pellet, a _super pellet_ with triple energy
  that spawns once a minute in the centre, a _poison pellet_ that drains the
  colony eating it (a bait for the bot).
- **Neutral colonies**: a third colony with no crosshair and `aggression = 0`
  that sits in the middle and has to be eaten before the enemy does.
  `colonyCapacity` already divides the arena between _n_ colonies;
  `MAX_GPU_COLONIES` goes from 2 to 4 and the colony palette grows by a grey.
- **One-way membranes**: a wall that blocks movement in one direction. The
  claim pass compares the move direction with the membrane's normal.
- **Rotating walls and shrinking arenas**: `createDynamicWalls` already takes
  the match time; a bar that rotates around the centre or a border that closes
  in during the last minute are new map functions, no simulation change.
- **Fog**: the painter only draws cells within a radius of your own colony.
  Pure rendering, but it changes how a big map plays (section 6).

### 2.3 Objectives beyond annihilation

Make the match end pluggable:

```ts
interface WinCondition {
  id: 'annihilation' | 'timed' | 'hold-zone' | 'harvest' | 'survive';
  /** Decides each frame; null while the match goes on. */
  judge(summaries: readonly ColonySummary[], state: MatchClock): Verdict | null;
}
```

- **Timed**: biggest colony after 3 minutes wins. Makes a losing match end.
- **Hold the zone**: own the most cells inside a marked circle for 30 seconds
  in total. Cells per colony inside a rect is one more reduction in the report
  shader.
- **Harvest**: first to eat 20 pellets.
- **Survive**: live 90 seconds against a boss colony that starts five times
  your size and divides faster.

A level carries its `winConditionId`; the default stays annihilation so every
existing level is unchanged.

### 2.4 Boss levels

A boss is a bot with a per-colony balance override: more start radius, faster
division, higher `boostAttackFactor`, and a scripted controller on top of
`BotController` (a second boost, say, when it drops below half size). The
player's colony is normal. The result screen frames it as a chapter finale.

### 2.5 Level select as a map

Replace the level dropdown with a path of nodes, one per level, showing the
medallion earned at each difficulty, locked nodes dimmed, the daily level and
"Generate a level" as side branches. Angular Material cards in a scrolling
grid are enough; the themes' colours give each node its look.

### Where it hooks in

- `state/levels.ts` gets `chapterId`, `winConditionId`, `zones`, optional
  `bossBalance`.
- `state/win-conditions.ts` (new, pure, tested) replaces the "one colony left"
  check in `PlayerService.gameLoop`.
- `maps.ts` gets `Zone`, `Membrane` types alongside `Rect` and `DynamicWall`.
- Both simulations: one zone texture / `Uint8Array`, membranes in the claim
  pass, up to four colonies.
- `arena-theme.ts`: themes per chapter, not only per level.

## 3. Medallions

### 3.1 What a medallion measures

Four tiers per level and difficulty. The tiers are nested: gold implies silver
and bronze. Conditions are checked at match end against the `MatchRecord`:

| Tier     | Condition (all of them)                                                   |
| -------- | ------------------------------------------------------------------------- |
| Bronze   | Won the match                                                             |
| Silver   | Bronze, and the match took no longer than the level's `silverSec`         |
| Gold     | Silver with `goldSec`, and lost fewer than `goldLossShare` of peak colony |
| Platinum | Gold, no boost fired, never below 50 % of the enemy's size                |

`silverSec`, `goldSec` and `goldLossShare` are per level, in `levels.ts`,
tuned by playing: a first pass takes the median win time of the Normal bot
times 0.8 for silver and 0.55 for gold. Difficulty gives separate medallions,
so Hard gold is the real trophy and Easy gold is reachable for everyone.

The `MatchRecord` is small and pure:

```ts
interface MatchRecord {
  levelId: string;
  difficulty: BotDifficulty | null; // null in two-player mode
  won: boolean;
  durationSec: number;
  boostsFired: number;
  captured: number;
  lost: number;
  peakCount: number;
  /** Lowest ratio of own to enemy count during the match. */
  lowestSizeRatio: number;
  pelletsEaten: number;
  crushedEnemies: number;
}
```

`medallionFor(level, record): Tier | null` is one pure function with one spec
file. The component builds the record from the same data it already reads per
frame.

### 3.2 How they look

An SVG medallion drawn in code (no image assets, in the spirit of the
synthesised sound): a disc in the tier's metal, a ring in the level theme's
`border` colour, the level's pattern faintly embossed, and a small chip for the
difficulty. The same SVG at 24 px in the level map, at 160 px on the result
screen. Platinum gets a slow sheen animation; `prefers-reduced-motion` turns it
off.

### 3.3 Sound and ceremony

One short jingle per tier in `GameSoundService` (the end-of-match jingle
exists; the medallion adds two bars after it). The jingle is written in the
level's key: `LevelMusic` gives the root and the scale, so the medallion
sounds like the end of the level's tune rather than a sting on top of it. The
result screen holds the buttons back for a second while the medallion lands,
never longer.

### 3.4 Two-player mode

There is no bot to measure against, so medallions are off and the series
score (1.8) takes their place. The result screen says so once.

### Where it hooks in

- `state/medallions.ts`: `Tier`, `medallionFor`, per-level thresholds.
- `levels.ts`: `medal: { silverSec, goldSec, goldLossShare }` per level.
- `winner.component`: medallion panel; `progress.service.ts`: persistence.
- `ui`: a `MedallionComponent` (standalone, OnPush, SVG template).

## 4. Level generator

Today a classic map is a hand-written list of rects for one half of the
arena, which `pointSymmetric` completes, and an organic map grows round walls
over one half from a fixed seed (`organic-maps.ts`) before the same mirroring.
The generator is the organic maps with the seed set free: it produces a half
from any seed, checks that the result is playable and interesting, and hands
over a `Level` like any other. Everything is deterministic from the seed, so a
level can be shared as a URL (`?seed=7f3a-corridors`), used as the daily
level, and replayed.

Two rules the registry already enforces carry over. A generator lays its half
out on the **base arena** (320 × 180) and lets `game-maps.ts`'s `scalable`
grow it to the grid in use, so a seed means the same map on every simulation
resolution. And it keeps `SPAWN_CLEARANCE` around the two start spots, as
`nearSpawn` does for the organic maps.

### 4.1 Random source

`seeded(seed)` in `state/geometry.ts` (mulberry32) is already there and
already drives the organic maps and the music. It gains the helpers
`int(min, max)`, `pick(array)` and `chance(p)`. One match-scoped generator is
handed to everything that draws a random number during a match: the CPU
simulation's `random` parameter, `NutrientPellets`' spawner and the
`BotController`'s `random` (today each of them defaults to `Math.random` on
its own). So a seed decides the pellets and the bot's every move as well,
which section 5 relies on. (The GPU simulation hashes cell and step, so it is
deterministic on one machine already; see section 5 for why that is not
enough across machines.)

### 4.2 Grammar of a half

A map is built from a handful of **primitives** placed in the left half (or
the top half for a portrait arena), each with a parameter range:

| Primitive      | Parameters                                     | Gives the match        |
| -------------- | ---------------------------------------------- | ---------------------- |
| Bar            | position, length, thickness, vertical/horiz.   | a front line           |
| Gap in a bar   | position, width                                | a chokepoint           |
| Gate in a gap  | `GateTiming` (period, closed, offset)          | timing pressure        |
| Pillar cluster | centre, count, spacing                         | pockets, cover         |
| Chamber        | rect with one or two doors                     | a base to defend       |
| Slider         | rect, amplitude, period                        | a moving hazard        |
| Zone (2.2)     | kind, shape                                    | a reason to go there   |
| Blob lattice   | spacing, jitter, radius range (Alveoli)        | channels, no straights |
| Thread         | start edge, angle, taper, branching (Mycelium) | a maze nobody planned  |
| Beating blob   | centre, radius, period (Heartbeat)             | a rhythm to strike to  |
| Swaying finger | edge, length, wave period (Villi)              | a sweeping hazard      |
| Cave mask      | cellular automaton fill and smoothing passes   | organic, winding paths |

A **recipe** picks which primitives and how many; recipes are the generator's
"styles" (_corridor_, _fortress_, _field_, _cave_, _machine_) and map onto the
chapters of section 2. A difficulty knob (1 to 10) shifts every range: more
gates, shorter open periods, narrower gaps, more aggression in the generated
balance.

The four organic primitives are the functions the hand-made organic maps are
built from (`blob`, `movingBlob`, the lattice loop of Alveoli, `grow` of
Mycelium, the heart and the fingers), lifted out of their fixed seeds and
given parameter ranges. Round walls (`Rect.round`) are stamped as ellipses and
drawn as glossy blobs on WebGL and canvas already, so the _cave_ and _body_
recipes need no new wall kind. The cave mask stays an option for later:
`GameMap` could grow an optional `createWallMask(width, height): Uint8Array`
beside `createWalls`, since `stampRect` already turns rects into a grid for the
CPU simulation and the GPU uploads the same grid as a texture. It is only
worth it for layouts blobs cannot express.

### 4.3 Validation

A generated half is mirrored and then checked on the finished grid. A level
that fails any check is thrown away and the next seed derivative is tried
(`seed + attempt`), up to a bound, after which the generator falls back to a
hand-made map so the player never waits:

1. **Spawns are free**: a disc of `SPAWN_CLEARANCE` (20 base cells, the
   largest start radius plus air) around each spawn has no wall - the rule
   the organic maps apply while growing, checked again on the finished grid.
2. **Connected**: a flood fill from one spawn reaches the other with every
   gate open; and with every gate shut, each spawn still reaches at least one
   pellet position (nobody can be starved by a closed gate).
3. **Corridors are wide enough**: the distance transform of the free space
   (jump flooding on the grid, also useful for ambient occlusion in section 7) has no path narrower than 3 base cells between the spawns.
4. **Wall share** between 8 % and 35 % of the arena.
5. **Pellet room**: at least `nutrientCount` mirrored free positions outside
   the spawn discs.

### 4.4 Scoring for interest

Among valid candidates, prefer ones that make a match: compute the shortest
path between spawns divided by the straight distance (1.0 is boring, 1.8 is a
maze), the number of **chokepoints** (articulation cells on the free-space
graph, or simpler: cells where the distance transform has a local minimum
below 5 on the shortest path) and the free area near the centre. A recipe
states its target for each; the candidate closest to the targets wins. Five
candidates per request is plenty and runs well under 50 ms on the 320 × 180
base grid, which is the only grid the generator ever works on.

### 4.5 Naming and theming

A generated level gets a name from the seed, two words from recipe-specific
lists ("Rusty Hourglass", "Quiet Corridors"), a theme picked from the recipe's
family with the hue jittered by the seed, and a balance derived from the
difficulty knob within safe bounds taken from the hand-made levels (never
below the easiest, never above the hardest). It also gets its own **tune**:
`LevelMusic` is a handful of numbers (root, scale, tempo, progression,
instruments, seed), so the recipe picks a key and a drum style from its
chapter and the seed picks the progression and the melody. The level `id` is
`gen:<recipe>:<seed>:<difficulty>` so medallions and progress key on it like
on any level.

### 4.6 Modes built on the generator

- **Daily level**: seed from the UTC date, recipe rotates by weekday.
- **Endless**: a ladder of generated levels with difficulty climbing by one
  each win, lives lost on a defeat, best depth stored.
- **Mutate**: "play Hourglass again, but different" - the hand-made map's
  primitives re-rolled with a new seed and the same recipe.
- **Share**: the result screen offers a link to the exact level; two players
  on different devices compare times (the first form of multiplayer, below).

### Where it hooks in

- `state/geometry.ts`: the helpers on `seeded`; `state/level-generator/`
  (recipes, primitives, validation, scoring, naming, music; all pure, heavy
  unit tests with fixed seeds). The organic primitives move out of
  `organic-maps.ts` into it; the four hand-made organic maps become recipes
  with fixed seeds.
- `game-maps.ts`: `getMap` understands `gen:` ids by generating, and wraps the
  result in `scalable` like every other map.
- `levels.ts`: `getLevel` for `gen:` ids; `sound/level-music.ts`: `LEVEL_MUSIC`
  looked up by id falls back to the generated tune.
- URL handling in `bacteria-game.component` (query param → level).
- The e2e page object gets a deterministic seed so tests stay stable.

## 5. Multiplayer

The game already is a multiplayer game, at one screen. The question is which
kind of remote play to add first. The simulations decide a lot of this.

### 5.1 The determinism problem

Lockstep networking (both sides run the simulation, only inputs are sent)
needs both sides to compute the same frame from the same inputs. The CPU
simulation can do that: seeded random (4.1) and a **fixed tick** instead of
the measured frame delta. Both are built: `FramePacer` picks the display
frames the game steps on, a `TickClock` behind it turns the measured delta
into whole ticks, the crosshairs are carried ahead along their last step on
the frames in between, and every match has a seed that the simulation, its
pellets and the bot draw from. The tick runs at 60 Hz, not the 30 Hz first
planned: the balance is tuned per step, and at 30 Hz a match of the hard bot
against an idle colony took 1.5 to 2.5 times as long, which would have upset
the medallion limits. A 30 Hz tick needs a retuned balance first. The GPU
simulation cannot promise determinism across two devices either way:
floating point and driver differences in the shaders diverge within seconds. So:

- **Replays, ghosts and verified leaderboards** run on the CPU simulation at a
  fixed 60 Hz tick with a seed. It is the reference. A match that is to be
  recorded or ranked therefore runs on the CPU simulation on the player's
  device from its first tick: the two simulations do not produce the same
  sequence of states, so a GPU match replayed on the CPU could end at another
  time or with another winner than the one the player saw. The match setup
  says so where it matters ("ranked matches run on the reference engine"),
  and the match is pinned to the _Normal_ simulation resolution, which the
  CPU holds at 60 ticks a second and which keeps every ranked grid the same.
- **Live play** can keep the GPU simulation when one machine owns the truth:
  free play, big maps (section 6) and the host of an online match (5.3).

Fixed tick is worth doing on its own: it makes the bot and the balance
independent of the frame rate, and the painter interpolates crosshairs between
ticks so nothing looks choppier.

### 5.2 Step one: asynchronous multiplayer

The cheapest multiplayer that works tonight and needs no server logic:

- **Replays**: record `(tick, playerId, crosshair, boost)` for every human
  player of a match (a few KB) under a header with everything the match was
  derived from: seed, level id, mode, bot difficulty, simulation resolution,
  colours and the version of the balance table. The bot is not recorded; it is re-derived from the
  seed, which is why 4.1 seeds its decisions too. Play it back through the
  CPU simulation.
- **Ghost bot**: a `GhostController` that implements the same interface as
  `BotController` but feeds a recorded input stream. "Beat my run" links carry
  seed, level and compressed inputs in the URL hash or in a Firestore doc.
- **Daily leaderboard**: match time on the daily level, submitted with the
  replay. There is one board per bot difficulty, since a win against the Easy
  bot and one against the Hard bot are not the same feat; the difficulty
  comes from the replay header, and the verifier rejects a header whose
  level, mode, simulation resolution or balance version does not match the
  day's. A Firebase Cloud
  Function (`firebase-functions` is in the workspace) re-runs the replay with
  the CPU simulation and the seeded bot headless and only accepts the time
  it computes itself. The simulation and the bot are Angular-free, so they
  run in Node as they are.

### 5.3 Step two: live 1 v 1, host-authoritative

One browser is the host, runs the simulation (GPU allowed), and sends state to
the guest; the guest sends its crosshair and boost. Transport is WebRTC with
two data channels, since a channel's reliability is fixed when it is created:
an unordered, unreliable one for state (a lost frame is replaced by the next)
and an ordered, reliable one for inputs and the match start. Signalling goes
through Firestore: a room doc with a six-letter code, offer and answer written
as fields, ICE candidates as a subcollection, documents expire by TTL. Firebase anonymous auth keeps the rules simple. No TURN server
at first; symmetric NAT cases fall back to "could not connect, try the same
Wi-Fi".

**State on the wire**, 15 times a second: the owner grid as run-length encoded
bytes (the base arena is 320 × 180 = 57 600 cells, _Ultra_ four times that;
owners run in long runs and compress to a few KB), energy quantised to 4 bits
only for cells that changed since the last acknowledged packet, pellets,
dynamic walls and the summaries. The host's simulation resolution is part of
the match start, and the guest draws the grid it receives at its own screen
resolution - `renderScale` already separates the two. The guest's
painter draws the last state received and its own crosshair at once, so
steering feels local; the colony follows with the round-trip delay, which the
game tolerates because a colony is slow anyway.

Bots and two-player local mode do not change. A third "Online" mode joins
them in `GameMode`.

### 5.4 Step three: three and four colonies

Both simulations take _n_ colonies in principle (`colonyCapacity`,
`ColonySpawn[]`), the GPU one caps at `MAX_GPU_COLONIES = 2` because the
shaders pack colony data in `vec2`/`vec4` uniforms; lifting it to 4 is
mechanical. The map symmetry generalises from point symmetry (order 2) to
**rotational symmetry of order 4** on a square arena, or two mirror axes for a
rectangle; `pointSymmetric` becomes `symmetric(order)`. The touch layout has
two seats; four players are online or two local plus two online. **Teams**
(2 v 2) need an ally mask in the combat pass so allied bacteria exert no
pressure on each other, and a shared capacity per team.

### 5.5 Couch mode: phones as controllers

The seats concept makes this natural: the TV or laptop shows the arena, each
player scans a QR code and gets the joystick and boost pad of their seat in
their phone's browser, connected over the same WebRTC path as 5.3 with the big
screen as host. Four seats on one screen without crowding it.

### 5.6 Spectating and matchmaking

Later and optional: a public lobby list in Firestore, spectators as read-only
guests of the host's state stream, and a simple "find a match" queue. Keep
away until the daily leaderboard shows there are enough people online at once.

### Where it hooks in

- `state/frame-pacer.ts` grows the fixed tick accumulator (or a sibling
  `state/clock.ts` takes the pacer's output); `PlayerService.gameLoop` steps
  the simulation per tick, the component interpolates crosshairs.
- `state/replay.ts`: recording and `GhostController`.
- `net/` (new folder in the lib): `room.service.ts` (Firestore signalling),
  `peer.ts` (WebRTC), `state-codec.ts` (RLE and delta encoding, pure, tested
  by round trip), `online-mode.ts`.
- `apps/*-functions` or the existing Firebase functions project: a
  `verifyReplay` function.
- Angular Fire is already a workspace dependency; the lib gains it as a peer
  dependency only when the `net/` folder lands, lazy loaded with the online
  mode so the offline game pays nothing.

## 6. Bigger maps

### 6.1 Finer is not bigger

Since #2476 the grid is no longer the screen: the simulation runs on a grid
of its own (`arenaSize(simResolution)`) and the painter draws each cell with
`renderScale` pixels. But a finer grid is the **same arena** with smaller
bacteria - the levels are designed for the 320 × 180 base arena and
`scalable` grows every layout with the grid, so _Ultra_ does not give the
colonies more room, only more cells. A bigger map is a level whose layout is
designed for a bigger base (say 960 × 540, or 2048 × 1152 for "continent"
levels), and since such a map no longer fits the screen at a readable scale, it
needs a **camera**: a pan and a scale that changes during the match, on top
of the fixed `renderScale` of today.

### 6.2 Camera

- The painter gets a `view: { x, y, zoom }` and draws the part of the owner
  texture under it; at zoom below 1 the slime renderer switches to drawing the
  owner texture directly (a cheap level of detail), at zoom 1 and above it
  draws the full slime.
- Default camera follows the own crosshair with a soft spring; a pinch or the
  wheel zooms; double tap recentres on the colony. A **minimap** in a corner
  shows the whole owner grid downsampled (one `drawArrays` of the owner
  texture at 1 : 8).
- Local two-player on a big map means **split screen**: the painter renders
  twice into two viewports, one per seat. The seat layout in the SCSS already
  knows where each player sits.

### 6.3 Simulation cost

The GPU simulation is linear in cells per pass and runs up to `MAX_MOVE_STEPS`
(12) claim/apply pairs per frame. The resolution setting is the first
measurement: _Ultra_ runs 230 400 cells, four times the base, on the devices
that choose it. A 960 × 540 base map is nine times the base and, at _Normal_,
about twice _Ultra_. Measures, in order of payoff:

1. **Tick rate below frame rate**: `FramePacer` already halves the work on a
   120 Hz display; a 30 Hz simulation tick would halve it again on every
   display, once the balance is tuned to it (section 5.1).
2. **Activity tiles**: a 16 × 16 tile mask marking tiles that held a bacterium
   or a change last tick, produced by a mip-style reduction; passes run with a
   scissor or an instanced quad per active tile. Empty space costs nothing, so
   a big map with two colonies in corners runs like a small one.
3. **Fewer move steps per tick** on big maps, with a higher `crosshairSpeed`
   to compensate.
4. The CPU simulation gets a size cap and a "this level needs WebGL2" notice.

Carrying capacity and the bot's distances already scale with the grid
(`levelBalance(level, scale)`, `scaleOf` in the bot); a bigger base arena
needs the same scaling by _size_ on top of the one by _resolution_, so the two
factors must stay apart: one keeps the game the same, the other makes it
bigger.

### 6.4 What big maps are for

Size alone is not a feature. It pays off with:

- **Exploration and fog** (2.2): you do not see the enemy until a scout blob
  finds them. A tiny second crosshair, "the scout", that detaches a small blob
  would be a new control; or simply a wider influence radius on big maps.
- **Several fronts**: neutral colonies to eat for territory, pellet fields
  far from the spawns, chambers worth holding.
- **Four players** (5.4), who need the room.
- **Timed objectives** (2.3) so a big-map match ends in a reasonable time.

### Where it hooks in

- `Level.arena?: { width, height }` in base cells, beside `BASE_ARENA`;
  `arenaSize()` multiplies it by the resolution; `scalable` in `game-maps.ts`
  lays the map out on the level's base instead of the global one.
- `arena/`: camera in `ArenaPainter`, LOD in `colony-renderer.ts`, minimap,
  split screen.
- `gl/gpu-simulation.ts`: activity tiles, tick rate.
- `touch-controls.ts`: pan and zoom gestures without stealing the joystick.

## 7. Advanced graphics

The painter is already on WebGL2 with a slime look and glow effects. What is
left is mostly lighting, particles and post-processing, each one optional and
behind a quality setting so phones keep 60 fps.

### 7.1 Slime as lit material

- Compute a **signed distance field** of each colony from the owner texture
  (jump flooding, 8 to 10 passes at arena size, cached while nothing moved
  in a tile). From the field: a smooth normal, so the slime gets a
  highlight, a rim light in the colony colour and a soft shadow on the floor.
  The crosshairs act as light sources, so your own colony glows where you
  steer.
- **Refraction**: sample the floor pattern through the slime with an offset
  from the normal, so the agar bends under the colony.
- **Membrane wobble**: offset the edge by low-frequency noise driven by time
  and the movement glow, so a colony that moves ripples and a resting one
  breathes.
- **Energy as colour**: energy above `maxEnergy` is white today; make it a
  gradient and let starving bacteria (low energy at the front) go dull before
  they are eaten, so a front line reads at a glance.

### 7.2 Particles

A GPU particle pool in two ping-pong textures (position/velocity, colour/age),
one draw call:

- **Spores** burst from a capture in the losing colony's colour and drift
  with the theme's `current`.
- **Feeding motes** stream from a pellet into the colony eating it.
- **Boost shockwave**: a ring from the colony centre, plus a brief trail.
- **Gate dust** and a floor crack flash where a gate slams.

The `motes.ts` specks are the start of this and move into the pool.

### 7.3 Post-processing

A small chain on the final frame, each stage toggleable:

- **Bloom** (downsample twice, blur, add) for pellets, boosted colonies and
  the border.
- **Chromatic aberration** and a vignette pulse during a boost; **shake** on
  a gate slam (respects `prefers-reduced-motion`).
- **Colour grading** per theme by a tiny 16 × 16 × 16 LUT, so chapters have
  a mood beyond the floor colour.
- **Film grain** very low, only in the Reactor chapter.

### 7.4 Arena and walls

- Walls get a bevel from the wall distance field, ambient occlusion in the
  corners, and a highlight edge that follows the theme's `wallEdge`. The round
  walls are already drawn as glossy blobs that melt into each other; the
  rectangular ones catch up with that look.
- Dynamic walls cast a soft shadow that moves with them, and a gate's
  `warning` drives a red pulse along its edge.
- Floor patterns get a slow parallax layer (two patterns at different scales
  moving slightly apart) for depth, and animated caustics for the Petri
  chapter.
- Zones (2.2) are drawn as translucent fields with their own pattern.

### 7.5 Looks and accessibility

- New `BacteriaLook`s: _cells_ (visible individual rounded cells with nuclei),
  _ink_ (high-contrast monochrome with hatching, great for colour blindness),
  _neon_ (dark floor, glowing outlines).
- A **pattern overlay per colony** (dots for one, stripes for the other) as a
  setting, so two colonies are distinguishable without colour.
- Palette presets checked for deuteranopia and protanopia distance; the
  current `COLONY_COLORS` red/green pair would be flagged as a bad pair in the
  colour picker.

### 7.6 Quality presets

The settings already hold two of the three knobs: the simulation resolution
(how many cells) and the screen resolution (how many pixels). The third is an
**effects** preset, `quality: 'auto' | 'low' | 'medium' | 'high'`, next to
them. _Auto_ measures the median frame time over the first three seconds of a
match and steps down until it stays under 14 ms, lowering the effects first
and the screen resolution second, never the simulation resolution (that
changes the match). Low is today's painter; medium adds lighting and
particles; high adds post-processing and refraction. The FPS badge already
exists for checking. The post-processing chain has to live with the canvas
not preserving its drawing buffer (#2477): it renders into its own
framebuffer and `showLastFrame()` re-blits from that.

### Where it hooks in

- `arena/gl/`: `distance-field.ts` (jump flooding), `particles.ts`,
  `post-process.ts`, new fragments in `shaders.ts`.
- `arena-theme.ts`: `lut`, `grain`, `caustics` per theme.
- `settings.service.ts`: `quality`, `colonyPattern`.
- The CPU painter (`canvas-arena-painter.ts`) stays as the fallback and gets
  none of this.

## 8. Phases

Ordered by payoff per effort and by what each one needs from the one before.

| Phase | Scope                                                                                                                       | Needs                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1     | Progress profile, campaign ladder, medallions, achievements, XP, result-screen ceremony, unlocks                            | nothing new in the sim   |
| 2     | Fixed tick behind the frame pacer, one seed through simulation, pellets and bot, replays and ghost bot, share links         | phase 1 for records      |
| 3     | Level generator with recipes (starting from the organic maps), daily level, endless mode, level map screen, generated tunes | seeded random (phase 2)  |
| 4     | Win conditions, zones, neutral colonies, four GPU colonies, boss levels, chapters                                           | phase 3 for cave recipe  |
| 5     | Camera, minimap, big arenas, activity tiles, split screen, fog                                                              | phase 4's colonies, tick |
| 6     | Online 1 v 1 host-authoritative, daily leaderboard with verified replays, couch controllers                                 | phases 2 and 5           |
| 7     | Lighting, particles, post-processing, effects preset beside the resolution settings, new looks                              | independent, any time    |

Phase 1 is the one that changes whether people come back and costs the least. It
has started: medallions per level and difficulty (section 3, without the
level map and the medallion's level theme) are built, with the result-screen
panel, the level list and the bells, the campaign ladder (1.2) with free
play, the menu screens with the level choice and the profile, lifetime
totals with thirteen achievements (1.4), XP with eight ranks (1.5) told on
a result screen in the order of 1.9, and colony colours and arenas to unlock
(1.6, without crosshair shapes and boost sounds; an earned arena dresses
every level, not only in free play), and the two-player rivalry (1.8: series,
head start, wins per colour); the lib's README describes them. Phase 1 is
done, apart from the cloud profile of 1.1, which waits for a Firebase backend
of the GameStorage port, and the daily level of 1.7, which needs the level
generator of phase 3.
Glutton waits for pellets counted per colony, which the GPU report does not
give yet - Flawless (a platinum medallion) takes its place - and Petri
Scholar asks gold on levels 1 to 4 until chapters exist. The medallion limits are a first
pass from bot matches and want tuning by play. Everything is stored through
the `GameStorage` port, so the cloud profile of 1.1 is a backend to provide,
not a change to the services.
Phase 2 has started with its groundwork: the fixed 60 Hz tick behind the
frame pacer and one seed per match through the simulation, the pellets and
the bot (5.1), and replays (5.2): an Angular-free `MatchEngine` records the
humans' crosshairs and boosts, and `playReplay` plays a match out again on
the CPU. The ghost is in as well: after a match against the computer, the
player fights their own run, played by the computer's colony through a
`GhostController` and turned to the other side. Share links carry a run in
the hash of the address (packed, a few KB for a minute of play), and opening
one offers the ghost as a challenge. Phase 2 is done, apart from the daily
leaderboard of 5.2, which waits for the daily level of phase 3 and a
Firebase backend.
Phase 3 has started with the generator itself: four recipes (field,
corridor, fortress, cave) lay out a half from a seed, validation keeps only
playable layouts (free spawns, a way at least three cells wide, 3 to 35 %
walls) and the closest of five to the recipe's detour wins. `gen:` ids work
as levels, maps, looks and tunes. Gates, sliders and zones are not in the
recipes yet; the daily level, endless mode and the level map build on it.
The daily level (1.7) is in: one generated level a day for everyone,
three attempts towards its medallion, a streak that one missed day only
pauses. Endless mode (4.6) as well: generated levels one after the other,
each win a step harder, three lives, the best depth kept. The level choice
is a map (2.5): the ladder in the chapters of 2.1, cards in their arena's
colours, and the daily level, the endless run and "Generate a level" as the
side branches. Generated levels play tunes of their own (4.5): the style
sets the key's mood, the groove and the instruments, the seed the chords
and the melody, the difficulty the tempo. With that, phase 3 is done; the
mutate mode of 4.6, gates and sliders in the recipes, and levels shared by
link are what is left of section 4. Two follow-ups
from the generator's review: one resolver for level ids (the hand-made
tables and the generator are asked in `getLevel`, `getMap`, `arenaTheme` and
`levelMusic` alike), and the hand-made organic maps as recipes with fixed
seeds - they share `hexLattice` and `growThread` with the generator already,
but moving walls are no part of a recipe yet.
Phase 4 has started with pluggable win conditions (2.3): a level carries a
`win` rule, annihilation unless it says otherwise, and `timed` ends a match
after a limit with the bigger colony as the winner. The countdown shows on
the match clock, and the Reactor chapter opens with the first timed level,
Half-Life. Zones (2.2) followed: antibiotic, agar, ice and heat as rects
or discs in the map, in both simulations - on the GPU in the wall mask's
spare bits - and drawn by both painters; Containment lays out all four.
Hold the zone followed on them: a white zone to hold, held each tick by
the colony with the most bacteria on it, counted in both simulations; the
bot goes for it, and Control Room is the first such level. Boss levels
(2.4) and survive came next: per-colony traits for division, attack and
boost cooldown in both simulations, a bigger start, a boss bot that boosts
whenever it can once behind, Meltdown as the Reactor finale (survive) and
Patient Zero opening Outbreak. Neutral colonies (Quarantine) and harvest
(Feeding Ground) followed: a pellet goes to the colony that took the most
of it, counted on the GPU in the pellet row's two spare channels, 16 bits
per colony. The bot heads for the zone to hold but does not avoid the
other zones yet, and a next counted rule needs room in the GPU report:
the report rows are full.
Phase 7 can be sprinkled in between the others; each of its items is a
self-contained PR. Of the groundwork the phases assumed, three pieces have
landed since the first version of this document: the seeded generator (for
phase 3), the decoupling of grid and screen (for phase 5) and the resolution
settings (for phase 7).

### Decisions worth an ADR when their phase starts

- The CPU simulation at a fixed 60 Hz tick with a seed, on the _Normal_
  simulation resolution, is the **reference simulation** for replays and
  verification; the GPU one is for playing.
- Progress is stored **locally first**, cloud sync is opt-in and anonymous.
- Online play is **host-authoritative over WebRTC with Firestore signalling**,
  not lockstep, until four-player lockstep is actually wanted.
- Generated level ids (`gen:<recipe>:<seed>:<difficulty>`) are **stable
  forever**: a change to the generator that would alter the output of an old
  seed gets a new recipe name instead.

### Conventions

- Commit scope stays `feat-lazy-bacteria-game`; the remote and the shell only
  change when a route or the manifest does.
- Every pure module (`progress`, `medallions`, `win-conditions`,
  `level-generator`, `state-codec`, `replay`) gets a spec with fixed seeds.
- The `README.md` of the lib describes what is built; this document describes
  what might be. Move a section's content into the README when it ships.
