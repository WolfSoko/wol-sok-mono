# Plan: show the same achievement icons in the game as in Google Play Games ([#3211](https://github.com/WolfSoko/wol-sok-mono/issues/3211))

Spec: [docs/specs/3211-bacteria-wars-show-the-same-achievement-icons-in-the-game-as-in-google-play-games.md](../specs/3211-bacteria-wars-show-the-same-achievement-icons-in-the-game-as-in-google-play-games.md)

1. **New lib `feat-shared-bacteria-art`** (`libs/features/bacteria-art`):
   `project.json` (tag `feat-shared`, Jest `test`), `tsconfig*.json`,
   `jest.config.ts` (node), `src/index.ts`; alias in `tsconfig.base.json`;
   skip in `tools/federation/workspace-federation.js`.
   - `src/lib/dish.ts`: moved from `tools/bacteria-game/dish.ts` unchanged
     (palette and dish stay one file, as before).
   - `src/lib/achievement-icons.ts`: the glyphs and the composer moved from
     `generate-achievement-icons.ts`; `ACHIEVEMENT_ICON_IDS`,
     `achievementIconSvg(id)`, `achievementIconDataUrl(id)`.
   - Spec: every glyph composes to a well-formed SVG of 512 × 512; the data
     URL decodes to the SVG; an unknown id throws.
   - Commit: `feat(feat-shared-bacteria-art): ...`
2. **Generators take the lib**: `generate-achievement-icons.ts` and
   `generate-icons.ts` import from `@wolsok/feat-shared-bacteria-art`;
   `dish.ts` deleted. Rerun both targets; `git status` shows no changed PNG.
   - Commit: `refactor(tools): ...`
3. **Game shows the icons** (test first): `menu/achievement-icon.component.ts`
   with its spec (earned in colour, locked with the lock badge and the
   `locked` class, decorative `alt`); the achievements screen and the result
   screen's chip use it; drop the hexagon badge styles; a spec that
   `ACHIEVEMENT_ICON_IDS` equals `ACHIEVEMENT_IDS`.
   - Commit: `feat(feat-lazy-bacteria-game): ...`
4. **Docs**: CLAUDE.md (dish, federation skips, the lib), spec and plan.
5. **Checks**: `nx format:write`, `nx affected -t lint,lint-templates,test,typecheck-specs`,
   `nx build bacteria-game-remote -c production` (budgets), a look at the
   achievements screen and the result chip in the running game (Playwright
   screenshot).
