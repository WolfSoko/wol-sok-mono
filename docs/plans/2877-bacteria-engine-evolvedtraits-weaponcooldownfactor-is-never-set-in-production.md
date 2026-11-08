# Plan #2877: bacteria-engine: EvolvedTraits.weaponCooldownFactor is never set in production

Spec: [docs/specs/2877-bacteria-engine-evolvedtraits-weaponcooldownfactor-is-never-set-in-production.md](../specs/2877-bacteria-engine-evolvedtraits-weaponcooldownfactor-is-never-set-in-production.md)

One commit; every task leaves the engine's specs green.

1. **Test first**: in `libs/features/bacteria-engine/src/lib/state/evolution-match.spec.ts`
   rewrite "recharges once the effect has run out, by the weapon cooldown
   factor" to use `evolvedTraits(PLAIN_LOADOUT)` and `toxin.cooldownSec`
   (no factor). Passes before and after the change.
2. **Engine**: remove `weaponCooldownFactor` from `EvolvedTraits`
   (`evolution.ts`) and the factor from `MatchEngine.weaponCooldown`
   (`match-engine.ts`), inlining `weaponOf(id).cooldownSec` where the helper
   no longer names anything. `typecheck-specs` proves no spec still sets it.
3. **Docs**: correct the gene sentence in
   `docs/adr/0013-bacteria-wars-evolution-weapons-level-previews.md`.
4. **Checks**: `npx nx format:write`; `npx nx run-many -p feat-shared-bacteria-engine,feat-lazy-bacteria-game -t test,lint,lint-templates,typecheck-specs`;
   grep for `weaponCooldownFactor` in `libs/` and `apps/`.
5. **Commit**: `refactor(feat-shared-bacteria-engine): drop the unused weapon cooldown trait`,
   with spec and plan; PR to `main` with `Closes #2877`.
