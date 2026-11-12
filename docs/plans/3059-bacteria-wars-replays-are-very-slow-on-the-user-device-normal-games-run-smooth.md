# Plan 3059 — GPU playback for gallery replays in `/watch`

Spec: [docs/specs/3059-bacteria-wars-replays-are-very-slow-on-the-user-device-normal-games-run-smooth.md](../specs/3059-bacteria-wars-replays-are-very-slow-on-the-user-device-normal-games-run-smooth.md)

All paths below are in `libs/features/lazy/bacteria-game/src/lib/`.

1. **Extract the stored self-test** into `gl/stored-self-test.ts`:
   `GPU_SELF_TEST_STORAGE_KEY`, `StoredSelfTest`, `SelfTestDevice`,
   `SELF_TEST_MAX_AGE_MS`, `parseStoredSelfTest`, `storedResultHolds`,
   `thisDevice`, and a new `storedSelfTestOf(result, device, now)` (the record)
   and `verdictOf(stored)`. `gpu-self-test.service.ts` imports them and
   re-exports what others import today. Tests: move the parser/holds specs
   into `gl/stored-self-test.spec.ts`; service specs unchanged.
   Commit: `refactor(feat-lazy-bacteria-game): stored GPU self-test in a module of its own`.
2. **Watch page GPU source** `replays/watch-gpu.ts`: `watchPageGpu(options)`
   reads the stored verdict with `readStoredJson`, returns a signal of the
   trusted renderer; without a holding verdict it schedules the self-test on
   idle (only when asked, for a `gpu-int` replay) and writes the record with
   `writeStoredJson`. Injectable functions (run, schedule, now, storage) for
   specs. Tests first: `replays/watch-gpu.spec.ts` for acceptance 1 to 3.
3. **Wire it into `WatchPageComponent`**: `[gpu]` on the viewer from the
   source, started once the replay is loaded and only for `gpu-int`. Add the
   new file to the watch-entry oxlint override's `files`. Spec in
   `watch-page.component.spec.ts`. Commit:
   `fix(feat-lazy-bacteria-game): play gallery replays on a trusted GPU in /watch`.
4. **Docs**: the lib's `CLAUDE.md` replay section (`/watch` now reads or runs
   the self-test).
5. **Checks**: `nx format:write`, `nx affected -t lint,lint-templates,test`,
   `nx run feat-lazy-bacteria-game:typecheck-specs`,
   `nx build bacteria-game-remote -c production`.
