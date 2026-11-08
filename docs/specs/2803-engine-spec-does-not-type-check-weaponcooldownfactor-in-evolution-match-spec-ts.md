# Spec #2803: Engine spec does not type-check: weaponCooldownFactor in evolution-match.spec.ts

Found while type-checking [#2781](https://github.com/WolfSoko/wol-sok-mono/issues/2781).
Same root cause as [#2798](https://github.com/WolfSoko/wol-sok-mono/issues/2798):
spec tsconfigs are type-checked only where a project has a `typecheck-specs`
target.

## Goal

`npx tsc -p libs/features/bacteria-engine/tsconfig.spec.json --noEmit`
passes, the boss test pins what it was meant to pin, and CI keeps the
engine's specs type-checked from now on.

Today:

- `evolution-match.spec.ts:792` (test "starts its weapon charging, so its
  first shot comes later", meltdown boss) computes the expected cooldown as
  `weaponOf('toxin-bomb').cooldownSec * (getLevel('meltdown').boss?.traits?.weaponCooldownFactor ?? 1)`.
- A boss's `traits` are `ColonyTraits` (`divideFactor`, `attackFactor`,
  `cooldownFactor`); `weaponCooldownFactor` lives only on `EvolvedTraits`.
  The read is always `undefined`, so the factor is always 1.
- The engine agrees: `MatchEngine.weaponCooldown` multiplies by
  `traits.weaponCooldownFactor ?? 1`, and the boss's `cooldownFactor`
  (0.8 for meltdown) scales only the boost (`fireBoost`). So the test
  passes for the right value, but by accident and with a type error.
- `feat-shared-bacteria-engine` has no `typecheck-specs` target, so CI never
  sees the error. This is the only error `tsc` reports for that tsconfig.

## Non-goals

- No change to the engine, the levels or what a boss does in a match.
- No decision on `weaponCooldownFactor` itself: no gene sets it in
  production (Metabolism scales the boost's cooldown), only a spec does.
  Raised to the manager as a follow-up.
- The other projects without `typecheck-specs` stay
  [#2798](https://github.com/WolfSoko/wol-sok-mono/issues/2798)'s.

## Decisions

- **The expected cooldown is the weapon's plain `cooldownSec`**, with a
  comment that a boss's `cooldownFactor` speeds up its boost, not its
  weapon. That is what the engine does and what the test means ("charging
  from the start").
- **Pin the boost/weapon split explicitly**: assert that meltdown's boss has
  a `cooldownFactor` other than 1, so the test would notice if the boss's
  boost factor ever started to scale its weapon (the expected value would
  then be off by that factor).
- **Add `"typecheck-specs": {}` to the engine's `project.json`**, the
  convention `CLAUDE.md` names (command, inputs and caching from
  `targetDefaults`). CI's `nx affected -t …typecheck-specs…` then runs it
  for every change that affects the engine.
- **Commit type `test(feat-shared-bacteria-engine)`**: only a spec and a
  project target change; nothing ships.

## Acceptance

1. `npx tsc -p libs/features/bacteria-engine/tsconfig.spec.json --noEmit`
   exits 0.
2. `npx nx typecheck-specs feat-shared-bacteria-engine` exists and passes.
3. The meltdown boss test expects `weaponOf('toxin-bomb').cooldownSec` and
   checks that the boss's `cooldownFactor` is not 1.
4. Mutation check (by hand, not committed): making `MatchEngine` scale the
   weapon cooldown by the boss's `cooldownFactor` fails the test.
5. `npx nx test feat-shared-bacteria-engine` passes.

## Open questions

None.
