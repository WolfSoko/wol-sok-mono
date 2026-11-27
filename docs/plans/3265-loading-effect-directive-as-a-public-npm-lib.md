# Plan: loading-effect directive as a public npm lib ([#3265](https://github.com/WolfSoko/wol-sok-mono/issues/3265))

Spec: [`docs/specs/3265-loading-effect-directive-as-a-public-npm-lib.md`](../specs/3265-loading-effect-directive-as-a-public-npm-lib.md).
Two PRs of the issue (spec decision 10). Every task is test first; before
each commit `npx nx format:write` and `npx nx affected -t lint,lint-templates`.

## PR 1: the lib, angular-examples and the portfolio

### Task 1: scaffold `ws-loading-wave`

- Files: `libs/public/ws-loading-wave/` with `package.json`
  (`@wolsok/loading-wave`, `0.0.0`, so the first release makes it `0.1.0`, peer `@angular/core`, `publishConfig`
  public), `project.json` (as `ws-thanos`: `build` with
  `ng-packagr-lite`, `test` with Jest, tags `shared`, `published`, `ui`,
  prefix `ws`), `ng-package.json`, `tsconfig*.json`, `jest.config.ts`,
  `src/test-setup.ts`, `src/index.ts`, `README.md`, `LICENSE` (MIT, copied
  from `ws-thanos`), `CHANGELOG.md` left to `nx release`.
- Workspace: `tsconfig.base.json` path `@wolsok/loading-wave`,
  `eslint.config.mjs` `selectorPrefixes` entry
  `'libs/public/ws-loading-wave': ['wsLoadingWave', 'ws-loading-wave']`.
- Tests: an empty `index.ts` builds; `nx test` passes with a first spec of
  task 2; `nx test tools` (root-lint, target-inputs, typecheck-specs tests)
  stays green once the folder is tracked (`git add` first, L686).
- Commit: `feat(ws-loading-wave): scaffold the @wolsok/loading-wave package`.

### Task 2: the wave model

- Files: `src/lib/wave-model.ts` (`WaveGeometry`, `waveGeometry(width,
  height, options)`, `waveIntensity(x, y, elapsedMs, geometry)`,
  `dotDisplacement(…)`), `src/lib/wave-model.spec.ts`.
- Tests: acceptance 2 (0 ahead, peak behind, fall-off over ~2.5 spacings,
  curved front, period `sweepMs`), displacement 0 at rest.
- Commit: `feat(ws-loading-wave): model the curved wave front`.

### Task 3: options and defaults

- Files: `src/lib/loading-wave-options.ts` (`LoadingWaveOptions`, defaults,
  `LOADING_WAVE_OPTIONS` token, `provideLoadingWave`, `resolveOptions`),
  spec.
- Tests: defaults, provider overrides, per-directive overrides win.
- Commit: `feat(ws-loading-wave): add options and app-wide defaults`.

### Task 4: Canvas 2D renderer

- Files: `src/lib/renderer.ts` (`WaveRenderer` interface: `resize`,
  `draw(frame)`, `dispose`; `WaveFrame` with elapsed time, wave amplitude
  and dot opacity for the fades), `src/lib/canvas-wave-renderer.ts`, spec
  with a recording fake 2D context.
- Tests: draws one dot per grid cell, lit dots brighter and larger, front
  line drawn only while the wave amplitude > 0, opacity 0 draws nothing.
- Commit: `feat(ws-loading-wave): draw the wave on a 2D canvas`.

### Task 5: WebGL2 renderer

- Files: `src/lib/webgl/wave-shaders.ts` (vertex: full-element triangle;
  fragment: the wave model of task 2 plus displacement, glow and echo
  ripple), `src/lib/webgl/webgl-wave-renderer.ts` (compile, link, uniforms,
  `webglcontextlost` hook), spec with a fake WebGL2 context.
- Tests: compile or link failure throws a typed error; uniforms set per
  frame; dispose deletes program and buffer.
- Commit: `feat(ws-loading-wave): draw a richer wave with a WebGL2 shader`.

### Task 6: renderer choice and GPU budget

- Files: `src/lib/choose-wave-renderer.ts` (`GpuContextBudget` of 8,
  `chooseWaveRenderer({ renderer, createContext… })`), spec.
- Tests: acceptance 4 (refused context with `failIfMajorPerformanceCaveat`,
  compile failure, budget exhausted, context lost mid-run, `'canvas'` never
  asks for WebGL), budget released on dispose.
- Commit: `feat(ws-loading-wave): fall back to the 2D canvas without a GPU`.

### Task 7: the directive

- Files: `src/lib/loading-wave.directive.ts` (`[wsLoadingWave]`, input
  `wsLoadingWaveOptions`, `afterNextRender` start, canvas insertion and host
  styles, `aria-busy`, `ResizeObserver`, `IntersectionObserver`,
  reduced-motion query, rAF loop, fades of decision 7, cleanup through
  `DestroyRef`), `src/lib/loading-wave-animation.ts` (pure fade/state
  timeline: amplitude and opacity per time since loading changed), specs,
  `src/index.ts` exports, `README.md` usage.
- Tests: acceptance 3, the timeline as pure function.
- Commit: `feat(ws-loading-wave): add the wsLoadingWave directive`.

### Task 8: angular-examples playground

- Files: `apps/angular-examples/src/app/feature/lazy/loading-wave-playground/`
  (component, html, scss, routes, spec): a Material card with loading
  toggle, `afterLoading` radio, renderer select, spacing, size, speed
  sliders, colour, two panes side by side (WebGL and Canvas) each naming its
  active renderer; `app-routing.ts` route `loadingWavePlayground` with
  `data.linkText` and `data.description`; `src/sitemap.xml`;
  `core/seo.service.spec.ts`.
- Tests: component spec (toggle drives the directive input, active renderer
  shown), seo spec.
- Commit: `feat(angular-examples): add the loading wave playground`.

### Task 9: angular-examples route loading

- Files: `src/app/core/navigation-loading.ts` (`navigationLoading()`:
  signal from Router events, true 150 ms after `NavigationStart` until the
  navigation ends), spec; `app.component.html`/`.ts` puts
  `[wsLoadingWave]="navigating()"` on `.content-section`.
- Tests: fake timers: quick navigation never true; slow one true until
  `NavigationEnd`, `Cancel`, `Error`.
- Commit: `feat(angular-examples): show the loading wave while a page loads`.

### Task 10: portfolio entries

- Files: `apps/portfolio/src/app/projects.ts` (`EXPERIMENTS` entry for the
  playground, `PACKAGES` entry for `@wolsok/loading-wave` with npm,
  playground and source links, both languages).
- Tests: `npx nx test portfolio` (`app.component.spec.ts` checks the link
  against the angular-examples sitemap).
- Commit: `feat(portfolio): list @wolsok/loading-wave and its playground`.

### Task 11: check, PR, review, test

- `npx nx affected -t build,test,lint,lint-templates,typecheck-specs`;
  manual check in the playground with and without `--disable-gpu`
  (acceptance 5, 6) and a screenshot for the PR; open PR 1 ("Part of
  #3265"), review, test list, merge request.

## PR 2: rollapolla adoption

### Task 12: wave behind rollapolla's data spinners

- Files: `apps/rollapolla-analog/src/app/pages/poll/[pollId].page.ts`,
  `my-polls.page.ts`, `admin.page.ts`: `[wsLoadingWave]` on the element
  around each loading spinner, bound to the page's existing loading state;
  the specs of those pages.
- Tests: page specs (loading → wave input true; data there → false), SSR
  build output holds no `<canvas>` (acceptance 9).
- Commit: `feat(rollapolla-analog): show the loading wave behind the data spinners`.
- PR 2 closes #3265 ("Closes #3265").
