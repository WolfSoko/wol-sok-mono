# Spec #3098: Pacetrainer: "Jetzt …!" Ansage fires up to 1 s before the Intervall starts

Issue: [#3098](https://github.com/WolfSoko/wol-sok-mono/issues/3098), found in
the review of [#3062](https://github.com/WolfSoko/wol-sok-mono/issues/3062).
Related: [#3040](https://github.com/WolfSoko/wol-sok-mono/issues/3040).

## Goal

`IntervalCountdownService` (`apps/pacetrainer/src/app/shared/interval-countdown/`)
speaks "Jetzt <name>!" once `Math.floor(timeLeft / 1000) === 0`, i.e. between
1000 ms and one tick (50 ms) before the next Intervall begins. Every other cue
of the countdown (the "<name> in 5 Sekunden!" Ansage and the beeps) is shifted
by the same second, but nothing in the code says so: it reads like an
off-by-one.

The owner decided (handover note: "It's okay to be a little earlier to respect
human reaction time") that the cue **stays early on purpose**. This change
makes that lead an explicit, named and tested part of the countdown, without
changing what the runner hears or when.

## Non-goals

- No change to the timing, the beep frequencies or the spoken texts.
- No change to the Vorlauf, whose countdown starts with exactly its full
  window left, so its Ansage and first beep sound about 50 ms apart (raised
  separately as a follow-up).
- No change to `TrainingRun`, the tick period or the sprint-training component.

## Decisions

- **Keep a lead of one second (`CUE_LEAD`).** "Jetzt Sprinten!" at the speech
  rate of 1.25 takes about a second to say, and a runner needs a moment to
  react to it; starting the cue one second before the Intervall lets the words
  end on the start. One second is what the app does today, so the runner hears
  no difference.
- **The lead applies to every cue alike.** The cue for "n seconds left"
  sounds `CUE_LEAD` before n seconds are left:
  `cueSecond(timeLeft) = floor((timeLeft - CUE_LEAD) / 1 s) + 1`. With a lead of
  one second this equals today's `floor(timeLeft / 1 s)` for every `timeLeft`,
  so the rhythm of Ansage, beeps and "Jetzt" stays one beat a second.
- **Pure cue logic in its own file.** `countdown-cue.ts` next to the service
  holds `CUE_LEAD`, `cueSecond`, `countdownCue` (which cue, if any, a countdown
  is at) and `cueSound` (frequency, length and text of a cue). The service only
  turns the countdown signal into distinct cues and plays them. The service
  has no spec today; the pure functions get one, and the service a small one
  through stubbed `speechSynthesis` and `AudioContext`.

## Acceptance

1. "Jetzt <name>!" is spoken at 999 ms left, not at 1000 ms left
   (`countdown-cue.spec.ts` and the service spec).
2. With a 5 s window, "<name> in 5 Sekunden!" sounds below 6000 ms left, the
   beeps below 5000, 4000, 3000 and 2000 ms, "Jetzt <name>!" below 1000 ms;
   at the end of the training "Noch 5 Sekunden!" and "Training beendet. Gut
   gemacht!" at the same points (spec).
3. `CUE_LEAD` is a named, documented constant; `interval-countdown.service.ts`
   no longer computes seconds itself.
4. Each cue sounds once per second, also across many ticks (service spec).
5. `npx nx test pacetrainer`, `lint`, `lint-templates` and
   `npx nx build pacetrainer` pass.

## Open questions

None.
