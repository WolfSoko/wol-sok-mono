# Spec #2994: Licence: fix the doubled comma in the German text of every proprietary LICENSE copy

Issue: [#2994](https://github.com/WolfSoko/wol-sok-mono/issues/2994). The typo
came in with [#2956](https://github.com/WolfSoko/wol-sok-mono/issues/2956)
([PR #2965](https://github.com/WolfSoko/wol-sok-mono/pull/2965)); CodeRabbit
flagged it again on [PR #2949](https://github.com/WolfSoko/wol-sok-mono/pull/2949).

## Goal

Line 36 of the German translation in the proprietary `LICENSE` reads
`(die „Software“),, gehört`. It becomes `(die „Software“), gehört` in every
copy.

## Non-goals

- No other wording change, in German or in the binding English text.
- No change to the root `LICENSE` (it lists the folders, it holds no copy of
  the proprietary text) or to any `package.json`.

## Decisions

- **All nine copies in one commit.** CLAUDE.md requires every copy to be the
  same text (copy, don't reword), so they change together: `apps/rollapolla-analog`,
  `apps/korbjaeger`, `apps/korbjaeger-functions`, `apps/korbjaeger-cdk`,
  `libs/features/basketball-data`, `libs/features/korbjaeger-account`,
  `libs/features/korbjaeger-auswahl`, `libs/features/korbjaeger-antworten`,
  `tools/korbjaeger`. These are exactly the files on `main` holding `,, gehört`.
- **No new spec or test.** The change is one character of a legal text; the
  check is `cmp` across the copies and a `git grep`, run once here. A test
  that keeps the copies identical would be a follow-up of its own.

## Acceptance

1. `git grep ',, gehört' -- '*LICENSE'` finds nothing.
2. Each of the nine copies reads `(die „Software“), gehört` on line 36.
3. All nine copies are byte-identical (`cmp` against `apps/korbjaeger/LICENSE`).
4. The diff touches only line 36 of those nine files (plus this spec and plan).

## Open questions

None.
