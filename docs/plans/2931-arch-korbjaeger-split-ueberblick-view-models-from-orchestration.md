# Plan #2931: split ueberblick/ view models from orchestration

Spec: [docs/specs/2931-…](../specs/2931-arch-korbjaeger-split-ueberblick-view-models-from-orchestration.md)

Each task is test first where it adds behaviour and a pure move otherwise;
before each commit `npx nx format:write`,
`npx nx affected -t lint,lint-templates,test`.

1. **Kader search into the lib.** New
   `libs/features/basketball-data/src/lib/domain/kader-suche.ts`
   (`kaderSuchen<O>`, types) and its spec (the `kaderSuchen` cases of the
   app's `kader-suche.spec.ts`, typed against `BasketballData`); exported in
   `src/index.ts`. The app's `kader-suche.ts` keeps `KADER_SUCHE_SPIELE`,
   `kaderSucheResource`, `gleicherAuftrag`; imports of the types switch to
   the lib. Tests: lib spec, app `kader-suche.spec.ts` (gleicherAuftrag).
   Commit `refactor(feat-shared-basketball-data): take the Kader search from the Korbjäger overview`.
2. **Pure helpers out of the service.** `ueberblick/abgleichen.ts` +
   spec, `ueberblick/kader-funde.ts` + spec (written first against the
   current behaviour, then the code moved). Commit
   `refactor(korbjaeger): split keyed reads and kept Kader finds from MeineTeamsUeberblick`.
3. **A Team's reads and its overview entry.** `ueberblick/team-lesungen.ts`
   (`TeamLesungen`, `teamLesungen`, `lesungenBeenden`) and
   `ueberblick/team-im-ueberblick.ts` (`teamImUeberblick`);
   `MeineTeamsUeberblick` down to the wiring. Tests:
   `ueberblick.component.spec.ts` unchanged. CLAUDE.md's sentences. Commit
   `refactor(korbjaeger): leave MeineTeamsUeberblick with the overview's wiring`.
4. **Checks.** `nx affected -t lint,lint-templates,test,typecheck-specs`,
   `nx build korbjaeger`, line count of the service; PR with spec, plan,
   acceptance results.
