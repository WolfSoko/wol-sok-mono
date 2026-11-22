# Plan: a game-like profile header, achievements on their own page ([#3188](https://github.com/WolfSoko/wol-sok-mono/issues/3188))

Spec: `docs/specs/3188-bacteria-wars-a-game-like-profile-page-header-achievements-on-their-own-page.md`

All paths below are in `libs/features/lazy/bacteria-game/src/lib/` unless
named otherwise. Each task is test first; before each commit run
`npx nx format:write` and `npx nx affected -t lint,lint-templates`, plus the
lib's `test` and `typecheck-specs`.

1. **Where a screen goes back to** (`flow/stage-screens.ts`,
   `flow/stage-screens.spec.ts`, `bacteria-game.component.ts`,
   `bacteria-game.component.spec.ts`): failing specs for `parentScreen`
   (`achievements` → `profile`, the rest → `menu`) and for Escape on the
   achievements screen; add `'achievements'` to `MenuScreen`, the function,
   and use it in `onKeyDown`.
2. **The achievements screen** (`menu/achievements.component.{ts,html,scss,spec.ts}`,
   `i18n/texts/{en,de}/profile.ts`): move the list spec from
   `profile.component.spec.ts` into the new spec (plus the Lab Member and the
   German case), then move `achievementList`, `formatDay` and the markup and
   styles out of the profile into the new component; header with
   back label "Profile", count and progress bar, locked cards. Wire it into
   `bacteria-game.component.html` (`@case ("achievements")`, back to
   `profile`) with `progress.achievements()`.
3. **The player card** (`menu/profile-card.component.{ts,html,scss,spec.ts}`,
   texts): failing specs (saved name and motto, avatar with rank emblem,
   rank standing, "Your colony" without the cloud, the button's count and
   its output); then the component.
4. **The profile uses the card** (`menu/profile.component.{ts,html,scss,spec.ts}`,
   `bacteria-game.component.html`): specs for the card above the editor,
   the privacy toggles still there, no achievement list, the button opening
   the achievements (new `achievements` output → `flow.show('achievements')`);
   drop the rank standing from the summary, keep ranks, figures, tally and
   cabinet.
5. **Docs** (`docs/analytics.md`): add `achievements` to the screen views.
6. **Check** the lib's tests, lint, template lint, `typecheck-specs`, the
   production build of `bacteria-game-remote`, and the running game at 390 px
   and 1280 px with Playwright screenshots.

Commits: one per task 1-4 (`feat(feat-lazy-bacteria-game): ...`), task 5 with
task 2, spec and plan as `docs(feat-lazy-bacteria-game): ...` first.
