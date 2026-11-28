# Plan: angular-examples: build check that @wolsok/loading-wave/shaders stays out of the start bundles ([#3278](https://github.com/WolfSoko/wol-sok-mono/issues/3278))

Spec: [`docs/specs/3278-…`](../specs/3278-angular-examples-build-check-that-wolsok-loading-wave-shaders-stays-out-of-the-start-bundles.md).
Branch `3278-loading-wave-shaders-build-check` off `main`, one PR.

## Tasks

1. **Shared traversal, test first.**
   - `tools/build-checks/eager-sources.test.mjs`: fixture dist folders
     written into a temp dir (`index.html`, scripts, `.map` files,
     `remoteEntry.json`, `importmap.json`). Cases: static relative imports
     and re-exports followed; `import("./x.js")` not followed, except in
     `main-*.js` with `crossMainBoundary`; a bare specifier followed only
     with `followShared`, through `remoteEntry.json` and `importmap.json`,
     unknown ones skipped; external `src` URLs in `index.html` ignored;
     `leakedSources` returns `file: source` pairs and names scripts without
     a source map.
   - `tools/build-checks/eager-sources.mjs`: `eagerScripts(dist,
     { extraEntries, followShared, crossMainBoundary })` and
     `leakedSources(dist, scripts, isForbidden)`, carrying the code of
     `check-lazy-admin.mjs`.
   - Commit: `feat(tools): shared traversal of a build's eagerly loaded scripts (#3278)`.
2. **Game check on the shared module.** `check-lazy-admin.mjs` becomes a
   thin CLI on it (entries: `Routes-*.js`; no option), same messages and
   exit codes. Verify: `npx nx build bacteria-game-remote -c production`
   prints the same count of inspected scripts as before.
   - Commit: `refactor(tools): check-lazy-admin on the shared eager-sources module (#3278)`.
3. **Shaders check, test first.**
   - `tools/angular-examples/check-lazy-shaders.test.mjs`: `shaderSources()`
     reads the real `shaders.ts` and finds the five shader files and not
     `ripple.shader.ts`; on a fixture dist the check passes, fails with
     exit 1 naming script and source on a leak, and exits 2 when the main
     loading-wave bundle is not reached.
   - `tools/angular-examples/check-lazy-shaders.mjs`: CLI with
     `followShared` and `crossMainBoundary`, the success message listing
     the inspected scripts.
   - Commit: `feat(tools): check that the loading-wave shaders stay lazy in angular-examples (#3278)`.
4. **Wire it into the build.**
   - `apps/angular-examples/project.json`: the federation `build` becomes
     `build-federation` (`cache: true`); new `build` (`nx:run-commands`,
     `dependsOn: ["build-federation"]`, `production` runs the check,
     `development` echoes). `serve-file` and `extract-i18n` keep pointing
     at `build` (the dist folders stay the same).
   - `tools/federation/shared-singletons/project.json`: `dependsOn` also
     `angular-examples:build-federation`.
   - CLAUDE.md: the Native Federation section names the shell's
     `build-federation` and the check beside the game's.
   - Verify: `npx nx build angular-examples -c production` (acceptance 1),
     then by hand the two failing cases (acceptance 2 and 3, reverted);
     `npx nx run federation-shared-singletons:test`; `nx show project
     angular-examples` for the `ci` configuration falling back.
   - Commit: `feat(angular-examples): production build checks that the loading-wave shaders stay lazy (#3278)`.
5. **Checks before the PR.** `npx nx format:write`, `npx nx test tools`,
   `npx nx affected -t lint,lint-templates,test,typecheck-specs`,
   the playground's spec and the angular-examples e2e for
   `/loadingWavePlayground` (acceptance 4). Results into the PR
   description.
