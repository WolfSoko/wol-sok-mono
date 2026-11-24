# Plan: keep the UI hidden while the player profile loads ([#3241](https://github.com/WolfSoko/wol-sok-mono/issues/3241))

Spec: [`docs/specs/3241-…`](../specs/3241-bacteria-wars-keep-the-ui-hidden-while-the-player-profile-loads-so-nothing-jumps.md).
Branch `3241-hide-ui-while-profile-loads` off `main`, one PR. Paths are under
`libs/features/lazy/bacteria-game/src/lib/`.

1. **The rule and the gate** (test first).
   - `menu/profile-gate.spec.ts`: `profileKnown` truth table; `ProfileGate`
     with fake sources and fake timers covering opening, timeout and a switch
     that closes it again.
   - `menu/profile-gate.ts`: `profileKnown`, `PROFILE_WAIT_MS` and
     `ProfileGate` (root).
2. **Hide the screens behind the spinner, hold the splash** (test first).
   - `bacteria-game.component.spec.ts`: hidden, inert and spinner while
     closed; visible once open; splash dismissed only when it opens.
   - `menu/profile-curtain.component.ts` (with spec): the wrapper with
     `[class.pending]` and `inert`, the spinner, and the fade-in with its
     reduced-motion variant. `bacteria-game.component.html/.ts` put it
     around the notices and the open screen. The `dismissSplash` call moves to an effect on `gate.ready()`.
   - i18n: `stage.loadingProfile` in English and German.
   - Commit: `feat(feat-lazy-bacteria-game): keep the menu hidden while the player profile loads (#3241)`.
3. **Checks and PR.** Run `npx nx format:write`, then
   `npx nx affected --base=origin/main -t lint,lint-templates,test,typecheck-specs`,
   then `bacteria-game-remote:build:production` for the budgets. Take a
   Playwright screenshot sequence of the start. Open the PR with
   `Closes #3241` and the acceptance list.
