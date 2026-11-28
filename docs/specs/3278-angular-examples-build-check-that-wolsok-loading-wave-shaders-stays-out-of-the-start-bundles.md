# Spec: angular-examples: build check that @wolsok/loading-wave/shaders stays out of the start bundles ([#3278](https://github.com/WolfSoko/wol-sok-mono/issues/3278))

## Goal

The five built-in shaders of `@wolsok/loading-wave` sit in its secondary
entry `@wolsok/loading-wave/shaders` (`libs/public/ws-loading-wave/src/shaders.ts`,
#3272 step 2, PR #3277), so that only the lazy playground
(`/loadingWavePlayground`) loads them. Nothing enforces that today. The
production build of `angular-examples` gets a check that fails when the
shaders' sources reach a script the shell loads at start, as
`tools/bacteria-game/check-lazy-admin.mjs` does for the game's admin area.

## Today

- `angular-examples:build` is the Native Federation builder itself
  (`@angular-architects/native-federation:build`, wrapping `esbuild`); it
  cannot run a command after the build.
- `bacteria-game-remote` splits it: `build-federation` is the federation
  builder, `build` an `nx:run-commands` that depends on it and, in
  `production`, runs `ngsw-config` and `check-lazy-admin.mjs`.
- `check-lazy-admin.mjs` starts at the scripts `index.html` loads and the
  exposed `Routes-*.js`, follows static relative imports (`./x.js`) and reads
  each reached file's source map, failing on a source under
  `libs/features/lazy/bacteria-wars-admin/`. It does not follow bare
  specifiers (`import … from "@wolsok/loading-wave"`), which Native
  Federation resolves at runtime to shared bundles such as
  `_wolsok_loading_wave-<hash>.js`, nor dynamic imports, so it never reaches
  the `bootstrap` chunk that `main.ts` loads behind its async boundary.

## Decisions

1. **One shared module, two small checks.** The traversal and the
   source-map reading move from `check-lazy-admin.mjs` into
   `tools/build-checks/eager-sources.mjs` (`eagerScripts`, `leakedSources`),
   with a `node --test` spec of its own on fixture folders. The game's check
   and the new `tools/angular-examples/check-lazy-shaders.mjs` are thin
   CLIs on it. Reason: the two checks would otherwise copy the same 50
   lines (CLAUDE.md: no copy-paste), and the game's check had no test.
2. **The shell's check follows the shared bundles.** `eagerScripts` takes
   an option `followShared`: a static import or re-export of a bare
   specifier that the build maps to a file of the dist folder counts as a
   reached script. The map is `remoteEntry.json`'s `shared` list
   (`packageName` to `outFileName`; it holds the workspace libs such as
   `@wolsok/loading-wave`) merged with `importmap.json`'s `imports` (the
   npm packages and the `@nf-internal/chunk-*` files). A specifier the map
   lacks is skipped. Reason: in the shell, the app reaches
   `@wolsok/loading-wave` only through that map; an import of
   `@wolsok/loading-wave/shaders` from shell code would reach the shaders'
   bundle the same way.
3. **The shell's check crosses `main.ts`' async boundary.** `main.ts` only
   starts federation and then loads `./bootstrap` with a dynamic
   `import()`, which the build turns into `import("./chunk-….js")` in
   `main-*.js`; everything the shell shows at start sits behind it. With the
   option `crossMainBoundary`, the dynamic imports written in `main-*.js`
   itself count as entries; every other dynamic `import(…)` (lazy routes)
   stays lazy, as today. Reason: without it the check would inspect only
   the federation start-up and miss `app.component.ts`, the very place the
   issue names. The traversal reaches the main `_wolsok_loading_wave-*.js`
   bundle from there, since `app.component.ts` imports the directive; the
   check fails with exit code 2 when that bundle is not among the reached
   scripts, so it cannot pass while inspecting the wrong set. Neither
   option is set for the game's check, so it inspects the same files as
   before (non-goal); that its `bootstrap` chunk goes unchecked is raised
   as a follow-up.
4. **The forbidden sources come from the entry itself.** The check reads
   `libs/public/ws-loading-wave/src/shaders.ts` and takes every module it
   re-exports values from (`export … from './…'`, type-only re-exports left
   out, since types reach no bundle) as the shaders' sources, matched
   against the source maps' `sources` (`../../../libs/…/x.shader.ts`). Reason: a sixth
   shader added to the entry is covered without a change to the check, and
   the default `ripple.shader.ts`, which the main entry exports, is not on
   the list. The check fails with exit code 2 when it finds no re-export, when a
   re-exported module does not exist as a `.ts` file (`./x` and `./x.js`
   both name `x.ts`), or when a source is missing from the shaders' own
   bundle `_wolsok_loading_wave_shaders-*.js` and the chunks it imports
   (esbuild moves code two shared bundles share into an `@nf-internal`
   chunk), so a moved entry or a barrel
   re-export cannot make it match nothing and silently pass.
5. **`build` becomes a wrapper, as in the game.** `angular-examples`'
   federation builder target is renamed `build-federation` (same options,
   inputs, outputs and `dependsOn`, `cache: true`); `build` is an
   `nx:run-commands` depending on it, whose `production` configuration runs
   the check and whose `development` configuration echoes that development
   builds skip it. `build` keeps `defaultConfiguration: production`, so
   `angular-examples-cdk:deploy` (`^build`), `lighthouse` and CI's
   `build -c=ci` (falling back to `production`, as for the game) run the
   check. `federation-shared-singletons:test` reads `remoteEntry.json` from
   its direct dependencies' outputs only, so it also depends on
   `angular-examples:build-federation`, like on the game's.
6. **The check script is no input of `build`.** As for
   `check-lazy-admin.mjs`: a change to it would otherwise redeploy the
   shell (`release-affected.mjs` counts a deploy's dependencies' inputs);
   `tools:test` covers the script instead.
7. **The message names the inspected scripts.** On success the check
   prints how many scripts it inspected and lists them; on a leak it names
   each script and the shader source it holds, and exits 1.

## Non-goals

- No change to the shaders, the directive or the `@wolsok/loading-wave`
  API.
- No change to what `check-lazy-admin.mjs` inspects or reports for
  `bacteria-game-remote`.
- No check for the other remotes or for other lazy libs of the shell.

## Acceptance

1. `npx nx build angular-examples --configuration production` runs the
   check, and on today's code it passes with a message naming the scripts it
   inspected (`main-*.js`, the polyfills, `_wolsok_loading_wave-*.js` among
   them).
2. Importing anything from `@wolsok/loading-wave/shaders` in shell code
   (`apps/angular-examples/src/app/app.component.ts`) makes the production
   build fail, naming the script that now holds shader source.
3. Re-exporting the shaders from the main entry of `@wolsok/loading-wave`
   (`src/index.ts`) makes the production build fail the same way.
4. The playground `/loadingWavePlayground` still loads the shaders lazily
   and runs them as before (its specs and the angular-examples e2e stay
   green; the build output still has `_wolsok_loading_wave_shaders-*.js`,
   imported only from the playground's lazy chunk).
5. `npx nx build bacteria-game-remote --configuration production` still
   passes `check-lazy-admin.mjs` with the same count of inspected scripts as
   before the change.
6. `npx nx test tools` covers `eager-sources.mjs`: static relative
   imports followed, dynamic imports not (but those of `main-*.js` with
   `crossMainBoundary`), shared bundles followed only with `followShared`,
   a missing source map reported, a leak reported with script and source;
   the shaders check's reading of `shaders.ts` too.

## Open questions

None.
