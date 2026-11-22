# Plan: a 3D bacterium as the main menu's buttons ([#3194](https://github.com/WolfSoko/wol-sok-mono/issues/3194))

Spec: [docs/specs/3194-…](../specs/3194-instead-of-buttons-use-a-3d-bacteria-as-place-of-the-action-buttons.md).
One PR, a commit per task, test first in each.

1. **Three-state toggles in the engine** —
   `libs/features/bacteria-engine/src/lib/state/cloud/feature-toggles.ts` (+ spec):
   `ToggleState`, states as defaults, `bacteriumMenu: 'off'`,
   `parseToggleValues` on states, `resolveToggles`, `toggleText` /
   `parseToggleText`; export through `cloud.ts`. Commit
   `feat(feat-shared-bacteria-engine): three-state feature toggles`.
2. **Functions** — `apps/bacteria-wars-functions/src/admin/toggles.ts` (+ spec,
   emulator spec): states, STRING parameter, texts via `toggleText`. Commit
   `feat(bacteria-wars-functions): …`.
3. **Rules** — `apps/bacteria-game-remote/firestore.rules` `isToggleArgs`
   (states, new key); `firestore-rules-toggles.spec.ts`; the rules test where
   it covers `toggles.set`. Commit `feat(bacteria-game-remote): …`.
4. **Game reads states** — `storage/remote-config-game-toggles.ts`
   (`readToggles` → states), `game-toggles.ts`, `no-game-toggles.ts`,
   `feature-toggles.service.ts` (`states`, `toggles` resolved with
   `GameAccount.owner`), `src/testing/fake-game-toggles.ts`, specs that set
   toggles, `admin-kit.ts` exports. Commit `feat(feat-lazy-bacteria-game): …`.
5. **Admin area** — `toggles/toggles.component.ts`, `admin-toggles.service.ts`,
   i18n en/de (+ specs): three-way button toggle. Commit
   `feat(feat-lazy-bacteria-wars-admin): …`.
6. **Bacterium model** — `menu/bacterium/bacterium-items.ts`,
   `bacterium-look.ts` (+ specs). Commit `feat(feat-lazy-bacteria-game): …`.
7. **Bacterium renderer** — `menu/bacterium/bacterium-shader.ts`,
   `bacterium-renderer.ts` (spec of setup/fallback decisions with a fake
   context). Same scope.
8. **Bacterium component and the main menu** —
   `menu/bacterium-menu.component.*`, `main-menu.component.*` (new `online`
   output, items, toggle), `bacteria-game.component.html` (wire `online`),
   texts en/de (`menu.bacterium.*`, `menu.online`) (+ specs). Same scope.
9. **Docs** — `libs/features/lazy/bacteria-game/CLAUDE.md` (toggles' states,
   the bacterium), ADR 0012 note if it describes boolean toggles. Same scope.
10. **Checks** — `nx affected -t lint,lint-templates,test,typecheck-specs`,
    production build of `bacteria-game-remote` (budgets), local look with the
    toggle's default forced on for a screenshot (not committed).
