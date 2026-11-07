# Game lib specs typecheck, and CI keeps them so

Issue: [#2815](https://github.com/WolfSoko/wol-sok-mono/issues/2815), found while working on [#2777](https://github.com/WolfSoko/wol-sok-mono/issues/2777).

## Goal

Jest runs the game lib's specs transpile-only, so fakes and calls in them drift from the real types unnoticed. `npx tsc -p libs/features/lazy/bacteria-game/tsconfig.spec.json --noEmit` reported 33 errors on `afefac4` and 23 on `34a5077` (today's `main`). Fix every one in the spec code itself, then add a `typecheck-specs` target to `feat-lazy-bacteria-game` that CI runs on every affected change, so they cannot drift again.

## Non-goals

- No change to the lib's production code or types to make a spec compile: where a spec and a type disagree, the spec follows the type (the type is what ships). A real bug a stale spec hid gets fixed only if it is found, and named in the PR.
- No workspace-wide typecheck of every project's specs: other projects may carry errors of their own; that goes to the manager as a follow-up, not into this PR.
- Jest stays transpile-only (`isolatedModules`): turning on ts-jest's type checking would slow every test run and duplicate the new target.

## Decisions

- **A target named `typecheck-specs`**, not `typecheck`: `@nx/vite` already infers a `typecheck` on five projects (`pacetrainer`, `rollapolla-analog`, `shared-analytics`, `shared-data-access`, `spa-cdk-stack`) that checks their lib or app sources, not the specs, and putting that name into CI's list would start those too. It is `nx:run-commands` with `tsc -p {projectRoot}/tsconfig.spec.json --noEmit`. `tsconfig.spec.json` already includes the specs, `src/testing/`, `gpu-crosscheck/`, `perf/` and the configs, and through their imports the lib's sources, so one run covers all code Jest and Playwright run.
- **Its defaults live in `nx.json` `targetDefaults["typecheck-specs"]`** (cached; inputs `default`, `^production`, `{workspaceRoot}/tsconfig.base.json` and the external `typescript`; no outputs), so another project gets the same check with a one-line target later.
- **CI runs it** through the existing `nx affected -t=...` list in `.github/workflows/ci-cd.yml`, so a change to the game lib or anything it imports (the engine included) re-checks the specs. About 30 s locally, on the Nx Cloud workers in parallel with the rest.
- **Fixes follow the types:**
  - stale fakes get the fields the real types have now (`OnlineStart.ruleset`, the arena scene's content, `PlayerSwitch` in `FakeGameAccount`, the level preview renderer);
  - calls with a changed signature pass what the function takes now (`shape-batch.spec`, `progress.service.spec`);
  - index-signature access uses brackets or a typed fake (`game-sound.service.spec`);
  - nullable values the spec relies on are narrowed by a check that fails the test, not by `!`;
  - the thanos `vaporize$` mock returns an `Observable<AnimationState>` as the real one does (`arena-stage.spec`).
- **`CLAUDE.md` Testing** names the target, so the next session runs it after a type change.

## Acceptance

1. `npx tsc -p libs/features/lazy/bacteria-game/tsconfig.spec.json --noEmit` reports 0 errors.
2. `npx nx typecheck-specs feat-lazy-bacteria-game` exists, runs that check and fails on a deliberately introduced spec type error (checked once by hand, not committed).
3. `.github/workflows/ci-cd.yml` runs `typecheck-specs` among the affected targets; the PR's CI run shows it for `feat-lazy-bacteria-game`.
4. `npx nx test feat-lazy-bacteria-game` passes with the same number of tests as on `main`.
5. Lint, template lint and format pass on the changed files.
6. `CLAUDE.md` Testing names the `typecheck-specs` target.

## Open questions

None.
