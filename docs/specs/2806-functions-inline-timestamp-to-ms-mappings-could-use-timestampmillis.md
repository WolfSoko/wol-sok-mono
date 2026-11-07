# Functions: inline Timestamp-to-ms mappings use `timestampMillis`

Issue: [#2806](https://github.com/WolfSoko/wol-sok-mono/issues/2806)

## Goal

`apps/bacteria-wars-functions/src/timestamps.ts` holds `timestampMillis(value)`:
a Firestore `Timestamp` in ms, `null` for anything else. Seven places in the
functions still spell that mapping out inline as
`x instanceof Timestamp ? x.toMillis() : fallback`. They read it through
`timestampMillis(x) ?? fallback` instead, so the functions map a stored time to
ms in one place.

The places:

- `gallery/publish.ts`: `createdAt` in `publishPicked` (fallback `now`) and in
  `unpublish` (fallback `now`)
- `replays/accept.ts`: `createdAt` in `submissionMeta` (fallback `now`)
- `replays/forget.ts`: `createdAt` (fallback `null`)
- `boards/declared-match.ts`: `sent` as `arrivedAt` (fallback `now`)
- `site/public-site.ts`: `featuredAt` (fallback `0`)
- `boards/rank-online.ts`: `stubCreatedAt` (fallback `null`; the issue missed
  it, same pattern)

## Non-goals

- Guards that test `instanceof Timestamp` and compare in one expression
  (`at instanceof Timestamp && at.toMillis() <= sentAt` in `replays/accept.ts`,
  `boards/verify-slice.ts`, `boards/rebuild-top.ts`, `admin/tombstones.ts`,
  `boards/rank-endless.ts`, `boards/declared-match.ts`' `no-attempt` check):
  they read as a type check, and rewriting them as
  `(timestampMillis(x) ?? -Infinity) > now` hides which way a missing time
  falls. They stay as they are.
- `stubCreatedAt` in `replays/accept.ts` keeps the `Timestamp` itself, not ms.
- No behaviour change: every place keeps its fallback.

## Decisions

- `?? fallback`, not a second helper with a default parameter: the fallback
  differs per place (`now`, `0`, `null`) and `??` shows it at the call.
- `Timestamp` imports stay where the module still uses `Timestamp.fromMillis`;
  an import left unused is removed (oxlint would flag it).

## Acceptance

1. None of the seven places spells out `instanceof Timestamp ? … .toMillis() :`;
   `grep -rnE "instanceof Timestamp \? .*toMillis" apps/bacteria-wars-functions/src`
   finds only `timestamps.ts` itself.
2. `npx nx test bacteria-wars-functions` passes unchanged (no spec needs to
   change, since the behaviour does not).
3. `npx nx lint bacteria-wars-functions` and `npx nx build bacteria-wars-functions`
   pass.
4. `npx nx test-emulator bacteria-wars-functions` passes where the emulator
   runs (CI runs it).

## Open questions

None.
