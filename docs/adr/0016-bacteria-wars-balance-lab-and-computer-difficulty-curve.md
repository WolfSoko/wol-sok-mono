# 16. Bacteria Wars: a balance lab, a computer that grows harder level by level, and evolution for the computer

- Status: accepted
- Date: 2026-10-24
- Builds on: ADR 0013 (evolution), ADR 0011/0012 (replays, statistics)
- Scope: `libs/features/lazy/bacteria-game`, `tools/bacteria-game/`,
  `.github/workflows/`, later `apps/bacteria-wars-functions` and the admin lib

## Context

The owner asked how to measure and watch the game's balance continually,
and for a computer opponent that grows harder with every level and evolves
like the player does.

Until now balance was tuned by hand: the medallion limits came from one-off
bot matches (the comment above `BOSS_BALANCE` in `levels.ts`), and the
agents of ADR 0013 calibrated weapons and the big levels with throwaway
scripts. Nothing stops a later change from breaking a level silently.
The computer plays one of three fixed profiles (`bot-controller.ts`,
`PROFILES`) on every level, and it is always plain except for the armed
bosses.

Known findings this ADR should make visible: Leviathan on easy stalls at
the colony cap; Root Network and Leviathan carry estimated medal limits;
the cryo pulse is weak in the computer's hands.

## Decision

### 1. The balance lab (measuring before players see it)

- A headless runner in `tools/bacteria-game/balance/` plays bot-vs-bot
  matches on the CPU `MatchEngine` through the Angular-free engine entry
  (`src/engine.ts`) and writes `balance-report.json`.
- **The matrix**: level × difficulty × the player stand-in's loadout × seeds.
  Loadouts: plain, the expected loadout at that point of the ladder (see 3),
  each gene maxed, each weapon alone, everything.
- **The player stand-in** is a bot with its own profile, `reference`, that
  plays about like a human of the level's stage: between normal and hard.
  It carries the loadout a typical player owns there (see 3).
- **Metrics per cell**: the stand-in's win rate, the median time to a win
  and to a loss, the lowest size ratio (closeness), the share of bacteria
  lost, how often a match stalls at the colony cap (both colonies within
  2 % of their cap for 30 s), the computer's weapon shots and what each
  shot changed in the share of all bacteria, and each gene's and weapon's
  gain in that share against the same seed plain.
- **Checks as specs** (fast, few seeds): every level is winnable by the
  stand-in with the expected loadout within its limit; no level stalls;
  silver and gold sit inside the measured win times; no weapon gains more
  than 15 points of share or loses any; the difficulty curve (see 2) rises
  within each chapter.
- **A baseline** `balance-report.json` is committed. An Nx target
  `bacteria-game-balance` (or a target on the lib) runs the short matrix
  (the first 90 s, a few seeds, the levels a change touches) and compares it
  against the baseline with tolerances; a nightly GitHub workflow runs the
  full matrix and opens or updates an issue labelled `balance` on drift.
  A change of `BALANCE_VERSION` re-baselines in the same PR.
- **Cost**: about 3.8 ms a tick on the CPU (ADR 0012), about 40 s for a full
  3-minute match. The full matrix runs nightly on GitHub Actions, never on
  every Nx Cloud run.

### 2. A target difficulty curve for the campaign

- The ladder follows a target win rate of the stand-in against the computer
  on **normal**: about **85 %** on level 1 falling to about **45 %** on the
  finale, rising monotonically within a chapter, with a small dip after each
  boss as a breather. **Easy** sits about 10 points above it, **hard** about
  15 points below.
- Two levers reach the curve, calibrated by the lab and kept in a table in
  the code (no runtime adaptation):
  - **Skill**: every value of the computer's profile (`reactionSec`,
    `aimNoise`, `attackRatio`, `boostRange`, `weaponPatience`) is
    interpolated along the ladder inside its difficulty's band, so the
    difficulty picker still matters.
  - **Strength**: the computer evolves (see 3).
- **Fixed per level, never adaptive to the player's DNA**: copying the
  player's evolution would cancel every purchase, the opposite of a reason
  to evolve. A fixed curve keeps medallion times comparable between players.

### 3. Evolution for the computer

- `computerLoadout(levelId, difficulty)` is deterministic: a DNA budget per
  level, spent by the chapter's character:
  - Petri: nothing on levels 1-3.
  - Laboratory: mitosis and metabolism.
  - Body: mitosis and flagella - many and fast.
  - Reactor: toxins and membrane.
  - Outbreak and Expanse: weapons first.
  - Bosses: the most of everything, plus their weapon (ADR 0013).
- The budget follows the **expected player DNA** at that level - the XP of
  the wins, medallions and achievements a typical player holds by then,
  `dnaEarned` of it - times a factor per difficulty (easy about 0.5, normal
  about 1, hard about 1.5), tuned by the lab to the curve.
- It plays where the player's evolution plays (ADR 0013): the ladder and
  generated levels against the computer (a generated level's budget follows
  its heat). **Daily and endless keep a plain computer** - the owner decided
  the ranked setup (ADR 0012: normal bots, no head start); arming them is a
  separate decision. Ghost races have no computer.
- The computer's weapon starts the match charging, as the bosses' does.
- **Shown before the match**: the briefing and the level preview name the
  enemy's genes and weapon ("The enemy evolved: Venom Glands 3, Cryo
  Pulse"), in English and German.
- **Determinism**: the computer's loadout goes into the replay header like
  the player's (ADR 0013's version 3 when it changes the match), so old
  replays play as they were and `BALANCE_VERSION` does not move. Medallions
  already held stay; new ones get harder.

### As built (sections 1-3)

- **The ladder's computer is a match of its own.** Its skill along the
  curve changes what the computer does, plain loadouts or not, so a replay
  has to say it played against it. The menus put `ladder: LADDER_VERSION`
  into the plan next to the loadouts (ladder and generated levels against
  the computer, never a ghost race), and such a match is replay **version
  4**: version 3 plus `ladder`. A version 3 replay keeps playing the
  difficulty's fixed profile, a client or server that knows only version 3
  refuses version 4, and `playReplay` refuses another `ladder` version, as
  it refuses another `BALANCE_VERSION`. A change to the skill table, the
  bands or a rule only the ladder's profiles switch on raises
  `LADDER_VERSION` (`golden-match.spec.ts` holds a fingerprint of a ladder
  match); plain matches and `BALANCE_VERSION` stay. So does a change to
  what the computer buys - its budget, a character, the gene or weapon
  costs it spends along (`computer-opponent.spec.ts` pins every ladder
  level's loadouts): version 2 came with the genes' exponential costs
  (ADR 0013).
- **Level fixes go through the computer.** Every level setting is part of
  a plain match, so a stall is fixed by what only the ladder's computer
  does: a boss attacks once its colony sits at its cap (`attacksAtCap`)
  instead of waiting for odds that never come - the leviathan on easy sat
  at its cap until the clock ran out - and the computer pushes into the
  enemies its cryo pulse froze (`pushesAfterCryo`): fired the old way, a
  pulse gained the computer nothing per shot. Any other computer keeps
  waiting at its cap: the lab found two colonies that charge each other at
  their cap stall just as surely, since a capped colony refills its losses
  faster than a front kills.
- **The stand-in** (`REFERENCE_PROFILE`) plays like the hard computer but
  slower and less exact, attacks at its cap too, and carries what a typical
  player owns (`expected-player.ts`: the ladder in order on normal, losing
  as often as the target curve says, a medallion between bronze and silver
  per level, an achievement every third level; the first gene, then a toxin
  bomb, then a level of each gene, a phage strike, and round the genes).
- **The matrix** (`state/balance/report.ts`) plays the expected loadout on
  every level and difficulty (most seeds on normal) and the gains - plain,
  each gene maxed, each weapon alone, everything - on one level per chapter
  over the first two minutes. A base-size level plays on the online grid,
  on which a recorded match runs on the CPU (ADR 0011) - the grid the
  medallion limits are measured on; a big map, which the game plays on the
  GPU, on the coarse grid, which plays alike (the bots and the levels think
  in base cells) at about 60 % of the cost. The curve is
  measured by the stand-in's score: wins, and half of the matches still
  undecided at the horizon (a stalled match won by annihilation alone
  counts as undecided from the moment it stalls).
- **The first calibration** (three rounds, baseline committed with
  `LADDER_VERSION` 1) holds 26 of the 72 cells within 15 points of their
  target. Two things keep it coarse: stalemates - two capped colonies on an
  annihilation level, where neither bot breaks through, pin most early
  levels near a score of a half - and the seeds the matrix can afford (six
  on normal, three on easy and hard, one or two on a big map). Where the
  skill band cannot reach the target, a per-level `STRENGTH` scales the
  computer's budget (the Body chapter's computer gets more, the Reactor's
  and the bosses' less), and the hard budget factor is 1.25, not 1.5: with
  1.5 the stand-in never won on hard from the reactor on. The baseline's
  remaining failed checks are listed in `balance-report.spec.ts`, so a new
  baseline cannot add one unnoticed; the nightly run and
  `tools/bacteria-game/balance/calibrate.ts` take the curve further.
- **Medallion limits** of the base-size levels the stand-in won four times
  or more on normal now come from the lab (online grid): silver at the
  median win, gold at two thirds of it. Root Network and the leviathan keep
  their silver and gold - a stand-in with everything bred wiped them out in
  87-147 s and 22-147 s, on the coarse grid - with gold's losses at what it
  lost (0.5 and 1 instead of 2.4 and 4).

### 4. Watching real matches (with ADR 0011/0012)

- When `acceptReplay` (ADR 0011) stores a replay, it also adds to aggregated
  counters per level and difficulty - `levelStats/{levelId}_{difficulty}`:
  attempts, wins, losses, quits (a match declared but not finished),
  duration buckets, medallions, and, for evolved matches, plain versus
  evolved wins and the weapons carried. No uid, increments only, from what the replay
  claims. In place (`level-stats.ts` in the functions): counted in
  `levelStats/{level}_{difficulty}_b{balance}_l{ladder}` once the replay
  is stored, never in its way - a counter that fails costs a match of
  statistics, not the submission. A generated level counts by its recipe
  and generator difficulty (`gen-cave-6`, `daily-cave-6`,
  `endless-cave-6`), since each roll is a level of its own; the balance
  table and the ladder's version keep a changed computer apart. Evolved
  means the player's own loadout, not the ladder's computer's.
  Medallions come from the server's re-run, never the client: a verified
  re-run of a match against the computer adds `rerun` and its best tier
  (`medals.{tier}`), counted by the check that applied the verdict, so
  once, and kept on the replay (`medal`). Only re-run matches carry
  them, and they are chosen - endless re-runs play wins only, the daily
  boards their leaders' best attempts - so `medals / rerun` tells how
  the best runs go, not how hard a level is for everyone. Still
  open: quits (from declared attempts never reported - a local match the
  player leaves sends no replay).
- The admin area (ADR 0012) gets a **Balance** view of those counters next to
  the lab's latest report: win rate per level against the target curve,
  attempts until the first win, where players stop on the ladder, gene and
  weapon pick rates.
- Thresholds flag a level (win rate on normal outside 35-75 %, the quit rate
  doubling week on week, a weapon carried in more than half of all matches);
  the nightly workflow reports them with the lab's drift.
- The privacy policy names the counters before they ship.

## Consequences

- Every change to the balance, the simulations or the levels shows its
  effect in a PR, and the campaign keeps a difficulty curve by test.
- The campaign gets harder towards the end for everyone, including players
  who evolve; evolving keeps paying off because the computer's budget does
  not follow the player's.
- Live balance data needs the functions of ADR 0011; until they ship, the lab
  is the only measure.
