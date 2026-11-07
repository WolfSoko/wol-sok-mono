# Plan: one source for the replay playback refusals

Spec: [`docs/specs/2813-one-source-for-the-replay-playback-refusals-playbackrefusal-replay-in-state-replay-ts.md`](../specs/2813-one-source-for-the-replay-playback-refusals-playbackrefusal-replay-in-state-replay-ts.md).

Precondition: [PR #2800](https://github.com/WolfSoko/wol-sok-mono/pull/2800)
(`replayVerdict`) is on `main`. The branch starts from that `main`.

## Tasks

1. **`playbackRefusal` in `replay.ts`, test first.**
   - Test: `state/replay.spec.ts`, a table of tampered headers of a recorded
     match, each with its refusal (spec acceptance 1), and `null` for the
     match itself. Red first.
   - Code: `PlaybackRefusal` and `playbackRefusal` in `state/replay.ts`;
     `canPlayBack` becomes `playbackRefusal(replay) === null`; its doc comment
     points to `playbackRefusal`. Export both from `src/index.ts`.
   - Check: `npx nx test feat-shared-bacteria-engine` (the existing
     `canPlayBack` spec and the goldens unchanged).
   - Commit: `refactor(feat-shared-bacteria-engine): name why a replay does not play back`.
2. **`replayVerdict` asks `playbackRefusal`.**
   - Test: `state/replay-verdict.spec.ts` gets the case "another balance table
     and the float GPU" (`balance-mismatch`, not played) and a ladder case
     (`unplayable`); the existing cases stay as they are.
   - Code: `replay-verdict.ts` calls `playbackRefusal` and drops its
     `BALANCE_VERSION` import.
   - Check: engine and `bacteria-wars-functions` tests.
   - Commit: `refactor(feat-shared-bacteria-engine): replayVerdict takes its refusals from playbackRefusal`.
3. **Docs and checks.** Name `playbackRefusal` beside `canPlayBack` in the
   game lib's `CLAUDE.md`; `npx nx format:write`,
   `npx nx affected -t lint,lint-templates,test`. Spec and plan go into the
   first commit.
