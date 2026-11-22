# Spec: one achievement tally, shared tile styles and one back-target mechanism ([#3192](https://github.com/WolfSoko/wol-sok-mono/issues/3192))

## Goal

Four small cleanups in Bacteria Wars that the `/simplify` review of
[PR #3190](https://github.com/WolfSoko/wol-sok-mono/pull/3190) found outside
its scope. No player sees a change: every screen looks, reads and navigates as
before.

1. **One achievement tally.** The earned achievements are counted in three
   places: the engine's `xpOf` (`state/progress/xp.ts`), the game's
   `achievementTally` (`menu/achievement-tally.ts`) and
   `CampaignSummary.achievements` in `campaign.service.ts`
   (`Object.keys(progress.achievements()).length`, which would also count an
   unknown id).
2. **Shared tile styles.** The menu's button tiles repeat their focus ring
   (`outline: 3px solid var(--bw-gold); outline-offset: 2px`) and their base
   (`color: var(--bw-text); font: inherit; cursor: pointer`) in main-menu,
   level-card, new-game, mission-list, my-colony and profile-card, and the
   `mat-icon` size triple (`width`, `height`, `font-size`) recurs in about
   eight stylesheets.
3. **One visually-hidden definition.** Six game stylesheets include
   `cdk.a11y-visually-hidden` (hud-bar, match-countdown, evolution,
   achievements, my-colony, main-menu).
4. **One back-target mechanism.** `PlayFlow.settingsBackLabel` names the
   settings' way back (pause menu or main menu) beside `parentScreen` and
   `PlayFlow.back()`, while the achievements screen hard-codes its back label
   "Profile".

## Non-goals

- No change to XP, achievements, their parsing or the stored progress.
- No visual change: the mixins emit the same declarations.
- No new back targets or screens.

## Decisions

- **The tally lives in the engine**, `state/progress/achievement-tally.ts`
  beside `medalTally`'s module, and counts over `ACHIEVEMENT_IDS` (not
  `ACHIEVEMENTS`), so `xp.ts` does not import the achievement rules.
  `AchievementTally` (`earned`, `total`, `percent`) and
  `achievementTally(achievements)` are exported from the engine's main entry;
  the game's `menu/achievement-tally.ts` and its spec move there.
  `xpOf` takes `achievementTally(progress.achievements).earned`, and
  `CampaignSummary.achievements` takes the same. `xpGain` counts the
  achievements new between two progresses, a different question, and stays.
  An engine change redeploys the functions; the issue accepts that.
- **Mixins in `menu/_screen.scss`**: `focus-ring` (the outline),
  `tile` (the button base plus `&:focus-visible { @include focus-ring; }`)
  and `icon-size($size)` (the triple). Each tile keeps its own layout, hover
  and border; my-colony's skin keeps its `:has(.wear:focus-visible)` with
  `focus-ring`. Every game stylesheet with an icon triple takes `icon-size`,
  through a relative `@use` of the screen module where needed, and the pads'
  `fab-icon`, the same triple, gives way to it.
- **The visually-hidden class is defined once per app's global styles**:
  `apps/bacteria-game-remote/src/styles.scss` adds
  `@include cdk.a11y-visually-hidden;` as the shell's `styles.scss` already
  does, and the six component stylesheets drop theirs. That is CDK's
  documented way, and the class is global anyway.
- **One back target**: `stage-screens.ts` gets `backLabelKey(screen, paused)`,
  the text naming where `PlayFlow.back()` leads: `parentScreen(screen)`'s
  (`profile` → `profile.title`, else `common.menu`), and `stage.pause.back`
  where that is the menu while paused, since the stage shows the pause menu
  for the menu then. `PlayFlow.backLabel` (renamed from `settingsBackLabel`)
  translates it for the open screen; the game passes it to the settings and
  the achievements screen, which loses its hard-coded label and takes a
  required `backLabel` input like the settings'. `PlayFlow.back()` stays as
  it is.
- **The mixins sit before a rule's first nested rule**, after its
  declarations, so Sass emits each rule once, as before (the main menu's tile
  keeps it first: its `font-weight` and `line-height` must follow
  `font: inherit`). The profile editor's own `.visually-hidden` gives way to
  the CDK class.

## Acceptance

1. `achievementTally` exists once, in the engine, with its spec; `xpOf` and
   the campaign summary use it; no other code counts earned achievements.
   The summary ignores an unknown achievement id (spec).
2. No game stylesheet writes the gold focus outline or the icon triple by
   hand where a mixin covers it; `grep` finds `outline: 3px solid
   var(--bw-gold)` only in `_screen.scss`.
3. `cdk.a11y-visually-hidden` is included in no game component stylesheet,
   and in the game remote's and the shell's global styles.
4. `settingsBackLabel` is gone; `PlayFlow.backLabel` names the pause menu
   while paused in the settings, "Profile" on the achievements and "Menu"
   elsewhere (specs); the screens show the same labels as before.
5. `feat-shared-bacteria-engine` and `feat-lazy-bacteria-game` tests, lint,
   `lint-templates`, `typecheck-specs` and the game remote's production build
   (budgets) pass.

## Open questions

None.
