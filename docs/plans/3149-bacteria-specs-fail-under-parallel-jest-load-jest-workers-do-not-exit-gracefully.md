# Plan: Bacteria specs fail under parallel Jest load

Spec: [3149](../specs/3149-bacteria-specs-fail-under-parallel-jest-load-jest-workers-do-not-exit-gracefully.md)

## Task 1: hour test without the slow deep equality

- File: `libs/features/bacteria-engine/src/lib/state/replay/replay-pack.spec.ts`.
- Add `HOUR_TIMEOUT_MS = 30_000` and pass it to the hour test.
- Replace `toEqual(hour)` on the replay read back with `toEqual` on its header and a
  `JSON.stringify` comparison of its inputs.
- Check: `npx jest --config libs/features/bacteria-engine/jest.config.ts <spec>` green and
  under 5 s for the test; break `unpackReplay` by hand once (drop a steer) to see it go red.

## Task 2: local replays answer the storage until the work is done

- File: `libs/features/lazy/bacteria-game/src/lib/storage/local-game-replays.spec.ts`.
- Replace `settle()` with `answered(work)`, which flushes `LateGameStorage` on every turn
  until `work` settles, then once more. Route `submitted`, `listed`, `rewriteStored`,
  `replayBytes` and `sendCommand` through it.
- Check: the spec green, also under 20 busy loops.

## Task 3: one shared `settleUntil` for the component specs

- New file: `libs/features/lazy/bacteria-game/src/testing/settle-until.ts`, holding
  `settleTurn(fixture)` and `settleUntil(fixture, ready, what, limitMs = 3_000)`, moved from
  `my-matches.component.spec.ts`.
- `my-matches.component.spec.ts`: import them, drop its own copies.
- `watch-page.component.spec.ts`: `open()` settles until the viewer or the page's message
  shows, through `settleUntil`; drop the fixed five-turn `settle()` where it waited for a
  load.
- Check: both specs green; `npx nx run feat-lazy-bacteria-game:typecheck-specs`.

## Task 4: verify and commit

- Three runs of `npx nx run-many -t test -p feat-shared-bacteria-engine feat-lazy-bacteria-game --skip-nx-cache`.
- `npx nx format:write`, `npx nx affected -t lint,lint-templates,typecheck-specs --base=origin/main`.
- One commit with spec, plan and tasks 1–3:
  `fix(feat-lazy-bacteria-game): wait for the work in timing-sensitive bacteria specs (#3149)`.
- PR to `main` with `Closes #3149`; the oversubscription question goes to the manager as a
  `follow_up`.
