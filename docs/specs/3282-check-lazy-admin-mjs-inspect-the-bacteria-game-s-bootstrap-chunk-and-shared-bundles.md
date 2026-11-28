# Spec: check-lazy-admin.mjs: inspect the bacteria game's bootstrap chunk and shared bundles ([#3282](https://github.com/WolfSoko/wol-sok-mono/issues/3282))

## Goal

`tools/bacteria-game/check-lazy-admin.mjs` ends `bacteria-game-remote`'s
production `build` and should fail when a script every visitor loads at
start holds the owner's admin area (`libs/features/lazy/bacteria-wars-admin/`,
ADR 0012). It should inspect everything the game loads at start: the
bootstrap chunk behind `main.ts`' `import('./bootstrap')` and the shared
bundles reached through bare specifiers, not only `main`, the polyfills and
`Routes`.

## Today

- `apps/bacteria-game-remote/src/main.ts` calls `initFederation()` and then
  `import('./bootstrap')`. The check (on top of #3278) calls
  `eagerScripts(dist, { extraEntries: routes })` from
  `tools/build-checks/eager-sources.mjs` with neither `crossMainBoundary` nor
  `followShared`, so it sees the federation start-up and `Routes`, but not
  `bootstrap.ts`, `app.config.ts`, `app.routes.ts` or anything they import,
  nor a shared bundle (`_wolsok_*.js`, `@nf-internal/chunk-*`). A static
  import of the admin lib from `app.config.ts` would stay unnoticed.
- The check has no spec of its own; `eager-sources.test.mjs` covers the
  traversal.
- Its success line names only the number of scripts.

## Decisions

1. **Turn on both options.** `eagerScripts(dist, { extraEntries: routes,
   followShared: true, crossMainBoundary: true })`. `crossMainBoundary`
   follows only the dynamic imports of `main-*.js` itself (the bootstrap
   chunk); dynamic imports further down, such as the lazy `/admin` route,
   stay lazy. `followShared` resolves bare specifiers through
   `remoteEntry.json` and `importmap.json`, which the game's federation
   build writes. Reason: that is what the game loads at start on its own
   site; inside the shell the shell's shared bundles stand in for the
   game's, and the admin lib and the game lib are skipped in
   `workspace-federation.js`, so they are never a shared bundle.
2. **Prove the traversal reached the bootstrap chunk.** The check exits 2
   when no inspected script's source map names
   `apps/bacteria-game-remote/src/bootstrap.ts`. Reason: as with the
   shell's check of #3278 (which asserts its main shared bundle was
   reached), a check that silently stops following the boundary, say after
   a change to `main.ts` or to the builder's output, would otherwise stay
   green while inspecting the old, smaller set.
   In the same way it exits 2 when no inspected script is a shared bundle
   (`sharedBundles(dist)`), which happens when the build maps no bare
   specifier (added after the review).
3. **Name the inspected scripts.** Both the success and the failure message
   list what was inspected (success: every script; failure: each
   `script: source` leak, as today). Reason: acceptance 1; it also lets a
   reader of the build log see the set at a glance, as the shell's check
   prints it.
4. **Shape it like the shell's check.** `checkLazyAdmin(dist)` returns the
   exit code and is exported; the CLI part runs only when the file is the
   entry (`import.meta.url` check), so a new
   `tools/bacteria-game/check-lazy-admin.test.mjs` (`node:test`, fixtures
   from `tools/build-checks/dist-fixture.mjs`) covers it. The `tools`
   project's `test` runs every `tools/**/*.test.mjs`, so no target changes.
5. **CLAUDE.md** says what the check inspects (the admin-area bullet of
   "Native Federation"), since it names `main`, the polyfills and `Routes`
   today.

## Non-goals

- No change to the admin area or how the game loads it.
- No change to `eager-sources.mjs` or to `check-lazy-shaders.mjs` (#3278).
- No change to the build targets: the check stays the last command of
  `build:production`.

## Acceptance

1. The check follows `main.ts`' `import('./bootstrap')` and the shared
   bundles reached through bare specifiers; its message names the scripts
   it inspected. (Spec cases on fixtures, and the real build's log.)
2. A deliberate eager import of the admin lib from
   `apps/bacteria-game-remote/src/app/app.config.ts` makes
   `bacteria-game-remote:build:production` fail with exit 1, naming the
   script that holds the admin. (Checked by hand, then reverted.)
3. On today's code, `bacteria-game-remote:build:production` stays green.
4. `npx nx test tools` is green, including the new spec: admin reached
   through the bootstrap chunk fails, admin reached through a shared bundle
   fails, admin behind a dynamic import of the bootstrap chunk passes, a
   build whose scripts never name `bootstrap.ts` exits 2.

## Open questions

- #3278 (PR #3283) is not merged yet. This work is built on its branch and
  its PR targets `main` once #3283 has merged (rebased onto `main` then).
