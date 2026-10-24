# 14. Bacteria Wars: a balance lab, a computer that grows harder level by level, and evolution for the computer

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

### 4. Watching real matches (with ADR 0011/0012)

- When `acceptReplay` (ADR 0011) stores a replay, it also adds to aggregated
  counters per level and difficulty - `levelStats/{levelId}_{difficulty}`:
  attempts, wins, losses, quits (a match declared but not finished),
  duration buckets, medallions, and, for evolved matches, plain versus
  evolved wins and the weapons carried. No uid, increments only.
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
