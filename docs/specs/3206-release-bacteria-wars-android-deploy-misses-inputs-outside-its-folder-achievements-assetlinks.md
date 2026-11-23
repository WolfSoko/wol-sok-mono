# #3206 — bacteria-wars-android deploy misses inputs outside its folder

## Goal

A change to a file outside `apps/bacteria-wars-android/` that the Android
deploy reads makes the app affected, so the next release uploads it to Play
with the current achievements, package name, tips and listing logic. The
exemption of `bacteria-wars-android` in `tools/ci/deploy-inputs.test.mjs`
goes, and a guard keeps the list in step with what the deploy reads.

## Background

`bacteria-wars-android:deploy` (`tsx --tsconfig tools/tsconfig.tools.json
./tools/bacteria-game/deploy-android.ts`) declares no `inputs` and has no Nx
dependencies, so it reads `default`: only `apps/bacteria-wars-android/**`.
Outside that folder it reads:

| File                                                                                | Read by                                                       |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/bacteria-game-remote/src/.well-known/assetlinks.json`                         | `deploy-android.ts` (package name) and `app/build.gradle.kts` |
| `libs/features/bacteria-engine/src/lib/state/progress/play-games-achievements.json` | `play-games.ts` (achievement sync)                            |
| `tools/bacteria-game/deploy-android.ts`                                             | the command itself: bundle, listing, video and track upload   |
| `tools/bacteria-game/play-games.ts`                                                 | achievement sync                                              |
| `tools/bacteria-game/play-tips.ts`                                                  | in-app products (tips)                                        |
| `tools/youtube/youtube.ts`                                                          | promo video upload                                            |
| `version.json`                                                                      | version code (`@wolsok/utils-version`, Gradle)                |

Measured on `main` with the inputs added (`nx show projects --affected
--files=<file>` and `release-affected.mjs --files=<file> --target=deploy`):
Nx does count a target input outside the project, so naming the files makes
the app affected for each of them; `--files=tools/bacteria-game/play-games.ts`
selects `bacteria-wars-android` alone.

## Decisions

1. **Inputs by name in the app's `project.json`:** `"inputs": ["production",
   "{workspaceRoot}/…"]` with the six files of the table above except
   `version.json`. `production` rather than `default`, as every other deploy
   reads: the app has no specs today, and a test config added later stays out.
   No `^production`: the app has no Nx dependencies, and `implicitDependencies`
   on the engine or the remote would count all their files, not the one each.
2. **`version.json` stays out:** every release bumps it, so as an input it
   would upload the app to Play on every release. The version code follows
   the release that deploys the app for another reason, as today.
3. **The deploy's own modules count:** `deploy-android.ts`, `play-tips.ts`
   and `youtube.ts` decide what reaches Play (bundle, listing, tips, videos)
   as much as `play-games.ts` decides the achievements; a fix in one of them
   otherwise waits for the next app change. The Hosting deploys' helpers
   (`retry-once.ts`, `check-live-index.ts`) stay out of theirs: they change
   how a deploy runs, not what it deploys.
4. **Guard derived from the script, in `deploy-inputs.test.mjs`:** a test
   follows `deploy-android.ts`' relative imports (transitively) and collects
   the workspace paths its modules name as string literals (`apps/…`,
   `libs/…`, `tools/…` with a file extension); each module and each path
   outside `apps/bacteria-wars-android/` must be a `{workspaceRoot}/…` input
   of the deploy. So a new import or a new file the deploy reads fails the
   test until it is named. The exemption `IMPLICIT_DEPLOY_INPUTS` and its
   "exempt only deploy targets that exist" test go; the app now falls under
   "are declared by every deploy target".
5. **CLAUDE.md:** the "Deploy inputs" paragraph loses the Android exemption
   and names its inputs and the guard; the Android App section says that a
   file outside the app the deploy reads goes into the inputs.

## Non-goals

- `version.json` as an input (see decision 2).
- A generic guard for the tools scripts of every deploy command (decision 3).
- The Gradle build (`apk`, `bundle`, `lint-android`) targets: CI does not
  run them through Nx.

## Acceptance

1. `node tools/ci/release-affected.mjs --files=<file> --target=deploy`
   selects `bacteria-wars-android` for each of the six files in decision 1.
2. It does not select it for
   `libs/features/bacteria-engine/src/lib/state/progress/play-games-achievements.spec.ts`
   nor for `version.json`.
3. `apps/bacteria-wars-android/store/tips.json` still selects it.
4. `npx nx test tools` is green; it fails when one of the six inputs is
   removed from the deploy, and when the deploy's inputs are removed.
5. `IMPLICIT_DEPLOY_INPUTS` is gone from `deploy-inputs.test.mjs`.

## Open questions

None. The `project.json` edit uploads the unchanged app to Play once with the
release of this change, as the issue notes.
