# Plan: Ansage says "in 1 Sekunden" instead of "in 1 Sekunde" ([#3208](https://github.com/WolfSoko/wol-sok-mono/issues/3208))

Spec: [docs/specs/3208-pacetrainer-ansage-says-in-1-sekunden-instead-of-in-1-sekunde.md](../specs/3208-pacetrainer-ansage-says-in-1-sekunden-instead-of-in-1-sekunde.md)

## Task 1: singular announcement for one second

- Test first: `countdown-cue.spec.ts` (`cueSound`): announcement with
  `secondsLeft: 1` towards `sprint` says "Sprinten in 1 Sekunde!", towards
  `finished` "Noch 1 Sekunde!". `interval-countdown.service.spec.ts`: a
  2 s Intervall speaks "Sprinten in 1 Sekunde!" before "Jetzt Sprinten!".
- Code: `countdown-cue.ts`: `secondsSpoken(count)`, used by both
  announcement texts in `cueText`.
- Commit: `fix(pacetrainer): announce "1 Sekunde" in the singular (#3208)`,
  together with spec and plan.

## Checks

`npx nx format:write`, `npx nx test pacetrainer`,
`npx nx affected -t lint,lint-templates,typecheck-specs`.
