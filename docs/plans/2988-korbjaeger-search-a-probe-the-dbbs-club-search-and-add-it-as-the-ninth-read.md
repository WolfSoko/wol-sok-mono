# Plan: Korbjäger Verein index (#2988)

Spec: [docs/specs/2988-korbjaeger-search-a-probe-the-dbbs-club-search-and-add-it-as-the-ninth-read.md](../specs/2988-korbjaeger-search-a-probe-the-dbbs-club-search-and-add-it-as-the-ninth-read.md). Test first, one commit a task, `nx format:write` and `nx affected -t lint,lint-templates --base=origin/main` before each.

1. **Domain types and matching** (`libs/features/basketball-data/src/lib/domain/club-index.ts` + spec): `ClubIndexEntry`, `VerbandClubs`, `IndexedClub`, `clubsMatching`, `mergeVerbandClubs`. Export from `index.ts`. Commit `feat(feat-shared-basketball-data): …`.
2. **Crawl** (`libs/features/basketball-data/src/lib/club-index/crawl-clubs.ts` + spec on fixtures via `fakeDbbAnswer`, fake pause): pages, Spielpläne, names, skip `not-found`, reject otherwise. Add a recorded, anonymised Liga-list fixture for one small Verband if the existing ones don't cover a whole Verband. Commit.
3. **Collection name** (`libs/features/korbjaeger-account`: `CLUB_INDEX_COLLECTION`), Firestore rules comment + emulator spec refusing clients, `firestore-collections.spec.ts`. Commit `feat(korbjaeger): …`.
4. **Scheduled function** (`apps/korbjaeger-functions/src/club-index/`: `pickVerband`, `runClubIndex(db, data, now)`, DBB transport with User-Agent and timeout; `main.ts` export behind `CLUB_INDEX_ON`; specs with fakes; emulator spec for the write). Commit `feat(korbjaeger-functions): …`.
5. **Route** (`apps/korbjaeger/src/server/routes/api/clubs.get.ts` over `src/server/clubs/`: reader port, `firebase-admin` reader, merge, headers; `PROXY_CACHE_SEKUNDEN` gains `vereinsIndexBrowser`/`vereinsIndexCdn`; spec with a fake reader). Add `firebase-admin` to what the Nitro function installs if its build does not trace it. Commit `feat(korbjaeger): …`.
6. **Privacy policy** section 3 and its spec. Commit `docs(korbjaeger)` or `feat(korbjaeger)`.
7. **ADR 0018 amendment, CLAUDE.md**. Commit `docs(korbjaeger): …`.
8. PR, review subagent, fixes, acceptance list in the PR body, comment on #2963.
