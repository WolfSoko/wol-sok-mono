# Plan #2770: show DNA points on the landing page

1. **Specs first** (`libs/features/lazy/bacteria-game/src/lib/menu/main-menu.component.spec.ts`):
   the card holds the DNA counter with left and earned DNA; loading text
   while not loaded; `ready` with an Evolution or My Colony badge only;
   German texts. They fail.
2. **Main menu** (`main-menu.component.ts`, `.html`, `.scss`): import
   `DnaCounterComponent`, add the inputs `dna`, `dnaEarned`, `dnaLoaded`
   and a computed `dnaReady`, render the counter under the rank standing,
   left-aligned in the card. Specs pass.
3. **Wire it** (`bacteria-game.component.html`): pass `evolution.dna()`,
   `evolution.earned()`, `evolution.loaded()`.
4. **Check**: `nx test feat-lazy-bacteria-game`, `lint`, `lint-templates`,
   `format:write`, production build of `bacteria-game-remote` (style
   budget), screenshots at phone and desktop width.
5. One commit `feat(feat-lazy-bacteria-game): show the DNA on the main menu`
   with spec and plan, PR to `main` with `Closes #2770`.
