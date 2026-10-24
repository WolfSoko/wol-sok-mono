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

`planMatch` cannot tell the daily level from another generated one, so a
server that re-simulates daily or endless runs (ADR 0012) must reject a
replay that carries loadouts - in practice every replay that is not in the
plain format (`PLAIN_REPLAY_VERSION`, see below).

### Determinism

The engine knows a `Loadout` per seat and nothing about purchases. Firing a
weapon is a human input on the input grid, recorded like a boost
(`ReplayInputs.weapons`); the replay header keeps the seats' loadouts
(absent = plain), so old replays play as before and new ones play again the
same. A plain match must play bit for bit as before, so `BALANCE_VERSION`
stays unless a plain match changes.

A replay with evolution in it - loadouts that change the match (a gene, a
weapon, or a boss they arm) or a weapon fired - takes `REPLAY_VERSION` 2. A
client from before would drop the loadouts and the shots and play another
match; with the new version it refuses the replay instead. A plain replay
keeps version 1 (`PLAIN_REPLAY_VERSION`) and leaves out loadouts that change
nothing, so it reads as before in older clients and links. A replay in
version 1 that carries loadouts or weapons fired is invalid. Online plays plain, so `NET_VERSION`
does not move for this.

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
