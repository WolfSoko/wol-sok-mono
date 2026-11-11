# Spec #2884: Analog apps: self-host Inter, fix server.fs.allow, editor tsconfig and nxViteTsPaths

Issue: [#2884](https://github.com/WolfSoko/wol-sok-mono/issues/2884), found
while building Korbjäger ([PR #2876](https://github.com/WolfSoko/wol-sok-mono/pull/2876),
[#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861)). Related:
[PR #2699](https://github.com/WolfSoko/wol-sok-mono/pull/2699), which
self-hosted the game's fonts.

## Goal

The three Analog apps (`pacetrainer`, `rollapolla-analog`, `korbjaeger`) and
the Vitest libs are set up alike and ready for Nx 24:

1. Pacetrainer loads Inter from its own build (Fontsource), nothing from
   Google Fonts, as `CLAUDE.md` asks of every app.
2. The dev server allows the workspace root, so it serves the Fontsource
   files and the libs, in all three apps from one helper.
3. Rollapolla's `tsconfig.editor.json` includes its TypeScript files, so
   type-aware oxlint sees `src/server/**` and the configs.
4. No Vite config uses the deprecated `nxViteTsPaths` (removed in Nx 24).

## Findings (checked on `main`, 412e9f7)

- `apps/pacetrainer/index.html` preconnects to `fonts.googleapis.com` and
  `fonts.gstatic.com` and loads Inter 400/600/700/800 from Google Fonts.
  `rollapolla-analog` (Plus Jakarta Sans) and `korbjaeger` (Roboto, Barlow
  Condensed) already use Fontsource; the issue's item 1 applies to
  pacetrainer only.
- `server.fs.allow: ['.']` in pacetrainer's and rollapolla's `vite.config.ts`;
  korbjaeger allows `workspaceFile('.')`, an inline helper.
- `tsc -p apps/rollapolla-analog/tsconfig.editor.json --listFilesOnly` lists
  no file of the app: TypeScript's `include` knows only `*`, `?` and `**/`,
  so `**/*.(m)ts` matches nothing. Its `src/server/**` sits in no other
  tsconfig either (`tsconfig.app.json` takes the entries, pages and routes).
  Pacetrainer's editor tsconfig (`**/*.ts`) works: it lists 51 files,
  `src/server/routes/v1/hello.ts` among them. Korbjäger has its
  `tsconfig.server.json` and a working editor tsconfig.
- `nxViteTsPaths` is marked `@deprecated Will be removed in Nx v24` in
  `@nx/vite` 23.3.1 and is used by ten Vite configs: the three Analog apps,
  `korbjaeger`'s `vite.emulator.config.ts` and the libs `shared/data-access`,
  `shared/analytics`, `public/spa-cdk-stack`, `features/korbjaeger-auswahl`,
  `features/korbjaeger-antworten`.

## Non-goals

- No upgrade to Nx 24 (#1051).
- No new font, weight or subset beyond what Google served pacetrainer before,
  limited to Latin as `CLAUDE.md` asks; no visual change.
- No `tsconfig.server.json` for pacetrainer or rollapolla: a working editor
  tsconfig already puts their server code in front of type-aware oxlint.
- Nitro's own aliases (`tools/vite/nitro-ts-path-aliases.ts`) stay: Nitro
  bundles the server without Vite's resolver.

## Decisions

- **Inter from `@fontsource/inter`** (5.3.0, the version line of the other
  Fontsource packages), Latin subset, weights 400, 600, 700 and 800, imported
  at the top of `apps/pacetrainer/src/styles.scss` like rollapolla's; the
  Google `<link>`s and preconnects leave `index.html`. Pacetrainer has no
  privacy policy, so no text changes with it.
- **A spec keeps it**: `apps/pacetrainer/src/self-hosted-fonts.spec.ts` fails when
  `index.html` names `fonts.googleapis.com` or `fonts.gstatic.com`, and when
  `styles.scss` no longer imports `@fontsource/inter`.
- **One helper for the workspace root**: `tools/vite/workspace-file.ts`
  exports `workspaceFile(path)`, the absolute path of a workspace file, which
  all three Analog configs take for `server.fs.allow` (korbjaeger also for its
  build-configuration output). Vite configs import it by relative path, since
  they cannot resolve `@wolsok/*` (as `nitro-ts-path-aliases.ts`).
  `nitro-ts-path-aliases.ts` takes its root from it too.
- **Rollapolla's editor include becomes `["**/*.ts", "**/*.mts"]`**, as
  Korbjäger's (which adds `*.cts`). Type errors it then shows in the server
  code are fixed in this PR; if they turn out large, they go to the manager
  as a follow-up instead.
- **Vite's own `resolve.tsconfigPaths: true` replaces `nxViteTsPaths`**
  everywhere, rather than adding `vite-tsconfig-paths` (the deprecation's
  suggestion): Vite 8.3 resolves tsconfig paths itself, so no new dependency.
  Each project's `tsconfig.json` extends `tsconfig.base.json`, where the
  `@wolsok/*` paths are. Checked on `feat-korbjaeger-antworten`: its specs
  pass with it (33 tests). The libs are in scope although the issue names the
  apps: Nx 24 breaks every user alike, and the migration is the same line.
  Comments naming `nxViteTsPaths` (`nitro-ts-path-aliases.ts`, `CLAUDE.md`
  if any) are updated.

## Acceptance

1. `apps/pacetrainer/index.html` and the built `dist/apps/pacetrainer` name
   no `fonts.googleapis.com` / `fonts.gstatic.com`; the build ships Inter's
   `woff2` files and the page renders in Inter (checked in the running app).
2. `nx serve pacetrainer` serves the Fontsource files (no 403 from
   `server.fs.allow`); `nx serve rollapolla-analog` likewise.
3. `tsc -p apps/rollapolla-analog/tsconfig.editor.json --listFilesOnly`
   lists `src/server/**` files; `nx lint rollapolla-analog` passes.
4. `grep -r nxViteTsPaths apps libs tools` finds nothing; build, test, lint
   and lint-templates pass for every affected project, and the e2e of the
   three apps passes in CI.
5. The new spec fails against the old `index.html`.

## Open questions

None.
