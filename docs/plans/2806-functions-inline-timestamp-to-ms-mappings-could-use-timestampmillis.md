# Plan: inline Timestamp-to-ms mappings use `timestampMillis` (#2806)

Spec: [`docs/specs/2806-functions-inline-timestamp-to-ms-mappings-could-use-timestampmillis.md`](../specs/2806-functions-inline-timestamp-to-ms-mappings-could-use-timestampmillis.md)

The behaviour does not change, so the existing specs are the safety net: run
`npx nx test bacteria-wars-functions` before the change (green) and after it.
`timestampMillis` itself is covered by `timestamps.spec.ts`.

1. **Replace the seven inline mappings** with `timestampMillis(x) ?? fallback`
   in `gallery/publish.ts` (two), `replays/accept.ts`, `replays/forget.ts`,
   `boards/declared-match.ts`, `site/public-site.ts` and
   `boards/rank-online.ts`; import `timestampMillis` from `../timestamps` and
   drop a `Timestamp` import left unused.
   Checks: `npx nx test bacteria-wars-functions`,
   `npx nx lint bacteria-wars-functions`, `npx nx build bacteria-wars-functions`,
   the grep of acceptance 1, `npx nx format:write`.
   Commit: `refactor(bacteria-wars-functions): map stored times through timestampMillis`
   (together with spec and plan as `docs(bacteria-wars-functions): ...` before it).
2. **PR** to `main` with `Closes #2806`, review by a fresh subagent, acceptance
   list in the description, merge request.

A `refactor` commit cuts no release, so no deploy runs after the merge; the
issue ends at `ready-for-deployment`.
