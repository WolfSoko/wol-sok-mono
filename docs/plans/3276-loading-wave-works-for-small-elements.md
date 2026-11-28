# Plan: loading-wave works for small elements ([#3276](https://github.com/WolfSoko/wol-sok-mono/issues/3276))

Spec: [`docs/specs/3276-…`](../specs/3276-loading-wave-works-for-small-elements.md).
One PR ("Closes #3276"). Every task is test first. Before each commit, run
`npx nx format:write` and `npx nx affected -t lint,lint-templates`. Paths
start at `libs/public/ws-loading-wave/src/lib/` unless they start with
`apps/`, `libs/` or `docs/`.

### Task 1: `autoscale` and the dot size in the geometry

- Files:
  - `wave-model.ts`: `WaveGeometryOptions.dotSize` and `.autoscale`,
    `WaveGeometry.dotSize`, `gridScale()` with `MIN_DOTS_ACROSS` and
    `MIN_DOT_SIZE`.
  - `loading-wave-options.ts`: the option, default `true`, resolved as in
    acceptance 2.
  - `renderer.ts`: `WaveLook.dotSize` goes.
  - `loading-wave.ts`: `look()` and `resize()`.
  - `canvas-wave-renderer.ts` and `webgl/webgl-wave-renderer.ts`: read
    `geometry.dotSize`.
  - The specs of each file.
- Tests: spec acceptance 1, 2 and 4. The existing fixtures pass
  `autoscale: false` where they measure 0.0.3's grid on a small host.
- Commit: `feat(ws-loading-wave): scale the dot grid down on small hosts`.

### Task 2: `origin: 'center'`

- Files: `wave-model.ts` (the centred circle), `loading-wave-options.ts`
  (option, default `'left'`), `loading-wave.ts` (passes it on),
  `canvas-wave-renderer.ts` (full-circle hairline), and their specs.
- Tests: spec acceptance 3, plus "a centre dot lights first" through
  `waveIntensity`.
- Commit: `feat(ws-loading-wave): let the wave start from the host's centre`.

### Task 3: the canvas follows the host's corners

- Files: `loading-wave.ts` (`CANVAS_STYLE.borderRadius = 'inherit'`),
  `loading-wave.spec.ts`.
- Tests: spec acceptance 5.
- Commit: `fix(ws-loading-wave): clip the wave to the host's rounded corners`.

### Task 4: `LoadingWaveSpinnerComponent`

- Files: `loading-wave-spinner.component.ts` and its spec (new), and
  `src/index.ts` (export).
- Tests: spec acceptance 6, through the fake environment
  (`fake-wave-environment.mock.ts`): host size, role, label, the options
  the wave runs with, and the wave mounted on creation and gone on
  destruction.
- Commit: `feat(ws-loading-wave): add a loading spinner in the wave's style`.

### Task 5: the code editor in `@wolsok/ui-kit/code-editor`

- Files:
  - New: `libs/ui-kit/code-editor/ng-package.json` (entry
    `../src/code-editor.ts`), `libs/ui-kit/src/code-editor.ts`,
    `libs/ui-kit/src/lib/code-editor/code-editor.component.{ts,html,scss,spec.ts}`
    (signal inputs, `changeDebounceMs`, `minLines`, `brace/mode/glsl`).
  - `tsconfig.base.json`: the alias.
  - `libs/ui-kit/package.json`: peer `ngx-ace-editor-wrapper` and `brace`.
  - In `libs/features/lazy/shader-examples`: the import in
    `shader-examples.component.ts`, the `code-editor/` folder removed, and
    `package.json` (the peer moves to ui-kit).
- Tests: the spec renders the component with Ace's directive in jsdom, or
  with the directive overridden if Ace does not start there. It checks
  that `code`, `mode` and `changeDebounceMs` reach the editor and that a
  text change emits `codeChange`. Then build `shader-examples-remote` and
  `angular-examples` for production and run their budgets.
- Commit: `refactor(ui-kit): move the shader examples' code editor into @wolsok/ui-kit/code-editor`.

### Task 6: the playground's small elements, autoscale and wide editor

- Files: in `apps/angular-examples/src/app/feature/lazy/loading-wave-playground/`,
  the component `.ts`, `.html`, `.scss` and `.spec.ts`; in
  `apps/angular-examples/e2e/`, `po/loading-wave-playground.page.ts` (fills
  Ace through its text input) and `loading-wave-playground.spec.ts` (a test
  that the small elements draw).
- Tests: spec acceptance 8 and 9 in the component spec. Run the e2e with
  `npx nx run angular-examples:e2e` on Chromium.
- Commit: `feat(angular-examples): show the loading wave on small elements and edit shaders in the code editor`.

### Task 7: docs

- Files: `libs/public/ws-loading-wave/README.md`,
  `apps/portfolio/src/app/projects.ts`, and `CLAUDE.md` (the exception
  for rule 5).
- Tests: `npx nx test portfolio`.
- Commit: `docs(ws-loading-wave): document autoscale, origin and the spinner`.

### Task 8: checks and acceptance

- Run `npx nx affected -t build,test,lint,lint-templates,typecheck-specs`
  and the playground's e2e.
- Take screenshots of the playground and of shader-examples.
- Add a `perf(angular-examples): ...` commit only if a budget asks for one,
  with the growth and its reason in the PR.
- Write acceptance points 1 to 12, each with its result, into the PR
  description.
