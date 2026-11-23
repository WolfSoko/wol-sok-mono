# Spec: Ansage says "in 1 Sekunden" instead of "in 1 Sekunde" ([#3208](https://github.com/WolfSoko/wol-sok-mono/issues/3208))

## Goal

The countdown's announcement in Pacetrainer is correct German for every
number of seconds: "Sprinten in 1 Sekunde!" and "Noch 1 Sekunde!" for one
second, "Sprinten in 3 Sekunden!" and "Noch 3 Sekunden!" for more.

## Cause

`cueText` in `apps/pacetrainer/src/app/shared/interval-countdown/countdown-cue.ts`
always appends "Sekunden". Since [#3110](https://github.com/WolfSoko/wol-sok-mono/issues/3110)
(PR [#3204](https://github.com/WolfSoko/wol-sok-mono/pull/3204)) every
countdown of 2 to 2.999 s announces second 1, so runners hear the wrong form
for every 2 s Intervall.

## Non-goals

- No other texts change (start cue, end of training).
- No general i18n or pluralisation library: the app speaks German only.

## Decisions

1. **One helper names the duration.** A private function
   `secondsSpoken(count)` in `countdown-cue.ts` returns "1 Sekunde" for 1 and
   "<n> Sekunden" otherwise; both announcement texts use it. Reason: the
   two texts share the phrase, so the rule lives once and no magic branch
   repeats per text.
2. **Only 1 is singular.** The announcement never names 0 seconds (second 0
   is the start cue), and German uses the plural for every other count.

## Acceptance

- [ ] `cueSound` of an announcement with `secondsLeft: 1` towards an
      Intervall says "<name> in 1 Sekunde!".
- [ ] Towards `finished` with `secondsLeft: 1` it says "Noch 1 Sekunde!".
- [ ] Counts above 1 keep "Sekunden" (existing specs stay green).
- [ ] A 2 s Intervall's countdown announces "… in 1 Sekunde!" end to end
      through `IntervalCountdownService` (its spec).
- [ ] `nx test pacetrainer`, `lint`, `typecheck-specs` green.

## Open questions

None.
