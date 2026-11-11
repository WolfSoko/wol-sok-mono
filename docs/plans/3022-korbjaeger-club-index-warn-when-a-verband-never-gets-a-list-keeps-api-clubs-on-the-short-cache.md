# Plan #3022: Korbjäger club index: warn when a Verband never gets a list

Spec: [docs/specs/3022-…](../specs/3022-korbjaeger-club-index-warn-when-a-verband-never-gets-a-list-keeps-api-clubs-on-the-short-cache.md).
Test first in each task; `npx nx format:write` and
`npx nx affected -t lint,lint-templates` before each commit.

1. **Pure decision** — `apps/korbjaeger-functions/src/club-index/association-to-crawl.ts`
   (`warnListlessAfterMs` on `ClubIndexSchedule`, `overdueListless`), its
   spec (acceptance 1–2 at the unit level); `config.ts` and `config.spec.ts`
   (from `CLUB_INDEX_CRAWL_DAYS.maxAge`).
2. **Run** — `run-club-index.ts`: state `listlessSince`, `lastErrors`;
   store `markAttempt(id, at, listlessSince?)`, `markFailure(id, error)`;
   run `warn` port, `withoutList`, error text. `run-club-index.spec.ts`:
   acceptance 1–5.
3. **Firestore store** — `firestore-club-index.ts` and its emulator spec
   (acceptance 6).
4. **Wiring and docs** — `main.ts` passes `logger.warn`; `CLAUDE.md`.
   Commit all as `feat(korbjaeger-functions): warn when a Verband has had no club list for a week`
   (one commit: the store's interface changes across all files).
