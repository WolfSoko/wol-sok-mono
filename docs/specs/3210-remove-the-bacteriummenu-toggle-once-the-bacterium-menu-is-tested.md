# Spec: remove the `bacteriumMenu` toggle ([#3210](https://github.com/WolfSoko/wol-sok-mono/issues/3210))

## Goal

The 3D bacterium ([#3194](https://github.com/WolfSoko/wol-sok-mono/issues/3194),
[PR #3209](https://github.com/WolfSoko/wol-sok-mono/pull/3209)) is the main
menu for every player. The feature toggle `bacteriumMenu` that held it back,
and the old play buttons and action tiles it replaced, are gone. The main
menu describes its items once: `bacteriumItems` is its one item list and
`pickPart` its one way to act on an item.

## Non-goals

- No change to the bacterium itself (shader, renderer, look, anchors, the
  CSS cell), its items or where they lead.
- No change to the other toggles, to `toggles.set`, the admin area beyond
  the removed toggle's texts, or the Remote Config port.
- Deleting the `bacteriumMenu` parameter from the project's Remote Config:
  the console holds it, not the code. It is a manual step for the owner
  after the deploy (see Decisions).

## Decisions

- **The toggle goes from the one list every side reads.** Removing
  `bacteriumMenu` from `FEATURE_TOGGLES` (engine `state/cloud/feature-toggles.ts`)
  removes it from `FeatureToggle`, so the type checker names every reader:
  the main menu, the admin's toggle texts (en, de) and the specs. The
  Firestore rules' `isToggleArgs` key list drops it in the same change
  (`firestore-rules-toggles.spec.ts` keeps the list equal to the toggles),
  so a `toggles.set` naming it is refused by the rules and by
  `parseToggleValues`, as for any unknown key.
- **The bacterium is the main menu.** `main-menu.component.html` shows the
  bacterium always; the `.actions` block (New game, training) and the
  action tiles (My Colony, Evolution, Profile, Friends, Leaderboards, My
  matches, Matches of the day) and their styles go (`.actions`, `.play*`,
  `.training`, `.tile.ready` with its keyframes, `.count`, `.tile-helix`,
  the tiles' `.player` icon colour), and so does `DnaHelixComponent` from
  the menu's imports if nothing else in it uses it. The utility row stays
  as it is: Settings, How to play, Support, Admin. `showsBacterium` goes;
  `busyEmit` stays as the way `pickPart` starts a game.
- **The `@defer (on immediate)` stays.** The bacterium (shader, renderer,
  component) is its own chunk, loaded right after the menu renders, while
  its box holds the place. Without it the code would land in the game's
  largest chunk, which sits at its `anyScript` budget (579 kB baseline,
  [#3188](https://github.com/WolfSoko/wol-sok-mono/pull/3188) moved screens
  out of it for that reason). Now every player loads the chunk, so its
  comment says why it is deferred, not who downloads it.
- **Budgets follow the measurement.** The production build of
  `bacteria-game-remote` is measured after the change. Removing the old
  buttons and tiles only shrinks the code; a baseline is lowered (in a
  `perf(bacteria-game-remote): ...` commit of its own) only when a figure
  falls by a noticeable amount (more than 1%), and nothing is raised.
- **Remote Config's parameter is deleted by hand, after the deploy.** No
  released client after this change reads `bacteriumMenu`; a client from
  before it (a PWA that has not updated yet) reads it as its default
  `off` once it is gone, and shows the old menu until it updates, which is
  harmless. So the owner may delete it from the console once the release
  is live; filed as a manual step on the work item.
- **Docs follow.** The game lib's `CLAUDE.md` ("The bacterium menu") says
  the bacterium is the main menu, without the toggle; ADR 0012's toggle
  list drops it and notes it was removed once the bacterium shipped for
  everyone. Older specs and plans (`docs/specs/3194-…`, `docs/plans/3194-…`,
  `docs/specs/3212-…`) are a record of their time and stay as they are.

## Acceptance

1. No `bacteriumMenu` left in code, rules, admin texts, specs, the game
   lib's `CLAUDE.md` or ADR 0012's toggle list (`git grep bacteriumMenu`
   finds only the historical specs and plans of #3194 and #3212, and this
   spec and plan).
2. The main menu always shows the bacterium, with no toggle state needed;
   its parts lead where the tiles and buttons led (new game, online,
   training, the screens, the gallery link), offered under the same
   conditions; the CSS cell stands in where `BACTERIUM_RENDERER` answers
   null. Specs cover each.
3. The utility row shows Settings, How to play, and Support and Admin where
   they apply; no action tile or `.actions` block is left.
4. The e2e page objects of `bacteria-game-remote` still find New game,
   My Colony, Profile, Friends, Settings and How to play by their roles
   and names, and the e2e suite passes.
5. `bacteria-game-remote`'s production build holds its budgets.
6. Tests, lint, `lint-templates` and `typecheck-specs` pass for the affected
   projects (engine, game lib, admin lib, functions, remote with its rules
   test).

## Open questions

- The issue is blocked by the owner's real-device test of #3194 (toggle on
  Admin, then On). The handover does not say whether it has happened; the
  draft request asks before the build starts.
