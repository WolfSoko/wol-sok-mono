# Plan: break up `bacteria-game.component.ts` and `colony-renderer.ts` (#2682)

Spec: the issue body of #2682 (no separate spec PR). Paths below are relative to
`libs/features/lazy/bacteria-game/src/lib/`.

## Where things stand (main, 2026-11-03)

The files grew since the issue was written:

| File                           | Issue | Now   | Target |
| ------------------------------ | ----- | ----- | ------ |
| `bacteria-game.component.ts`   | 2,211 | 2,496 | < 600  |
| `arena/colony-renderer.ts`     | 2,525 | 2,715 | < 800  |
| `bacteria-game.component.html` | 450   | 363   | —      |

No new file may exceed ~800 LOC. `weapon-fx.ts` (1,341) and `arena/gl/shaders.ts`
(1,266) are out of scope (issue step 3: only after the first two went well; a
follow-up issue each).

## Decisions

1. **Order: renderer first.** It is a pure move with no DI and its importers
   are few (12 files), so it proves the "no behaviour change" bar cheaply
   before the riskier component split.
2. **No barrel.** `colony-renderer.ts` does not re-export what moves out.
   Every importer (`gl/gpu-simulation.ts`, `gl/simulation-shaders.ts`,
   `arena/gl/shape-batch.ts`, `arena/gl/gl-arena-painter.ts`,
   `arena/gl/shaders.ts`, `arena/arena-painter.ts`, `arena/arena-renderer.ts`,
   `arena/level-preview.ts`, `arena/canvas-arena-painter.ts`,
   `arena/look-preview.ts`, both specs) imports from the module that now owns
   the symbol. A re-export barrel would hide the new seams and keep
   everything coupled through one file.
3. **"Specs pass unchanged" means assertions, not import lines.** Specs may
   change their `import` paths. Where the component spec reaches into a
   member that moves (`component['fullscreen']`, `['onFullscreenChange']`,
   `['requestNativeFullscreen']`, `['setPlayKind']`, `['onMatchEnd']`, …), the
   test case moves with the code into the new unit's spec, with the same
   arrange/act/assert. No assertion is weakened or dropped; the goldens
   (`golden-gpu-int.json`, `golden-gpu-sim.json`, `golden-replay.json`,
   `SELF_TEST_GOLDEN`) are not touched at all.
4. **Component concerns become component-scoped services**, provided in
   `BacteriaGameComponent.providers` (so every instance gets its own, and the
   spec's `TestBed` setup needs no new providers), plus two presentational
   child components for template parts with a narrow interface. Facades own
   their state as signals; the root wires them and keeps layout only.
   Domain logic that is pure (target picking, play-kind choice, clock text)
   goes into pure functions next to its service, tested without `TestBed`.
5. **`BALANCE_VERSION` stays.** Nothing here changes what the simulation or
   the passes compute.

## PR 1 — split `arena/colony-renderer.ts` (pure move)

Branch off `main`, commit scope `feat-lazy-bacteria-game`, type `refactor`.
Every task is a cut-and-paste of whole declarations with their doc comments;
no renames, no reordering inside a function. After each task run:

```bash
npx nx test feat-lazy-bacteria-game --testPathPattern='arena|gl|golden|engine'
npx nx lint feat-lazy-bacteria-game --fix
```

| #   | New file (in `arena/`) | Moves (current lines)                                                                                                                                                                                                                     | ≈ LOC |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1.0 | `colony-energy.ts`     | helpers the slime and the looks both read, moved first so no new module imports back into `colony-renderer.ts`: `BoostShimmer`, `shimmerAt`, `overcharge`, `MIN_CELL_DENSITY`, `cellDensity`, `strengthOf`, `sparkle` (34–46, 2650–2687)  | 80    |
| 1.1 | `look-tuning.ts`       | `LookDescription`, `LOOK_TUNING` (337–602)                                                                                                                                                                                                | 270   |
| 1.2 | `lattice-cells.ts`     | `LatticeCells`, `CELLS`, `BUBBLES`, `MARBLES`, `latticeReach`, `cellsReach`, `TILES_REACH`, `LOOKS`, `lookReach`, `CellBubble`, `cellLatticeOffset`, `cellBubble`, `latticeTile`, `HatchPattern`, `hatchPattern`, hue bins (765–979)      | 220   |
| 1.3 | `slime-painter.ts`     | `SLIME_SCALE`, slime/light constants, `createImageDataFromBacterias`, `colonyDensity`, `wholeArena`, `colonyBounds`, `slimeRegion`, `paintSlime` (47–336)                                                                                 | 300   |
| 1.4 | `look-shading.ts`      | shared look helpers: `sampleDensity`, `LookShader`, `burn`, `paintLook`, `Lattice`, `buildLattice`, `latticeNeighbours`, `overBase`, `WHITE`/`BLACK`, `lookPalette`, `nearestBubble`, `cellEdge`, `sphereShade`, `LookPainter` (980–1313) | 340   |
| 1.5 | `cell-looks.ts`        | `paintCells`, `paintTiles`/`paintHoneycomb`/`paintCrystal`, `paintNeon`, `paintInk`, helix/DNA, `paintBubbles` (1314–1779)                                                                                                                | 470   |
| 1.6 | `surface-looks.ts`     | `densitySlope`, `highlight`, `marbleShade`, `paintMarbles`, `crack`, `paintLava`, `paintGalaxy`, `paintPlasma`, `paintChrome`, `paintSlimeLook`, `paintEclipse` (1780–2329)                                                               | 560   |
| 1.7 | `jam.ts`               | `Jam`, `JamDrop`, `jamDrops`, `JAMS`, `drawJam` (2355–2474)                                                                                                                                                                               | 130   |

`boxBlur` (only `colonyDensity` uses it) moves with 1.3 into
`slime-painter.ts`; `darker` (a colour helper, used by the jam, the slime and
five files outside) moves to `canvas-math.ts` beside `mix`/`rgba`. Do 1.0
before 1.1–1.7.

What stays in `colony-renderer.ts` (≈ 250 LOC): `PaintedColony`,
`DENSITY_PAINTERS` + `paintColony` (the look dispatch), `ColonyImage`,
`ColonyBuffer`, `ColonyRenderer`. Dependencies then point one way:
`colony-renderer` → painters → `look-shading` → `lattice-cells` →
`look-tuning`, all of them → `colony-energy`/`canvas-math`.

Notes:

- The big `const { CELL_SPACING, … } = LOOK_TUNING;` destructure (603–764) is
  split: each painter module destructures only the keys it reads. oxlint's
  unused-variable rule catches leftovers.
- `arena/gl/shaders.ts` imports `LOOK_TUNING` from `look-tuning.ts` and
  `LOOKS` from `lattice-cells.ts`; the GL and canvas painters keep reading one
  set of numbers.
- Watch for cycles: `lattice-cells.ts` and the painters may import
  `look-tuning.ts`; `look-tuning.ts` imports nothing from the new files.
  `.oxlintrc.json` has no `import/no-cycle` rule, so check by hand:
  `npx madge --circular --extensions ts libs/features/lazy/bacteria-game/src/lib/arena`
  must list nothing new against `main`.
- `colony-renderer.spec.ts` (440 LOC) only changes its import block in this
  PR. Splitting it per module is optional and, if done, a separate commit.

Tests that prove it:

- `arena/colony-renderer.spec.ts`, `arena/look-preview.spec.ts`,
  `arena/arena-renderer.spec.ts`, `arena/gl/shape-batch.spec.ts`,
  `arena/create-arena-painter.spec.ts` unchanged in their assertions.
- GPU cross-check (the lib's inferred Playwright target, `npx nx show project
feat-lazy-bacteria-game` names it; `nx affected -t e2e-ci` in CI) green with goldens untouched (`git diff --stat` shows
  no `golden*` file).
- `npx nx run feat-lazy-bacteria-game:perf` (report-only) no worse than ±10%.
- `npx nx build bacteria-game-remote -c production`: `anyScript`/`allScript`
  budgets unchanged (bundler output differs only in module order).

Commits:

0. `refactor(feat-lazy-bacteria-game): move the colony energy helpers and darker out of the colony renderer` (1.0)
1. `refactor(feat-lazy-bacteria-game): move the look tuning out of the colony renderer` (1.1)
2. `refactor(feat-lazy-bacteria-game): move the lattice cells out of the colony renderer` (1.2)
3. `refactor(feat-lazy-bacteria-game): move the slime painter out of the colony renderer` (1.3)
4. `refactor(feat-lazy-bacteria-game): move the look painters out of the colony renderer` (1.4–1.6)
5. `refactor(feat-lazy-bacteria-game): move the jam drops out of the colony renderer` (1.7)

PR body: the before/after LOC table, "no behaviour change; goldens untouched",
and the manual note required by CLAUDE.md ("Performance Gates → CI has no
GPU"): the GL painter's imports changed, so check the arena once on a real
device with WebGL (and once with `?sim=cpu` on Canvas 2D).

## PR 2 — stage: rendering loop, input, fullscreen out of the component

Branch off `main` after PR 1 merged. The root component keeps the same
template bindings; they read from the new services.

| #   | New unit                                    | Takes from `bacteria-game.component.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | ≈ LOC |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 2.1 | `stage/stage-fullscreen.ts` (service)       | `fullscreen`, `nativeFullscreen`, `nativeFullscreenSupported`, `stageTop`, `setNativeFullscreen`, `measureStageTop`, `enterFullscreen`, `setFullscreen`, `requestNativeFullscreenOnOpen`, `leaveFullscreen`, `requestNativeFullscreen`, `isNativeFullscreen`, `onFullscreenChange`, `isTouchDevice` (1529–1569, 2137–2251). Builds on the existing `fullscreen.ts` helpers.                                                                                                                                                                                                | 220   |
| 2.2 | `stage/arena-stage.ts` (service)            | painter, camera, shake, minimap, ambience, frame perf, adaptive quality, `hudPerf`, `arenaLayout`/`canvasSize`/`arenaBoxSize`, arena reveal (`hideArenaUntilPainted`, `revealArenaWhenReady`, `revealArena`), `onPainterChange`, `vaporize`, `runFrame`, `notePerf`, `draw`, `paintAmbience`, `paintMinimap`, `moveCamera`, `matchPaints`, `cameraTarget`, `content`, `takeFires`, `shakenView`, `onArenaBoxResized`, the painter/minimap/quality effects of the constructor and their teardown in `ngOnDestroy` (fields 314–470, methods 1570–1723, 1771–2059, 2252–2319) | 700   |
| 2.3 | `stage/stage-input.ts` (service)            | `draggedBy`, `pinch`, `onWheel`, `zooms`, `zoomBy`, `toArenaPoint`, pointer handlers, `keydown`/`keyup` handling, `onEscape`, `isTypingTarget`, `isInteractiveTarget`, `steer`/`boost`/`fireWeapon` (1980–2013, 2118–2136, 2320–2407). The `@HostListener`s stay on the root as one-line delegations (Angular binds them to the host).                                                                                                                                                                                                                                     | 250   |
| 2.4 | `stage/touch-pads.component.ts` (+ `.html`) | template lines 9–50 (joystick, boost pad, weapon pad) with inputs `colors`, `mode`, `players` and outputs `steer`, `boost`, `fire`; OnPush, signal inputs.                                                                                                                                                                                                                                                                                                                                                                                                                 | 80    |

If `arena-stage.ts` lands above ~800 LOC, split the per-frame painting
(`draw`, `paintAmbience`, `paintMinimap`, `content`, `takeFires`) into
`stage/stage-frame.ts`, leaving layout and reveal in `arena-stage.ts`.

Tests that prove it:

- New `stage/stage-fullscreen.spec.ts`: the 22 `component['fullscreen']` and
  the `onFullscreenChange`/`requestNativeFullscreen*`/`leaveFullscreen`/
  `setFullscreen`/`stageTop` cases move here from
  `bacteria-game.component.spec.ts`, same assertions.
- New `stage/stage-input.spec.ts`: keyboard (pause, escape, typing target),
  wheel zoom and steering cases move here, plus one new case per pointer path
  that had none (drag, pinch).
- `stage/arena-stage.spec.ts`: the `vaporize`, `thanosOptions` and
  `stageRef`/`thanos` cases move here.
- `bacteria-game.component.spec.ts` keeps the integration cases (renders,
  panels, start/end of a match) and passes.
- `apps/bacteria-game-remote` e2e (`npx nx run bacteria-game-remote:e2e`)
  green, including `perf.spec.ts` (report-only, compare the frame interval
  table with main's).

Commits: one per row (`refactor(feat-lazy-bacteria-game): move fullscreen out of the game component`, `… the arena stage …`, `… the stage input …`, `… the touch pads …`).

## PR 3 — flows: play, online, match end, HUD state

| #   | New unit                                                   | Takes from the component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ≈ LOC |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 3.1 | `flow/online-flow.ts` (service)                            | `onlineLobby`, `onlineSeat`, `waitingForPeer`, `rankedOffers`, `inviteOffer`, `declaring`, `onlineStartPending`, `startMatchmadeMatch`, `takeChallenge`, `takeInvite`, `playChallenge`, `challengeFriend`, `fightChallenge`, `dismissChallenge`, `whileDeclaring`, `followOnlineStart`, `startOnlineMatch`, `hostOnline`, `joinOnline`, `leaveOnline`, and the two `online.events$` subscriptions of the constructor (952–1015, 1144–1210, 1292–1326)                                                                                                                                                                                                                                                                                                                                                          | 350   |
| 3.2 | `flow/play-flow.ts` (service) + `flow/play-kind.ts` (pure) | screen/menu state (`screen`, `show`, `settingsBackLabel`, `panel`, `screenOpen`), new game (`newGameEntry`, `openLevels`, `lastKind`, `playKind`, `openNewGame`, `setPlayKind`, `startNewGame`), campaign/training/daily/endless (`dailyCard`, `missionId`, `pickedMission`, `pickMission`, `playMission`, `openTraining`, `playEndless`, `playDaily`, `continueRun`, `continueCampaign`, `playFurthestLevel`, `startedMeanwhile`, `startWhenArenaReady`, `startOnTap`), selections (`selectLevel`, `selectMode`, `selectColor`, `selectDifficulty`, `selectSeriesLength`, `selectHeadStart`), `giveUp`/`giveUpArmed`/`quitToMenu`, `resetting`/`resetGame$`. The choice of a play kind (1421–1442) becomes a pure function in `play-kind.ts`. If above ~800 LOC, split selections into `flow/match-setup.ts`. | 650   |
| 3.3 | `flow/match-end.ts` (service)                              | `onMatchEnd`, `finishMatch`, `matchResult` (1211–1291, 1327–1346)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 130   |
| 3.4 | `hud/hud-state.ts` (service) + `hud/match-clock.ts` (pure) | `humanStats`, `neutralCount`, `stats`, `hudFps`, `running`, `paused`, `clockText`, `clockLabel`, `timeRunningOut`, `goal`, `missionGoal`, `matchOver`, `difficultyName`, `levelName`, `colonyRgb`/`colonyCss`/`onPlayerColor`, `colorNames`, `rivalry`, `upcomingLock`, `canRestart`, `canPause`. Clock text/label and `RUNNING_OUT_SEC` go to `match-clock.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                               | 300   |
| 3.5 | `bacteria-game.component.ts` trim                          | settings toggles (`setSound`, `setEffects`, `setVibration`) delegate to `GameSettingsService` directly from the template; dead fields removed; constructor keeps only the effects that join several services (soundtrack, self-test verdict). Root: injects the facades, exposes them to the template, `ngAfterViewInit`/`ngOnDestroy`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | < 600 |

Tests that prove it:

- `flow/online-flow.spec.ts`, `flow/play-flow.spec.ts`,
  `flow/match-end.spec.ts`: the `setPlayKind`, `startNewGame`, `show`,
  `panel`, `newGameEntry`, `onMatchEnd`, `giveUp`/`giveUpArmed`, `resetting`,
  `selectColor`, `lockedLevels`, `upcomingLock` cases move here from the
  component spec, same assertions.
- `flow/play-kind.spec.ts` and `hud/match-clock.spec.ts`: plain unit tests for
  the pure functions (table-driven), new.
- `bacteria-game.component.spec.ts` keeps its integration cases and passes;
  its `TestBed` setup gets simpler (that is the point) but must not lose a
  case.
- `npx nx run bacteria-game-remote:e2e` and `angular-examples` e2e (the game
  through the shell) green.

Commits: one per row, `refactor(feat-lazy-bacteria-game): …`.

## Checks for every PR

```bash
npx nx format:write
npx nx affected -t lint,lint-templates,test
npx nx build bacteria-game-remote -c production   # budgets + check-lazy-admin
npx nx run feat-lazy-bacteria-game:perf           # report-only, compare with main
```

- `git diff --stat main` lists no `golden*` file, no `BALANCE_VERSION` change.
- No file in the diff above ~800 LOC (`wc -l` on the new files, in the PR body).
- No `@nx/enforce-module-boundaries` findings (everything stays in one lib).
- `anyComponentStyle`: if the touch pads' styles move out of
  `bacteria-game.component.scss`, they go into the new component's stylesheet
  and the root's shrinks; no budget change.
- PR body (`supermatt:pr`): before/after LOC table, the moved spec cases, and
  the manual real-device check for PR 1 (GL painter imports) and PR 2 (stage
  rendering).

## Follow-ups (new issues, not this ticket)

- `arena/weapon-fx.ts` (1,341) and `arena/gl/shaders.ts` (1,266): same
  treatment once PR 1–3 are merged (issue step 3).
- The UI/engine lib split of #2482 can start once PR 3 is merged: the root
  component then no longer owns rendering, input, HUD and flows.
