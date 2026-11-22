# Spec: Vorlauf's first beep sounds about 50 ms after the opening Ansage ([#3110](https://github.com/WolfSoko/wol-sok-mono/issues/3110))

## Goal

Every countdown of Pacetrainer leaves its opening Ansage a full
`CUE_LEAD` (one second) before the first beep, as the long Intervalle already
do. Today the Vorlauf speaks "Sprinten in 5 Sekunden!" at 5000 ms left and
plays the next beep on the very next 50 ms tick, over the speech.

## Root cause

The cue model (`apps/pacetrainer/src/app/shared/interval-countdown/countdown-cue.ts`)
sounds each cue one `CUE_LEAD` before its second ([#3098](https://github.com/WolfSoko/wol-sok-mono/issues/3098)):
the announcement of a five-second window is due from 5999 ms left, the beep of
second 4 from 4999 ms. That assumes every countdown starts with at least
window + `CUE_LEAD` left. A long Intervall does (its window is clipped to
5000 ms of a longer duration), but two countdowns start exactly at their
window:

- the Vorlauf: `TrainingRun`'s `LEAD_IN` is 5000 ms and
  `SprintTrainingComponent` passes it as the window, so the first tick at
  5000 ms announces second 5 and the tick at 4950 ms beeps second 4;
- every Intervall of 5 s or less: the component passes
  `min(ANNOUNCEMENT_WINDOW, duration)`, so a 3 s recovery announces at 3000 ms
  and beeps at 2950 ms.

So the bug is not the Vorlauf's: the cue model does not know how long the
countdown is, only the window the component clipped for it.

## Non-goals

- No change to the cue timing of long Intervalle, `CUE_LEAD`, the tones, the
  spoken texts or the speech rate.
- No change to the Vorlauf's length (`LEAD_IN` stays 5000 ms, as
  [#3119](https://github.com/WolfSoko/wol-sok-mono/issues/3119) set it) or to
  the countdown ring.

## Decisions

- **The cue model gets the countdown's length, and clips the window itself.**
  `CountdownModel.countdownTime` becomes the length of the whole countdown
  (the Vorlauf's `total`, the current Intervall's `duration`), documented as
  such. `ANNOUNCEMENT_WINDOW` (5000 ms) moves from `SprintTrainingComponent`
  into `countdown-cue.ts`, and the component passes the plain duration.
  Reason: the window depends on the lead, which only the cue model knows; the
  component should not do cue arithmetic.
- **The announced window is one `CUE_LEAD` short of a countdown that starts
  inside it**: `announcedSeconds = max(0, floor(min(ANNOUNCEMENT_WINDOW,
  countdownTime − CUE_LEAD) / 1 s))`. A countdown of 6 s or more keeps its
  five-second window, unchanged. The Vorlauf (5 s) announces "Sprinten in 4
  Sekunden!" from 4999 ms left and beeps seconds 3, 2 and 1 a second apart,
  then "Jetzt Sprinten!" at 999 ms, like every other countdown, whose spoken
  number already runs one lead ahead of the ring. A 3 s Intervall announces
  second 2.
  Rejected: lengthening the Vorlauf to 6 s to keep "in 5 Sekunden" (changes
  the runner-visible Vorlauf #3119 just settled, and leaves the short
  Intervalle broken); skipping the beep that would follow the announcement
  (a special case that hides the collision instead of removing it).
- **A countdown too short for an announcement only says "Jetzt …"**: with an
  announced window of 0 (countdowns under 2 s), the start cue wins at second 0.
  Today such a countdown says "… in 0 Sekunden!" (or, at exactly 1 s, the
  announcement 1 ms before "Jetzt …"), which the start cue then never follows.
  The existing spec "announces a window shorter than the lead at once" gives
  way to that rule.

## Acceptance

1. A 5000 ms countdown ticked every 50 ms from 5000 ms sounds the
   announcement "Sprinten in 4 Sekunden!", three beeps and "Jetzt Sprinten!",
   each cue at least 1000 ms − one tick after the previous one.
2. A countdown of 6 s or more sounds as today: announcement "… in 5
   Sekunden!" from 5999 ms, beeps from 4999, 3999, 2999 and 1999 ms, start
   from 999 ms.
3. A 3000 ms Intervall announces second 2 from 2999 ms, beeps second 1 from
   1999 ms and starts from 999 ms.
4. A 1000 ms countdown says only the start cue, no "in 0 Sekunden".
5. `SprintTrainingComponent` passes the Vorlauf's `total` and the Intervall's
   `duration` unclipped; `ANNOUNCEMENT_WINDOW` lives in `countdown-cue.ts`.
6. `nx test pacetrainer`, `nx lint pacetrainer`, `nx lint-templates pacetrainer`
   and `nx typecheck-specs pacetrainer` pass.

Audio cannot be checked by an automated run of the app (headless browsers
neither speak nor play to a listener), so the acceptance is checked by the
unit specs of the cue model, the service and the component.

## Open questions

None.
