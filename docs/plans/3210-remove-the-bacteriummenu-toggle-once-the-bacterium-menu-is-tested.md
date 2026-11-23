# Plan: remove the `bacteriumMenu` toggle ([#3210](https://github.com/WolfSoko/wol-sok-mono/issues/3210))

Spec: [`docs/specs/3210-remove-the-bacteriummenu-toggle-once-the-bacterium-menu-is-tested.md`](../specs/3210-remove-the-bacteriummenu-toggle-once-the-bacterium-menu-is-tested.md).
Branch `claude/epic-allen-loe46p` off `main`, one PR.

1. **Main menu: the bacterium always** (test first).
   - `libs/features/lazy/bacteria-game/src/lib/menu/main-menu.component.spec.ts`:
     rewrite the toggle block into "the bacterium menu" specs that need no
     toggle (the cell shows, parts lead where they did, online, friends
     and boards only where they apply, utility row only Settings, How to
     play, Support, Admin); move the old tile specs (My Colony, "reports
     what the player picks", tile order) onto the parts. Red first.
   - `main-menu.component.{html,ts,scss}`: drop `showsBacterium`, the
     `.actions` block, the action tiles and their styles; keep `@defer`
     with an updated comment; drop unused imports.
   - Stage specs (`bacteria-game.component.spec.ts` and others) that open
     a screen through a tile: go through the part instead, awaiting
     `whenStable()`.
   - Check: `npx jest --config libs/features/lazy/bacteria-game/jest.config.ts <spec>`,
     then `npx nx test feat-lazy-bacteria-game`.
   - Commit: `feat(feat-lazy-bacteria-game): the bacterium is the main menu (#3210)`.
2. **Remove the toggle.**
   - Engine `feature-toggles.ts` and its spec; game lib
     `feature-toggles.service.spec.ts`, `remote-config-game-toggles.spec.ts`;
     admin `i18n/en.ts`, `i18n/de.ts`, `toggles.component.spec.ts`;
     functions `admin/toggles.spec.ts`; remote `firestore.rules`
     (`isToggleArgs`) and `rules-test/firestore-rules.emulator.ts`. Specs
     that used it as "a toggle off by default" take another toggle set
     to a non-default state.
   - Check: tests and `typecheck-specs` of the engine, game lib, admin lib,
     functions; `bacteria-game-remote:test-emulator` where the emulator
     runs.
   - Commit: `refactor(feat-shared-bacteria-engine): remove the bacteriumMenu toggle (#3210)`.
3. **Docs.** Game lib `CLAUDE.md` ("The bacterium menu"), ADR 0012's toggle
   list, the bacterium component's doc comment. Commit:
   `docs(feat-lazy-bacteria-game): the bacterium menu without its toggle (#3210)`.
4. **Measure.** `npx nx run bacteria-game-remote:build:production`; lower
   a baseline only for a gain above 1% (`perf(bacteria-game-remote): ...`).
   Run the remote's e2e suite (`bacteria-game-remote:e2e`, Chromium) for
   the page objects.
5. **Checks, PR.** `npx nx format:write`, `npx nx affected -t lint,lint-templates,test,typecheck-specs`,
   `git grep bacteriumMenu`; open the PR with `Closes #3210`, the
   acceptance list and the manual step (delete the Remote Config
   parameter after the deploy).
