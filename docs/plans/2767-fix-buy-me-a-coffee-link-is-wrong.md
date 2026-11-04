# Plan: Buy Me a Coffee link is wrong (#2767)

Spec: `docs/specs/2767-fix-buy-me-a-coffee-link-is-wrong.md`.

1. **Pure URL builder in the lib.** Move `buyMeACoffeeUrl` from
   `support/game-support.service.ts` into `support/game-support.ts`, export it
   from `libs/features/lazy/bacteria-game/src/index.ts`; the fixture
   `src/testing/game-support-options.ts` and the specs
   (`game-support.service.spec.ts`, `main-menu.component.spec.ts`,
   `help.component.spec.ts`) use `wolfsoko`.
   Tests: `npx nx test feat-lazy-bacteria-game` for those specs.
2. **Privacy page from the handle, real handle.** Test first in
   `privacy.component.spec.ts`: both language sections link to
   `https://buymeacoffee.com/wolfsoko` (red). Then set
   `SUPPORT_DEFAULTS.buyMeACoffeeHandle` to `wolfsoko`, give
   `PrivacyComponent` a `buyMeACoffeeUrl` from it and render href and text
   in `privacy.component.html` (green).
   Tests: `npx nx test bacteria-game-remote`.
3. Spec, plan and both tasks in one commit:
   `fix(bacteria-game-remote): link the owner's Buy Me a Coffee page`;
   format, `nx affected -t lint,lint-templates,test` before it.
