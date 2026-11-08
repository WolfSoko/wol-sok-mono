# Spec #2877: bacteria-engine: EvolvedTraits.weaponCooldownFactor is never set in production

Found while working on [#2803](https://github.com/WolfSoko/wol-sok-mono/issues/2803).

## Goal

The engine carries no trait that nothing sets. `EvolvedTraits.weaponCooldownFactor`
goes, together with its read in `MatchEngine.weaponCooldown`, its one use in a
spec and its mention in ADR 0013, so code and docs say what a match does: a
weapon recharges in its plain `cooldownSec`.

Today:

- `EvolvedTraits.weaponCooldownFactor` (`libs/features/bacteria-engine/src/lib/state/evolution.ts`)
  is read by `MatchEngine.weaponCooldown` (`match-engine.ts`) as
  `traits.weaponCooldownFactor ?? 1`.
- No gene in `GENES` sets it. Metabolism scales `cooldownFactor`, the
  boost's cooldown, and its text says the boost recharges sooner.
- Boss traits (`levels.ts`) are `ColonyTraits` and never set it.
- The GPU passes (`gpu-int/*`) and `weapon-effects.ts` never read it; traits
  reach the engine only through `match-setup.ts` (`evolvedTraits(loadout)`),
  which builds them from `GENES`.
- The game's evolution menu already shows a weapon's plain `cooldownSec`.
- Only `evolution-match.spec.ts` ("recharges once the effect has run out, by
  the weapon cooldown factor") sets it, by hand, to 0.5.
- ADR 0013 says genes extend `ColonyTraits` with `toughnessFactor`,
  `speedFactor` and `weaponCooldownFactor`.

So in every real match the factor is 1.

## Non-goals

- No new gene that shortens the weapon cooldown. That would be a balance and
  product decision (DNA prices, texts in two languages, the menu's preview, a
  `BALANCE_VERSION` bump and new goldens); if wanted, it is a ticket of its own.
- No change to Metabolism, the boost, bosses or what any match computes.
- No change to the GPU simulation or the game lib.

## Decisions

- **Remove the trait, not add a gene.** Nothing sets it, so it is dead code;
  removing it changes no match, replay, checksum or golden, so it needs no
  `BALANCE_VERSION` bump. Adding a gene would change the game's balance and
  belongs to a decision of its own (see Non-goals).
- **`weaponCooldown(playerId, id)` becomes a plain read of the weapon's
  `cooldownSec`.** The private helper stays only if it still names something;
  with no trait left it is `weaponOf(id).cooldownSec` at its call sites, and
  the doc comment "its genes counted" goes.
- **The spec keeps covering the recharge**: the test drops the hand-set
  factor and checks the recharge with the weapon's plain `cooldownSec`
  ("recharges once the effect has run out, in the weapon's cooldown").
- **ADR 0013 is corrected in place** with a short note that the weapon
  cooldown trait was dropped as unused (#2877), linked as a full URL.

## Acceptance

1. `weaponCooldownFactor` occurs nowhere in `libs/` and `apps/` (grep).
2. `EvolvedTraits` keeps `toughnessFactor` and `speedFactor`; its doc comment
   still reads right.
3. The recharge test in `evolution-match.spec.ts` passes with the plain
   `cooldownSec` and still fails when the recharge is wrong.
4. `npx nx test feat-shared-bacteria-engine`, its `typecheck-specs` and
   `lint` pass; `npx nx test feat-lazy-bacteria-game` passes (it reads
   `EvolvedTraits`).
5. The golden replay specs (`golden-replay.spec.ts`) pass unchanged: no
   checksum moved, `BALANCE_VERSION` unchanged.
6. ADR 0013 no longer claims genes add `weaponCooldownFactor`.

## Open questions

- None for this ticket. Whether a gene for the weapon cooldown is wanted is
  left to the owner as a possible new ticket.
