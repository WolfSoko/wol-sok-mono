# Plan #3005: Korbjäger /api/clubs: do not cache an empty or partial club index for a day

Spec: [docs/specs/3005-…](../specs/3005-korbjaeger-api-clubs-do-not-cache-an-empty-or-partial-club-index-for-a-day.md).
Test first in each task; `npx nx format:write` and
`npx nx affected -t lint,lint-templates` before each commit.

1. **Lib: `parseClubIndex`** — `libs/features/basketball-data/src/lib/club-index/stored-association-clubs.ts`
   (+ spec, export in `src/index.ts`). Tests: empty → incomplete; all lists →
   complete; a placeholder or a foreign version → incomplete, lists kept.
   Commit `feat(feat-shared-basketball-data): tell whether the stored club index is complete`.
2. **Account lib: `CLUB_INDEX_CRAWL_DAYS`** — `libs/features/korbjaeger-account/src/lib/account.ts`,
   `src/index.ts`; `apps/korbjaeger-functions/src/config.ts` builds
   `CLUB_INDEX_SCHEDULE` from it (its spec asserts the link). Commit
   `refactor(feat-shared-korbjaeger-account): share the club index's crawl days`.
3. **Functions: placeholders and full removal** — `run-club-index.ts`
   (`ClubIndexState.ids`, `ClubIndexStore.noteOffered`), `firestore-club-index.ts`
   (`offeredAt`), their spec and emulator spec. Tests: acceptance 5–7.
   Commit `feat(korbjaeger-functions): note every offered Verband in the club index`.
4. **App: short cache while filling** — `src/shared/proxy-cache.ts`,
   `src/server/clubs/club-index-response.ts` (reader returns `{ lists, complete }`),
   `firestore-club-index-reader.ts`, route doc, spec. Tests: acceptance 1–4.
   Commit `fix(korbjaeger): cache an incomplete club index for minutes only`.
5. **Privacy text (#3004)** — `datenschutz.component.{ts,html,spec.ts}`:
   `clubIndex`, both cache times, crawl days. Commit
   `fix(korbjaeger): say when the club index is crawled again and cached briefly`.
6. **Docs** — `CLAUDE.md` club index paragraph. Commit `docs` as `chore(korbjaeger): …`.
