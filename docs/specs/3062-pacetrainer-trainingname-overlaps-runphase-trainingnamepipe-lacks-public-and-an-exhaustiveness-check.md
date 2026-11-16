# Pacetrainer: TrainingName overlaps RunPhase; TrainingNamePipe lacks public and an exhaustiveness check

Issue: [#3062](https://github.com/WolfSoko/wol-sok-mono/issues/3062), found in the review of [PR #3060](https://github.com/WolfSoko/wol-sok-mono/pull/3060) ([#3040](https://github.com/WolfSoko/wol-sok-mono/issues/3040)).

## Goal

`TrainingName` names what the runner does in an Intervall. Today it also holds `leadIn`, a value of `RunPhase`, only so the sprint-training component can count the Vorlauf down to "itself": the screen then says "als Nächstes: Bereit" and the Ansage "Bereit in 5 Sekunden! … Jetzt Bereit!". Separate the two concepts, and make `TrainingNamePipe` follow the coding rules (explicit `public`, a compile-time exhaustiveness check).

## Non-goals

- No change to `RunPhase`, the Trainingslauf's state machine or its stored run.
- No change to the screen's layout, the beeps or the Ansagen's timing.
- No rename of `TrainingNamePipe` or its template name `trainingName`.

## Decisions

- **`TrainingName` holds only the Intervall kinds**: `'sprint' | 'recovery' | 'running'` (what `trainingName(type)` in `training-run.ts` returns). `leadIn` leaves it; `finished` leaves it too, since it is no Intervall either.
- **A countdown counts down to a `CountdownTarget`** (`TrainingName | 'finished'`, beside `TrainingName` in `training-name.ts`, so the Trainingslauf does not import the countdown's model): the next Intervall, or the end of the Trainingslauf. `IntervalView`'s `next` (today `TrainingName | 'finished'`) and `CountdownModel.countdownTo` take that type.
- **The Vorlauf counts down to the first Intervall.** The `leadIn` view of `TrainingRunView` gets `next: TrainingName`, the first Intervall's name, and the component passes it on. The screen then says "als Nächstes: Joggen" (or whatever comes first) and the Ansage "Joggen in 5 Sekunden! … Jetzt Joggen!", which says what actually starts. The text "Bereit" disappears; "Gleich geht's los / Mach dich bereit" above the circle stays. Reason: renaming `leadIn` to another word (say `ready`) would only overlap `RunPhase`'s `ready` instead, and a countdown to "Bereit" never named what comes.
- **`TrainingNamePipe.transform` is `public`** and ends its `switch` with an exhaustiveness check (`const unknown: never = name`), so a new `CountdownTarget` without a German name fails to compile instead of returning `undefined`. It keeps passing `null`/`undefined` through.

## Acceptance

1. `TrainingName` no longer contains `leadIn` or `finished`; `npx nx typecheck pacetrainer` passes.
2. During the Vorlauf the screen shows "als Nächstes: <first Intervall's German name>" (component spec and e2e `run-sprint-training`).
3. The countdown during the Vorlauf targets the first Intervall (`sprint-training.component.spec.ts`), and `TrainingRun.state()` in `leadIn` carries `next` (`training-run.spec.ts`).
4. `TrainingNamePipe.transform` is `public`; its spec covers every `CountdownTarget` and the null pass-through; adding a value to `CountdownTarget` without a case fails to compile (checked by hand once).
5. `npx nx affected -t lint,lint-templates,test --base=origin/main` green; pacetrainer e2e green in CI.

## Open questions

None, unless the manager prefers keeping a "Bereit" countdown target under a name that overlaps no `RunPhase` value.
