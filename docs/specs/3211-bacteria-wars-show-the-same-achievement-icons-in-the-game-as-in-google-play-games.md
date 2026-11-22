# Spec: show the same achievement icons in the game as in Google Play Games ([#3211](https://github.com/WolfSoko/wol-sok-mono/issues/3211))

## Goal

The web game shows every achievement with the icon Play Games shows for it:
the petri dish with the achievement's glyph that
`tools/bacteria-game/generate-achievement-icons.ts` draws into
`apps/bacteria-wars-android/store/play-games/achievements/<id>.png`.

- The achievements screen (`menu/achievements.component.html`) shows the
  icon in place of today's gold hexagon with the name's first letter.
- A locked achievement shows its icon greyed out with a small lock on it,
  as Play Games shows locked achievements greyed out.
- The result screen's "Achievement" chip (`winner-info/winner.component.html`)
  shows the earned achievement's icon in place of the `emoji_events` icon.
- The icons come from one source, so the PNGs for Play and the game's icons
  cannot drift apart.

## Non-goals

- No change to the achievements, their conditions, texts, ids or storage.
- No change to how the PNGs look or how they get to Play Console (by hand).
- No icons for hidden achievements (the game has none).
- Unlocking achievements on Play from the web stays open ([#3175](https://github.com/WolfSoko/wol-sok-mono/issues/3175)).

## Decisions

- **The drawing moves into a new lib `feat-shared-bacteria-art`**
  (`libs/features/bacteria-art`, alias `@wolsok/feat-shared-bacteria-art`,
  tag `feat-shared`, pure TypeScript, no Angular, no DOM): the colony
  palette and the petri dish of `tools/bacteria-game/dish.ts` and the glyphs
  and `svg()` composer of `generate-achievement-icons.ts`, as
  `achievementIconSvg(id)`. Both icon generators and the game import it.
  - Not the game lib: the boundary rules let `tools` depend only on
    `feat-shared`, `shared`, `utils` and `tools`.
  - Not the engine: an icon tweak would rerun the engine's gates (perf,
    GPU cross-check) and redeploy the Cloud Functions, which is what [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103)
    moved texts out of the engine to avoid.
  - `feat-shared` may not import the engine, so the glyph table is keyed by
    the id string; a game spec checks it holds exactly `ACHIEVEMENT_IDS`, and
    the generator keeps throwing on a missing glyph.
- **The game renders the SVG as a data URL in an `<img>`**
  (`data:image/svg+xml,…`), through a new `AchievementIconComponent`
  (`feat-lazy-bac-game-achievement-icon`, inputs `id` and `earned`):
  - no `innerHTML` and no `bypassSecurityTrust…`; Angular's URL sanitizer
    lets the data URL through;
  - each `<img>` is its own document, so the gradient and filter ids of
    several icons on one page do not clash;
  - nothing to fetch, so the icon shows the same on the game's own site and
    inside the shell (an asset path would resolve against the shell's
    origin there).
  - The image is decorative (`alt=""`): the name beside it says what it is.
- **Locked look**: `filter: grayscale(1)` and a lowered opacity, plus the
  `lock` icon in a small round badge at the bottom right.
- **Not the PNGs**: 15 × ~140 kB at 512 px is far too heavy for a list of
  40 px badges; the SVG source is about 10 kB for all of them.
- The achievements screen is a `@defer` chunk; the result screen's chip puts
  the art into the chunk of the result screen. The budgets of
  `bacteria-game-remote` must hold without raising them.

## Acceptance

1. The achievements screen shows each achievement's Play Games icon; earned
   ones in colour, locked ones greyed out with a lock badge.
2. The result screen's chip of a newly earned achievement shows its icon.
3. `npx nx run bacteria-wars-android:achievement-icons` writes PNGs
   pixel-identical to the committed ones (the drawing did not change), and
   `npx nx run bacteria-game-remote:icons` the same launcher icons.
4. A spec fails when an achievement id has no icon or an icon no achievement.
5. `tools/bacteria-game/dish.ts` is gone; nothing else holds the palette.
6. Lint, tests, spec typecheck and the production build of
   `bacteria-game-remote` (budgets) pass.
7. CLAUDE.md names the new lib where it names `dish.ts` and the federation
   skips; `workspace-federation.js` skips the lib like the engine.

## Open questions

- None blocking. Showing the icon in the main menu or profile card (which
  show only the tally) is out of scope.
