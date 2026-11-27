# Plan: loading-wave: configurable round wave front, theme-aware showcase, shaded WebGL wave and shader options ([#3272](https://github.com/WolfSoko/wol-sok-mono/issues/3272))

Spec: [`docs/specs/3272-…`](../specs/3272-loading-wave-configurable-round-wave-front-theme-aware-showcase-shaded-webgl-wave-and-shader-options.md).
Two PRs (spec decision 12): PR 1 (tasks 1 to 4, 6, 8, 9; "Part of #3272")
and PR 2 (tasks 5 and 7, then 9 again; "Closes #3272"). Every task is test first; before each commit
`npx nx format:write` and `npx nx affected -t lint,lint-templates`. Paths
below are relative to `libs/public/ws-loading-wave/src/lib/` unless they
start with `apps/` or `docs/`.

### Task 1: `frontRoundness` in the model and the options

- Files: `wave-model.ts` (`WaveGeometryOptions.frontRoundness`, the circle
  from the sagitta, radius cap; `CENTER_DISTANCE` goes), `wave-model.spec.ts`,
  `loading-wave-options.ts` (option, default 0.5, clamp in
  `resolveLoadingWaveOptions`), its spec, `loading-wave.ts` (`resize`
  passes it on).
- Tests: spec acceptance 1; the existing model specs keep passing with the
  geometry they now build (fixtures pass `frontRoundness` where they
  measured the old curve).
- Commit: `feat(ws-loading-wave): make the wave front's roundness an option`.

Tasks 2 and 3 went into one commit, since both reshape the WebGL
renderer's look and uniforms.

### Task 2: `accentColor`

- Files: `loading-wave-options.ts`, `renderer.ts` (`WaveLook.accent`),
  `loading-wave.ts` (`look()` resolves it, `recolor` too),
  `canvas-wave-renderer.ts` (lit dots mixed from `color` to `accent`),
  `webgl/webgl-wave-renderer.ts` (uniform), specs of each.
- Tests: spec acceptance 2 with the recording 2D fake and the fake WebGL2.
- Commit: `feat(ws-loading-wave): light the wave in an accent colour`.

### Task 3: the shader contract

- Files: `webgl/loading-wave-shader.ts` (`LoadingWaveShader`),
  `webgl/shader-program.ts` (header, helpers, `main`; `assembleFragment`,
  `linkWaveProgram`, uniform setting incl. a shader's own `uniforms`),
  `webgl/webgl-wave-renderer.ts` (takes the shader, `ws_` uniforms;
  `setShaderUniforms`), `choose-wave-renderer.ts` (passes the shader),
  `loading-wave.ts` (`setOptions`: uniforms in place, fragment rebuilds),
  `loading-wave-options.ts` (`shader`), `index.ts` exports, specs;
  `webgl/fake-webgl2.mock.ts` records sources and uniforms.
- Tests: spec acceptance 3. Today's shader moves behind the contract
  unchanged in look (as `rippleShader`'s first version), so this task
  changes no pixel.
- Commit: `feat(ws-loading-wave): accept a custom fragment shader`.

### Task 4: the shaded `rippleShader`

- Files: `webgl/shaders/ripple.shader.ts` (height field, refraction, beads,
  crest, bloom; plain string constant, decision 8), `webgl/wave-shaders.ts`
  (shared GLSL helpers as literals), `webgl/shader-constants.spec.ts`
  (GLSL literals equal the TypeScript constants).
- Tests: constants spec; the renderer spec draws with it; a look check in
  the playground on a real GPU (L642: `--use-angle=vulkan`).
- Commit: `feat(ws-loading-wave): shade the default WebGL wave`.

### Task 5 (PR 2): one commit per built-in shader

Found while checking PR 1's build: Native Federation shares
`@wolsok/loading-wave` as one bundle per entry point
(`_wolsok_loading_wave-*.js`), with every export of the entry, so a bundler
cannot drop an unused shader exported from the main entry. The five
built-in shaders therefore go into a secondary entry point,
`@wolsok/loading-wave/shaders` (`ng-package.json` of its own, path alias in
`tsconfig.base.json`), which only the playground imports; acceptance 5
checks that the shell's start loads none of their source.

For each of the five the user picked (spec "Shader proposals", A to E:
`circuitTracesShader`, `dataBusShader`, `dieScanShader`,
`signalTraceShader`, `sparkFrontShader`), also added to the playground's
picker:

- Files: `webgl/shaders/<name>.shader.ts`, exported from `index.ts`, the
  constants spec where it mirrors a constant.
- Tests: the e2e of task 7 picks it; screenshot on a real GPU.
- Commit: `feat(ws-loading-wave): add the <name> shader`.

### Task 6: theme-aware playground

- Files: `apps/angular-examples/src/app/feature/lazy/loading-wave-playground/`
  (`.scss`: stage tokens; `.ts`/`.html`: theme-token colour and accent
  choices, roundness slider, shader picker with "Custom" and its text field
  and "Apply"), its spec.
- Tests: component spec (picker sets `shader`, custom fragment applied on
  "Apply", roundness and accent reach both stages' options).
- Commit: `feat(angular-examples): pick shaders and follow the theme in the loading wave playground`.

### Task 7 (PR 2): playground e2e

- Files: `apps/angular-examples/e2e/loading-wave-playground.spec.ts`, a
  page object in `apps/angular-examples/e2e/po/`.
- Tests: spec acceptance 4 (every built-in shader "drawn by: webgl", a
  broken custom fragment "drawn by: canvas"), run through
  `npx nx run angular-examples:e2e`.
- Commit: `test(angular-examples): check every loading wave shader compiles`.

### Task 8: docs and portfolio

- Files: `libs/public/ws-loading-wave/README.md` (options table, "Shaders"
  section with the contract and an example), `apps/portfolio/src/app/projects.ts`
  (descriptions in both languages).
- Tests: `npx nx test portfolio`.
- Commit: `docs(ws-loading-wave): document the shaders and the round front`
  and `feat(portfolio): name the loading wave's shaders`.

### Task 9: check, PR, review, test

- `npx nx affected -t build,test,lint,lint-templates,typecheck-specs`
  (budgets of angular-examples and portfolio), search the angular-examples
  build for the circuit shaders' source (acceptance 5), screenshots of
  both themes and every shader, PR with spec, plan and code, review by a
  fresh subagent, acceptance list in the PR body, merge request.
