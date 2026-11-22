# Spec: a 3D bacterium as the main menu's buttons ([#3194](https://github.com/WolfSoko/wol-sok-mono/issues/3194))

## Goal

The owner: "Instead of buttons use a 3d bacteria as place of the action
buttons. The bacteria gets more impressive with your game progress. Different
areas of the bacterium are the different menu items. Important is that online
game is on it. Everything behind a feature toggle (admin). Feature toggles need
3 states: off, on for admin, on."

Today the main menu (`menu/main-menu.component.*` in `feat-lazy-bacteria-game`)
shows the big "New game" button, the training button and a grid of tiles
(My colony, Evolution, Profile, Friends, Leaderboards, My matches, Matches of
the day, Settings, Help, Support, Admin). The owner's feature toggles
(`FEATURE_TOGGLES`, ADR 0012) are booleans: on or off for everyone.

After the change:

1. Every feature toggle has **three states**: `off`, `admin` (on only for the
   owner, `GameAccount.owner()`) and `on`. The admin area sets each one of
   the three; the game resolves them to on/off for whoever plays.
2. A new toggle, `bacteriumMenu` (default `off`), swaps the main menu's action
   buttons and tiles for a **3D bacterium**: a living cell, slowly turning,
   whose parts are the menu items. "Online" is one of them, straight into the
   online lobby.
3. The bacterium **grows more impressive with the player's rank**: more
   flagella, pili, organelles, a stronger glow and membrane shimmer from Spore
   to Superbug.
4. With the toggle resolving to off the menu is exactly as today.

## Non-goals

- No change to the screens the items open, to the hero's banners (stats,
  Lab Pass, install), the ghost challenge or the campaign card beside it.
- No three.js: it would add about 600 kB to the game's `allScript` (budget
  +10 % error, 1863 kB baseline). The bacterium is one small WebGL2 shader.
- No change to what the Cloud Functions do with a toggle (they read none).
- No new analytics event.

## Decisions

### Three-state toggles

- **The engine's contract** (`state/cloud/feature-toggles.ts`, `/cloud`):
  `ToggleState = 'off' | 'admin' | 'on'`, `FEATURE_TOGGLES` holds a state
  per toggle (today's `true` becomes `'on'`), `FeatureToggleStates` the
  record of states, `isToggleState`, `parseToggleValues` takes states,
  `featureToggles(read)` fills states with their defaults, and a new pure
  `resolveToggles(states, isOwner): FeatureToggles` gives the booleans
  (`admin` is true only for the owner). `FeatureToggles` stays
  `Record<FeatureToggle, boolean>`, so every reader of a toggle
  (`showsBoards`, ranked, matchmaking, simulation choice) is untouched.
- **Stored in Remote Config as a STRING parameter**: `on` as `"true"`, `off`
  as `"false"`, `admin` as `"admin"` (`toggleText`/`parseToggleText` in the
  engine). A client released before this change still reads `"true"` and
  `"false"` as before and reads `"admin"` as unset, its default: so `on` and
  `off` keep working for cached PWAs, and `admin` falls back to what the
  toggle did before. `withToggles` in the functions writes `valueType:
  'STRING'`; `togglesOf` and the game's `readToggles` read all three texts.
- **The game resolves in `FeatureTogglesService`**: it keeps the states from
  Remote Config and exposes `toggles` as `computed(() =>
  resolveToggles(states, account.owner()))`, so an owner signing in or out
  sees the toggle change at once. A feature that reads its toggle once (the
  simulation per match) still does. `states` is exposed too, for the admin.
- **The admin area** (`toggles.component.ts`) shows a three-way
  `mat-button-toggle-group` (Off / Admin / On) per toggle instead of the slide
  toggle; draft, changes and publish work as before, with states. Texts in
  English and German (`toggles.state.off|admin|on`).
- **The rules** (`isToggleArgs` in `firestore.rules`) take
  `values().hasOnly(['off', 'admin', 'on'])` and the new key;
  `firestore-rules-toggles.spec.ts` keeps the key list.
- **The functions** (`admin/toggles.ts`) compare and audit states.

### The bacterium

- **A component of its own**, `menu/bacterium-menu.component.*`
  (`feat-lazy-bac-game-bacterium-menu`), so the main menu's stylesheet stays
  under the component style budget. The main menu shows it in place of
  `.actions` and `.tiles` when `toggles().bacteriumMenu` is true, and passes
  it the items it would show as tiles (same conditions: cloud, boards
  toggle, training missions left, support, admin).
- **What it is made of** (pure, testable, no Angular): `menu/bacterium/`
  - `bacterium-items.ts`: the item list the menu passes in
    (`BacteriumItem`: id, text key, icon, badge count, link or action) and
    their **anchors**, a fixed place on the cell for each id (New game the
    nucleus in the middle, Online the biggest lobe on top right, Training,
    Colony, Evolution, Profile, Friends, Leaderboards, My matches, Matches of
    the day around the membrane). Settings, Help, Support and Admin stay as
    a small row of icon tiles under the bacterium: utilities, not actions.
  - `bacterium-look.ts`: `bacteriumLook(rankIndex)`, what the rank adds:
    flagella count (0 → 6), pili (0 → 24), organelles (1 → 8), glow, wobble,
    membrane shimmer. Rank from `rankFor(xp)` (8 ranks, Spore to Superbug).
  - `bacterium-shader.ts`: the GLSL (WebGL2) of a raymarched signed distance
    field: a capsule body, a lobe per anchor (the hovered or focused one
    swells and lights up), the nucleus, organelles, flagella and pili as
    animated tubes, lit with a soft rim light in the player's colony colour
    (`--bw-player`).
  - `bacterium-renderer.ts`: sets up the context, draws a frame per
    animation frame at a capped resolution (device pixel ratio at most 1.5,
    30 fps), stops when the tab is hidden or the component goes.
- **The buttons are real buttons**: each item is a `<button>` (or `<a>` for
  the gallery and admin links) laid over the canvas at its anchor, with its
  icon, label and badge, so keyboard, screen readers, focus rings and e2e
  work as with the tiles. The canvas is `aria-hidden`. Hover and focus tell
  the renderer which lobe to light.
- **Fallbacks**: without WebGL2, on a software renderer (`isSoftwareRenderer`
  from `@wolsok/feat-bacteria-rendering`, which would take hundreds of ms a
  frame) or when the shader fails, the cell is drawn by CSS (radial
  gradients, same anchors, same rank looks reduced to glow and ring count).
  With reduced motion (`prefersReducedMotion`) the shader draws one still
  frame and redraws only on hover/focus.
- **Online**: the item opens the new game on the online mode
  (`PlayFlow.openNewGameOn({ kind: 'online', step: 'start' })`) through a new
  main-menu output `online`, shown where `OnlineFlow.available`; it waits
  behind `StageBusy` like New game.
- **Layout**: the cell fills the hero's width up to 32 rem, square, labels
  outside the membrane on wide screens and inside on phones (below 30 rem
  the labels shrink to icons with the text under them).

## Acceptance

1. Every toggle has three states in the engine; `resolveToggles` gives on for
   `on`, off for `off`, and for `admin` on only for the owner (spec).
2. Remote Config texts: `"true"`, `"false"`, `"admin"` read as `on`, `off`,
   `admin`; anything else as unset; the functions write those texts as a
   STRING parameter and audit states (specs).
3. `toggles.set` commands with states pass the rules; booleans and unknown
   texts are refused (rules key-list spec; the rules emulator suite where it
   covers `toggles.set`).
4. The admin area sets each toggle to Off, Admin or On and publishes only the
   changed ones (spec).
5. With `bacteriumMenu` off (default) the main menu is unchanged (existing
   specs green). With `admin` the owner sees the bacterium and a player does
   not; with `on` everyone does (spec).
6. The bacterium offers every item the tiles offer under the same conditions,
   plus Online and New game; each emits or links as its tile did (spec).
7. The look grows with the rank: a Superbug's cell has more flagella, pili and
   organelles than a Spore's (spec of `bacteriumLook`).
8. Without WebGL2 or on a software renderer the CSS cell shows, with the same
   buttons (spec).
9. Budgets of `bacteria-game-remote` hold (production build).
10. A look at the running game (screenshot in the PR) with the toggle forced
    on in a local build.

## Open questions

- Should Settings, Help, Support and Admin also be parts of the cell? The spec
  keeps them as a small row below it, so the cell holds the actions and
  stays readable on a phone.
- Is `admin` meant as "the owner" (`GameAccount.owner()`, the admin claim
  with a Google sign-in), as the spec assumes?
