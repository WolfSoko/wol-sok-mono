# Plan #3098: make the early "Jetzt …!" cue deliberate

Spec: [docs/specs/3098-pacetrainer-jetzt-ansage-fires-up-to-1-s-before-the-intervall-starts.md](../specs/3098-pacetrainer-jetzt-ansage-fires-up-to-1-s-before-the-intervall-starts.md)

## 1. Pure cue logic, test first

- Files: `apps/pacetrainer/src/app/shared/interval-countdown/countdown-cue.ts`,
  `countdown-cue.spec.ts`.
- Spec first: `cueSecond` at the boundaries (999, 1000, 1999, 5999, 6000 ms),
  `countdownCue` for announcement, beeps, start and nothing outside the
  window, `cueSound` for an Intervall and for the end of the training.
- Then `CUE_LEAD`, `cueSecond`, `countdownCue`, `cueSound`.
- Commit: `refactor(pacetrainer): name the one-second lead of the countdown cues (#3098)`
  (together with task 2, so no unused code lands alone).

## 2. Service on the pure functions

- Files: `interval-countdown.service.ts`, new `interval-countdown.service.spec.ts`.
- Spec first: with stubbed `speechSynthesis`/`SpeechSynthesisUtterance` and
  `AudioContext`, feeding `updateCountdown` 1000 ms then 999 ms left speaks
  "Jetzt Sprinten!" only at 999; ticks of 50 ms within one second speak or
  beep once.
- Then the service maps the countdown through `countdownCue`, keeps distinct
  cues and plays `cueSound`.
- Checks: `npx nx test pacetrainer`, `npx nx lint pacetrainer --fix`,
  `npx nx lint-templates pacetrainer`, `npx nx build pacetrainer`,
  `npx nx format:write`.

## 3. PR

- Spec, plan and code in one PR to `main`, `Closes #3098`.
