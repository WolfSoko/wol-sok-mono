# Plan: Korbjäger search B ([#2989](https://github.com/WolfSoko/wol-sok-mono/issues/2989))

Spec: `docs/specs/2989-korbjaeger-search-b-suchen-with-the-search-by-verein-in-the-title-bar.md`. Branch on top of PR #2995; merged only after #2995 is on `main`, then rebased.

1. **Lib: fold once, parse the answer.** `libs/features/basketball-data/src/lib/club-index/club-index.ts`: `clubSearch(index)` replaces `clubsMatching`; `parseIndexedClubs(body)`. Tests in `club-index.spec.ts`. Commit `feat(feat-shared-basketball-data): fold club names once and parse the club index (#2989)`.
2. **App: shared proxy fetch.** Extract `reach`, `readJson`, `browserOnline`, `offline`/`unavailable` from `src/app/basketball-data/proxy-transport.ts` into `proxy-fetch.ts`; the transport's specs stay green. Commit `refactor(korbjaeger): share the proxy fetch with the club index (#2989)`.
3. **App: `ClubIndex`.** `src/app/search/club-index.ts` (root service: load once, `state` signal: `idle`/`loading`/`loaded` with its search/`failed`, `retry`), spec with a fake fetch. Commit `feat(korbjaeger): load the club index once per start (#2989)`.
4. **App: search page.** `src/app/search/club-search.component.ts` (field, 300 ms debounce, states, hits, at most 30), `src/app/search/search-page.component.ts`, `pages/suchen/index.page.ts`, the term in a root `ClubSearchTerm`; specs. Commit `feat(korbjaeger): search a Verein on /suchen (#2989)`.
5. **App: a Verein's page.** `pages/suchen/verein/[id].page.ts` with `src/app/search/club-page.component.ts` (`vereinsTeamsResource`, `VereinsTeamsComponent`, breadcrumb); `vereinsTeamsStand`'s `ohne` optional; specs. Commit `feat(korbjaeger): a Verein's Teams to follow from the search (#2989)`.
6. **App: ways in.** Title bar action, home and overview links, the wizard's breadcrumb; their specs. Commit `feat(korbjaeger): search action in the title bar (#2989)`.
7. **E2E and docs.** `e2e/suche.spec.ts` (`/api/clubs` answered by `page.route` from a fixture, the Teams from the fake DBB), `/suchen` in `kontrast.spec.ts`, CLAUDE.md. Commit `test(korbjaeger): e2e for the search by Verein (#2989)`.
8. **PR** "Closes #2989", review, test, merge after #2995.

Before each commit: `npx nx format:write`, `npx nx affected --base=origin/main -t lint,lint-templates,test`.
