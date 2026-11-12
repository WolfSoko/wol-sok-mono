# Spec #3058: Release deploy shipped a stale korbjaeger build from the Nx remote cache; deploy.yml has no way to skip the cache

Issue: [#3058](https://github.com/WolfSoko/wol-sok-mono/issues/3058). Release
`v74.167.3`, run [43089119803](https://github.com/WolfSoko/wol-sok-mono/actions/runs/43089119803),
head `466b130`, which carries [#3055](https://github.com/WolfSoko/wol-sok-mono/pull/3055).

## What the investigation found

The issue's leads, checked on 2026-11-12:

1. **The cache key covers what `korbjaeger:build-app` reads.**
   `nx show target inputs korbjaeger:build-app --check` lists
   `tools/vite/workspace-file.ts`, `tools/vite/nitro-ts-path-aliases.ts`
   (Nx sees the edge `korbjaeger → tools-vite`), `tsconfig.base.json`,
   `.browserslistrc` and `apps/korbjaeger/vite.config.ts` as inputs; npm
   packages are hashed through the project graph. Built with an isolated
   local cache, `82c4d4c` (before #3055) and then `466b130` gave a cache miss.
   The production build writes nothing into `node_modules/.vite` or
   `.angular/cache`.
2. **The cache entry the release took is correct.** In the run's `main` job
   `korbjaeger:build-app:production` was a cache miss, built on an Nx Cloud
   agent at 19:45 UTC, emitting `club-page.component-CyEddOKk.js`. The deploy
   job restored that entry (`Remote Cache Hit`). The chunk, still served by
   korb.wolsok.de today, holds #3055's code ("Im Kader seines letzten Spiels
   markierst du dein Kind.", `checkedChildStep`) and is identical to a fresh
   `--skip-nx-cache` build of `466b130` except for the hashed names it imports.
3. **Chunk names are not comparable across machines.** The same sources built
   here give `club-page.component-BziOXJ-F.js`: a shared chunk differs by one
   environment-dependent line (`ngServerMode`), and the hash propagates. A
   local `--skip-nx-cache` build naming a chunk differently from the cache
   entry therefore does not show the entry is stale.
4. **What did not happen is the Hosting release.** Firebase Hosting's
   `last-modified` equals the moment a deploy finished: korb.wolsok.de 19:26:51
   (`korbjaeger:deploy` of `82c4d4c` ended 19:26:51), 10:29:38 today (ended
   10:29:39), rollapolla.com 20:03:11 (ended 20:03:12). `korbjaeger:deploy` of
   `v74.167.3` ended 20:01:10 after 20 s (1m 29s and 1m 19s for the other
   two), yet the site kept 19:26:51 until today's release redeployed the very
   same cache entry. So the bundle in the cache was right and its Hosting
   release went missing or was not taken. Why cannot be read from the log:
   `nx run-many` prints only "Output of 26 successful tasks were not shown",
   so the Firebase CLI's lines (files uploaded, `release complete`) are gone.
5. **pacetrainer, rollapolla-analog, bacteria-game-remote:** rollapolla.com
   shows 20:03:11, its deploy of `v74.167.3`; pacetrainer and the game were
   redeployed since (09:50 and 10:28 today), so they are current now.

## Goal

- A release's deploy log shows what each deploy did, so the next missing
  release is visible and diagnosable.
- A release can be redeployed by hand, whatever the deploy tags say and
  without the Nx cache, for chosen projects.

## Non-goals

- Changing `build-app`'s inputs: point 1 shows they are complete, and point 2
  that the entry was right. Widening them (say `sharedGlobals`) would only cost
  cache hits.
- Finding why Firebase took no release on 2026-11-11: without its output, and
  without access to the `korbjaeger` project's Hosting history from a cloud
  session, it is not knowable now. The visible log makes the next one so.
- An automatic post-deploy check that the live site serves the build
  (comparing the deployed `index.html` with `dist/`): a follow-up, raised to
  the manager.

## Decisions

- **`--output-style=static` on the `Deploy Apps` and the npm `Build`/`Publish`
  run-many calls** in `deploy.yml`: Nx then prints every task's output, the
  Firebase CLI's included. `stream` interleaves parallel tasks line by line;
  `static` prints each task's block whole once it ends, which reads better for
  six parallel deploys.
- **Two `workflow_dispatch` inputs in `deploy.yml`**, ignored by the
  `workflow_call` from `release.yml`, which never passes them:
  - `skip-cache` (boolean, default `false`): sets `NX_SKIP_NX_CACHE=true` for
    the whole job, so every build reruns.
  - `projects` (string, default empty): a comma-separated list of projects to
    deploy instead of the selection since the last deploy tag. Each leg keeps
    only those of its kind (`nx show projects --projects=<list>
    --exclude=<the leg's pattern>`), so `korbjaeger` runs in the `non-cdk` leg
    only and the other legs skip. Needed because a re-run or dispatch for a tag
    that already has `<version>-non-cdk-deployed` selects nothing.
- **No deploy tag for a `projects` override**: the tag says "everything that
  changed up to here is deployed", which a chosen subset does not prove. A
  dispatch without the override that finds its tag already set (a second
  deploy of the same version) skips the tagging instead of failing on
  `git tag`.

## Acceptance

1. `deploy.yml` has the inputs `skip-cache` and `projects` on
   `workflow_dispatch`; `release.yml`'s call still passes only `version`.
2. With `skip-cache`, the job's env holds `NX_SKIP_NX_CACHE=true`; without it,
   nothing changes.
3. With `projects=korbjaeger`, the `non-cdk` leg deploys `korbjaeger` only and
   the `npm-packages`, `android` and `cdk` legs select nothing and skip.
4. With `projects`, no deploy tag is created; without it, a tag that already
   exists is left as it is and the step succeeds.
5. Every `nx run-many`/`nx release publish` call in `deploy.yml` prints its
   tasks' output (`--output-style=static`).
6. A spec in `tools/ci/` (run by `npx nx test tools`) keeps 1, 2, 4 and 5 and
   checks the leg filter of 3 against the workflow's own exclude patterns.
7. `CLAUDE.md`'s "What a release deploys" names the inputs.

## Open questions

- Should `skip-cache` also be offered on `release.yml`'s automatic path? Not
  proposed: the cache entry was right, so a release has no reason to skip it.
