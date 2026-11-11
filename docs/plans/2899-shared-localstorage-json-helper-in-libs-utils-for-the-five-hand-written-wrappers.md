# Plan #2899: Shared localStorage JSON helper in libs/utils for the five hand-written wrappers

Spec: [docs/specs/2899-…](../specs/2899-shared-localstorage-json-helper-in-libs-utils-for-the-five-hand-written-wrappers.md).
Test first in each task; `npx nx format:write` and
`npx nx affected -t lint,lint-templates --base=origin/main` before each commit.

1. **Lib** — `libs/utils/browser-storage/src/lib/stored.ts` (+
   `stored.spec.ts`, `watch-stored.ts` + spec), `src/index.ts`, `README.md`.
   Tests: acceptance 1. Commit
   `feat(utils-browser-storage): guarded read, write and watch of stored values`.
2. **Theme and portfolio** — delete `libs/shared/theme/src/lib/stored-choice.ts`
   and `apps/portfolio/src/app/stored-choice.ts`; `theme.service.ts`,
   `i18n.service.ts` use `readStored`/`writeStored(…, deviceStorage())`.
   Tests: existing service specs. Commits
   `refactor(shared-theme): …`, `refactor(portfolio): …`.
3. **Analytics** — `consent-storage.ts`. Tests: `stored-consent` specs.
   Commit `refactor(shared-analytics): …`.
4. **Game** — `local-game-storage.ts` (watch via `watchStored` wrapped in an
   `Observable`), delete `stored-json.ts`, update
   `firestore-game-storage.ts`, `local-game-replays.ts`, `net-message.ts`;
   package.json dependency. Tests: game storage specs. Commit
   `refactor(feat-lazy-bacteria-game): …`.
5. **RollaPolla** — `voted-polls.store.ts` (+ spec if none covers blocked
   storage). Commit `refactor(rollapolla-analog): …`.
6. **Pacetrainer** — `repository.ts`. Commit `refactor(pacetrainer): …`.
7. **Korbjäger** — `geraete-speicher.ts` (drop `geraeteSpeicher`, flags over
   the lib), its users, `lokale-auswahl.ts` in `feat-korbjaeger-auswahl`.
   Tests: `geraete-speicher.spec.ts`, `auswahlVertrag`, `lokale-auswahl.spec.ts`.
   Commits `refactor(korbjaeger): …`, `refactor(feat-korbjaeger-auswahl): …`.
8. **Docs** — CLAUDE.md: one rule that `localStorage` goes through
   `@wolsok/utils-browser-storage`. Commit `chore(utils-browser-storage): …`.
