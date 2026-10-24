# 13. Bacteria Wars: evolution (genes and weapons), level previews and more big levels

- Status: accepted
- Date: 2026-10-23
- Scope: `libs/features/lazy/bacteria-game`

## Context

The owner asked for three things:

1. Every level needs a preview image.
2. More big levels (maps bigger than the screen, like `expanse`).
3. A motivating way to improve the colony between matches, with amazing
   effects, and more special weapons or perks.

Until now the game held to one rule: progress never makes a colony
stronger. Ranks are only shown, colours and arenas are cosmetic. The third
request breaks that rule on purpose, so this ADR says where it does and
where it does not.

## Decision

### Evolution: DNA, genes and weapons

The shared model is `state/evolution.ts`.

- **DNA is derived, not stored**: `dnaEarned(xpOf(progress))`, one strand
  per 50 XP. It merges as cleanly as XP does and can never be lost.
- **Genes** (`mitosis`, `toxins`, `membrane`, `flagella`, `metabolism`),
  five levels each, multiply a colony trait per level. They extend the
  boss's `ColonyTraits` with `toughnessFactor`, `speedFactor` and
  `weaponCooldownFactor`; absent traits are 1.
- **Weapons** (`toxin-bomb`, `cryo-pulse`, `phage-strike`, `agar-bloom`,
  `biofilm-shield`) are bought with DNA. One is carried into a match and
  fired at the crosshair with a second button next to the boost. Their
  effects are circles with an owner, which both simulations evaluate per
  cell (the GPU from uniforms), rather than zones stamped into the grid.
- **What is stored** is only what the player chose: the levels bought, the
  weapons owned and the weapon equipped, under its own storage key with a
  parser that keeps what it can read. Bought levels merge by taking the
  higher level per gene, so a purchase on one device is never undone by
  another. The weapon equipped is the latest pick: each pick (putting it
  down included) counts up `equipCount`, the higher count wins a merge, and
  two devices that picked as often agree on the weapon later in the menus'
  order. A value stored before the count reads as 0. DNA available =
  earned − cost of what is held; a merge that overspends shows 0 and blocks
  buying, it never takes anything back. A free reset refunds everything (an
  epoch counter wins over the max-merge).

### Where evolution plays

Only in matches against the computer on the campaign's ladder and on
generated levels. The daily level and endless runs feed the verified
leaderboards (ADR 0012), so they stay plain, as do couch matches and online
matches. The menus pass loadouts only for those matches, always for both
seats (the computer's plain), and `planMatch` ignores them anywhere else.

The loadout is read as the match starts, and a match starts at once. The
new game's Start waits instead, disabled until the storage has told what
the player evolved (`EvolutionService.settled`), so a slow first answer at
the start of the app or right after a sign-in does not send an evolved
player into a plain match. Offline with nothing cached the storage may
never answer: after `EVOLUTION_WAIT_MS` (3 s) Start opens and the match
plays what is known. A start that was held behind a pressed Start button
read as a dead button, so the wait is shown, not hidden. Once it runs, the
match never waits on storage and keeps its loadouts.

A ghost race replays inputs recorded with whatever the run was played
with, so its ghost plays with the loadout its replay header recorded for
the seat the run was played from (`header.loadouts?.[0]`, plain when
absent) - else "race your last run" would be another match and its weapon
shots would go nowhere. The human at the screen follows the same rule as
against the computer: their own loadout on the ladder and on generated
levels, which the menus pass for a ghost race as well. No boss joins a
ghost race, armed or not.

The bosses carry a weapon of their own (Meltdown a toxin bomb, Patient Zero
a phage strike), but only in a match whose plan has loadouts. Arming them
everywhere would change how every recorded boss match plays and force a new
`BALANCE_VERSION`.
A weapon the computer carries starts the match charging (its full
cooldown), so its first shot does not land on the human's spawn a second
in; a human's weapon is ready from the start.

`planMatch` cannot tell the daily level from another generated one, so the
replay parser does it for the leaderboards (ADR 0012): a replay with
evolution in it (version 3, see below) is refused when it declares a ranked
attempt - daily and endless runs are started as one - or plays the daily
level of any day (`isDailyLevelId`, which tells it from the id alone).

### Determinism

The engine knows a `Loadout` per seat and nothing about purchases. Firing a
weapon is a human input on the input grid, recorded like a boost
(`ReplayInputs.weapons`); the replay header keeps the seats' loadouts
(absent = plain), so old replays play as before and new ones play again the
same. A plain match must play bit for bit as before, so `BALANCE_VERSION`
stays unless a plain match changes.

#### Replay versions

ADR 0011 gave version 2 to the strict format the server stores and checks;
version 1 stays the ghost links' format, still written for a match the GPU
ran. Both are plain, and both parsers before evolution build the header
field by field and the inputs kind by kind, so they would silently drop
`loadouts` and the weapons fired (packed under `w`) and play another match.
An evolved replay therefore takes a version of its own:

- **Version 3** (`EVOLVED_REPLAY_VERSION`) is version 2's header - seats,
  outcome, checksum, attempt - plus the seats' `loadouts`, and version 2's
  inputs plus `weapons`. A replay takes it when evolution plays a part:
  loadouts that change the match (a gene, a weapon, or a boss they arm) or
  a weapon fired. Every client and server from before refuses it by its
  version rather than replaying an evolved run as plain.
- It is written on either simulation. A match the GPU ran gets no version 1
  ghost link when it is evolved - that link would lose the loadouts in every
  client before this one - but a version 3 replay with `simulation: 'gpu'`,
  good for a ghost race only, as version 1 is: `playReplay` and the stored
  parse (`stored: true`) take version 3 from the CPU only.
- A plain match writes exactly what ADR 0011 writes: version 2 from the CPU,
  version 1 from the GPU, without loadouts, which change nothing in it, and
  without a list of weapons in the packed form. `golden-replay.json` and
  every plain link stay as they were.
- Versions 1 and 2 that carry loadouts or weapons fired are invalid.
- The stored parse takes version 3 for a match against the computer on the
  ladder or a generated level, which the server keeps as kind `computer`
  and reruns with its loadouts; never with an attempt or on the daily
  level, as above.

Online plays plain, so `NET_VERSION` does not move for this.

### Level previews

Every level card shows a preview of its map, drawn at runtime from the same
map data the simulation uses (walls, zones, spawn spots, neutral colonies)
in the level's arena colours, and cached per level id. Generated levels get
one for free, and no binary assets go into the repo.

### More big levels

New levels on maps bigger than the base arena join the Expanse chapter.
Like `expanse` they cannot be played online (`playableOnline`).

## Consequences

- Medallion times on the ladder get easier with genes. Medallions stay
  per difficulty; the hard computer stays the measure of skill.
- XP now does unlock gameplay, through DNA; `ranks.ts` says so.
- Every new weapon is a change to both simulations, the replay inputs and
  the painters.
