# Plan: Vorlauf's first beep sounds about 50 ms after the opening Ansage ([#3110](https://github.com/WolfSoko/wol-sok-mono/issues/3110))

Spec: [docs/specs/3110-…](../specs/3110-pacetrainer-vorlauf-first-beep-sounds-about-50-ms-after-the-opening-ansage.md).
One PR, each task test first. Tasks 1 to 3 change what `countdownTime` means
and its one caller, so they go into one commit, never split.

## 1. The cue model clips the window by the lead

- Files: `apps/pacetrainer/src/app/shared/interval-countdown/countdown-cue.ts`,
  `countdown-cue.spec.ts`, `shared/model/training/countdown.model.ts` (doc of
  `countdownTime`).
- Tests first in `countdown-cue.spec.ts`: a 5000 ms countdown announces
  second 4 from 4999 ms and is silent at 5000 ms; a 3000 ms one announces
  second 2; a 6000 ms and a 60000 ms one keep the five-second window; a
  1000 ms one says only the start cue at 999 ms; the old "window shorter than
  the lead" case becomes "a countdown under two seconds only starts".
- Code: export `ANNOUNCEMENT_WINDOW`, add `announcedSeconds(countdownTime)`,
  check `start` before `announcement` in `cueKindOf`.
- Commit (tasks 1 to 3): `fix(pacetrainer): leave every Ansage a lead before its first beep`.

## 2. The component passes the countdown's length

- Files: `features/sprint-training/sprint-training.component.ts` and its spec.
- Test first: a running Intervall of 10 s feeds `countdownTime` 10000, not 5000.
- Code: drop the component's `ANNOUNCEMENT_WINDOW` and `Math.min`, pass
  `run.current.duration`.
- Commit: with task 1.

## 3. Service spec for the Vorlauf

- File: `shared/interval-countdown/interval-countdown.service.spec.ts`.
- Test: tick a 5000 ms Vorlauf every 50 ms and record when each sound plays;
  expect `[440, 880, 880, 880, 660]`, the texts "Sprinten in 4 Sekunden!" and
  "Jetzt Sprinten!", and no two sounds closer than 950 ms.
- Commit with task 1.

## 4. Checks

`npx nx format:write`, `npx nx test pacetrainer`, `npx nx lint pacetrainer
--fix`, `npx nx lint-templates pacetrainer --fix`,
`npx nx typecheck-specs pacetrainer`.
