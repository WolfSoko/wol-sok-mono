# Spec #3040: Pacetrainer naming leftovers (getready for the Vorlauf, excercise.ts typo)

Issue: [#3040](https://github.com/WolfSoko/wol-sok-mono/issues/3040), found in
the review of [PR #3033](https://github.com/WolfSoko/wol-sok-mono/pull/3033)
([#2968](https://github.com/WolfSoko/wol-sok-mono/issues/2968)). Related:
[#2961](https://github.com/WolfSoko/wol-sok-mono/issues/2961).

## Goal

Two names #2968 left behind in `apps/pacetrainer`:

1. The `TrainingName` value `'getready'` names the Vorlauf, whose code name in
   `CONTEXT.md` is `LeadIn` and whose _Avoid_ list names `getready`. It becomes
   `'leadIn'`, the same spelling as `RunPhase`'s `'leadIn'`.
2. `shared/model/training/excercise.ts` is misspelled; it becomes `exercise.ts`.

## Non-goals

- No change to what the runner sees or hears: the pipe still says "Bereit".
- No other renames in pacetrainer.

## Decisions

- **No migration.** `TrainingName` is never persisted (only in signals, the
  countdown model and the announcements), so the value changes in place.
- **`git mv`** for the file, so history follows it; every import is updated,
  no re-export under the old name.

## Acceptance

- `grep -rn "getready\|excercise" apps/pacetrainer` finds nothing.
- `npx nx test pacetrainer`, `lint`, `lint-templates` and the app's build pass.
- The Vorlauf's countdown still ends in "Bereit" (sprint-training spec).

## Open questions

None.
